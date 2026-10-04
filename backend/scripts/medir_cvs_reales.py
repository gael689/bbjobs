"""Medición de CVs reales antes de usarlos en la IA (auditoría R20, autorizada por Gael el 04/10).

Todo local, **sin IA**: nada sale hacia ningún modelo.

1. Lee de la base (sólo lectura) una muestra al azar de candidatos con CV.
2. Descarga cada PDF con un link firmado de Cloudinary.
3. Extrae el texto (descartando texto oculto), lo redacta y mide qué se tachó.
4. Busca **fugas**: nombre, teléfono o mail del propio candidato, o un mail cualquiera, que
   sigan en el texto redactado. **Criterio de salida: cero fugas en la muestra.**
5. Escribe los textos redactados en una carpeta temporal FUERA del repo para la revisión a mano
   de 30, y la borra cuando apretás Enter.

Uso (desde backend/, en una ventana de PowerShell):
    .venv\\Scripts\\python.exe scripts\\medir_cvs_reales.py --muestra 40
"""
from __future__ import annotations

import argparse
import asyncio
import os
import shutil
import statistics
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.services.ai.chunks import CandidateData, build_ficha  # noqa: E402
from app.services.ai.ingest import extract_cv_text  # noqa: E402
from app.services.ai.jobs import fetch_cv  # noqa: E402
from app.services.ai.redact import leaks, redact  # noqa: E402


async def main(sample: int) -> None:
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    try:
        async with conn.transaction(readonly=True):
            rows = await conn.fetch(
                """SELECT c.id, c.first_name, c.last_name, c.phone, u.email, c.cv_file_url
                   FROM candidate_profiles c JOIN users u ON u.id = c.user_id
                   WHERE c.deleted_at IS NULL AND c.cv_file_url IS NOT NULL
                   ORDER BY random() LIMIT $1""", sample)
    finally:
        await conn.close()

    folder = Path(tempfile.mkdtemp(prefix="bbjobs_cvs_redactados_"))
    status = Counter()
    leak_counter = Counter()
    hidden, chars, chunks, stats_total = [], [], [], Counter()
    leaky: list[str] = []
    for i, r in enumerate(rows, start=1):
        try:
            data = await fetch_cv(r["cv_file_url"])
        except Exception as exc:
            status[f"descarga_fallida:{type(exc).__name__}"] += 1
            continue
        ex = await asyncio.wait_for(asyncio.to_thread(extract_cv_text, data), 15)
        status[ex.status] += 1
        if ex.status != "ok":
            continue
        names = [r["first_name"], r["last_name"], f"{r['first_name']} {r['last_name']}"]
        red = redact(ex.text, known_names=names, known_phones=[r["phone"] or ""], known_emails=[r["email"] or ""])
        stats_total.update(red.stats)
        hidden.append(ex.hidden_chars_dropped)
        chars.append(len(red.text))
        found = leaks(red.text, known_names=names, known_phones=[r["phone"] or ""], known_emails=[r["email"] or ""])
        for f in found:
            leak_counter[f.split(":")[0]] += 1
        ficha = build_ficha(CandidateData(id=str(r["id"]), first_name=r["first_name"], last_name=r["last_name"],
                                          phone=r["phone"] or "", email=r["email"] or "", cv_text=ex.text))
        chunks.append(len(ficha.chunks))
        name = f"cv_{i:02d}{'_FUGA' if found else ''}.txt"
        if found:
            leaky.append(name)
        (folder / name).write_text(red.text, encoding="utf-8")

    ok = status.get("ok", 0)
    print("\n=== Medición de CVs reales (sin IA) ===")
    print(f"Muestra: {len(rows)}  ·  estados: {dict(status)}")
    if ok:
        print(f"Con texto extraíble: {ok}/{len(rows)} ({100 * ok / max(1, len(rows)):.0f} %)")
        print(f"Caracteres después de redactar: mediana {statistics.median(chars):.0f}, máx {max(chars)}")
        print(f"Fragmentos por ficha: mediana {statistics.median(chunks):.0f}, máx {max(chunks)}")
        print(f"CVs con texto oculto descartado: {sum(1 for h in hidden if h)}")
        print(f"Qué se tachó (total): {dict(stats_total)}")
    print(f"FUGAS: {dict(leak_counter) or 'ninguna'}  ->  {'NO PASA' if leak_counter else 'PASA'} el criterio de salida")
    if leaky:
        print("Archivos con fuga:", ", ".join(leaky))
    print(f"\nTextos redactados para revisar a mano: {folder}")
    print("Revisá al menos 30 (DNI, domicilio, nombres de terceros, edad). Después apretá Enter y se borran.")
    try:
        input()
    finally:
        shutil.rmtree(folder, ignore_errors=True)
        print("Carpeta borrada.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--muestra", type=int, default=40)
    args = parser.parse_args()
    if not 1 <= args.muestra <= 50:
        sys.exit("La muestra autorizada es de hasta 50 CVs.")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    asyncio.run(main(args.muestra))
