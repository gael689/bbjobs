"""Evaluación del RAG con el etiquetado de Eugenia (ver app/services/ai/evaluation.py).

Dos pasos, contra una base con los recomendados ya calculados (la de producción en sólo
lectura, o una copia):

1. Exportar la planilla ciega para Eugenia (3 búsquedas, 40 candidatos cada una, mezclados):
       .venv\\Scripts\\python.exe scripts\\evaluacion_rag.py exportar --job <id> --job <id> --job <id> --salida etiquetas.csv
   La planilla trae, por candidato, lo que Eugenia necesita para juzgar (puesto, link interno al
   perfil) y una columna `etiqueta` vacía: 0 no sirve · 1 dudoso · 2 sirve · 3 lo llamaría ya.
   **No trae el puntaje**: si lo viera, el etiquetado se contamina.

2. Medir con la planilla completada:
       .venv\\Scripts\\python.exe scripts\\evaluacion_rag.py medir --planilla etiquetas.csv
   Compara orden de llegada, híbrido e híbrido + rerank (NDCG@10) y aplica la regla fija.
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.services.ai.evaluation import JobResult, decide, ndcg, stratified_sample  # noqa: E402


async def _connect():
    return await asyncpg.connect(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))


async def exportar(jobs: list[str], salida: str) -> None:
    conn = await _connect()
    try:
        async with conn.transaction(readonly=True):
            rows_out = []
            for job in jobs:
                title = await conn.fetchval("SELECT title FROM job_postings WHERE id = $1", job)
                ranked = [r["candidate_id"] for r in await conn.fetch(
                    "SELECT candidate_id FROM job_recommendations WHERE job_id = $1 AND source = 'applicant' "
                    "ORDER BY hybrid_fit DESC", job)]
                for cid in stratified_sample([str(c) for c in ranked]):
                    rows_out.append({"busqueda": job, "puesto": title, "candidato": cid,
                                     "perfil": f"/dashboard/admin/candidatos?id={cid}", "etiqueta": ""})
    finally:
        await conn.close()
    with open(salida, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["busqueda", "puesto", "candidato", "perfil", "etiqueta"])
        w.writeheader()
        w.writerows(rows_out)
    print(f"Planilla para Eugenia: {salida} ({len(rows_out)} filas). Sin puntajes, a propósito.")


async def medir(planilla: str) -> None:
    labels: dict[str, dict[str, float]] = {}
    with open(planilla, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["etiqueta"].strip():
                labels.setdefault(row["busqueda"], {})[row["candidato"]] = float(row["etiqueta"])
    conn = await _connect()
    results = []
    try:
        async with conn.transaction(readonly=True):
            for job, lab in labels.items():
                arrival = [str(r["candidate_id"]) for r in await conn.fetch(
                    "SELECT candidate_id FROM applications WHERE job_posting_id = $1 ORDER BY created_at", job)]
                recs = await conn.fetch(
                    "SELECT candidate_id, hybrid_fit, semantic_pct, final_score, rerank_status FROM job_recommendations "
                    "WHERE job_id = $1 AND source = 'applicant'", job)
                hybrid = [str(r["candidate_id"]) for r in sorted(
                    recs, key=lambda r: -(0.75 * r["hybrid_fit"] + 0.25 * (r["semantic_pct"] or 0.5)))]
                has_rerank = any(r["rerank_status"] == "done" for r in recs)
                rerank = [str(r["candidate_id"]) for r in sorted(recs, key=lambda r: -r["final_score"])]
                results.append(JobResult(job=job, arrival=ndcg(arrival, lab), hybrid=ndcg(hybrid, lab),
                                         rerank=ndcg(rerank, lab) if has_rerank else None))
    finally:
        await conn.close()
    print(f"{'búsqueda':38} {'llegada':>8} {'híbrido':>8} {'rerank':>8}")
    for r in results:
        rr = f"{r.rerank:8.3f}" if r.rerank is not None else "       —"
        print(f"{r.job:38} {r.arrival:8.3f} {r.hybrid:8.3f} {rr}")
    print(decide(results)[1])


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("exportar")
    e.add_argument("--job", action="append", required=True)
    e.add_argument("--salida", default="etiquetas.csv")
    m = sub.add_parser("medir")
    m.add_argument("--planilla", required=True)
    a = p.parse_args()
    asyncio.run(exportar(a.job, a.salida) if a.cmd == "exportar" else medir(a.planilla))
