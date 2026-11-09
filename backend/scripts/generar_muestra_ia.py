"""Genera la pestaña "Cómo trabaja la IA" de la vista previa para Eugenia (`/vista-previa/<clave>`).

Corre el pipeline **real** (ingesta y anonimización de CVs, requisitos, índice, puntaje y rerank
con Gemini) sobre el mundo sintético del simulacro: una búsqueda y seis postulantes inventados.
No lee ninguna base real ni datos de personas.

Se niega a correr si `DATABASE_URL` no apunta a 127.0.0.1/localhost, y sin `GEMINI_API_KEY`
(la muestra tiene que mostrar a Gemini de verdad, no al doble de los tests).

Uso (desde backend/, con una base local migrada a head):
  $env:DATABASE_URL="postgresql+asyncpg://postgres@127.0.0.1:5544/bbjobs_e2e"
  $env:GEMINI_API_KEY="..."; python scripts/generar_muestra_ia.py
Escribe frontend/src/vista-previa/datos/ia.json
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import simulacro_local as sim  # noqa: E402  (se niega solo si la base no es local)
from sqlalchemy import func, select, text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.integrations.gemini_client import AIUnavailable, get_provider  # noqa: E402
from app.models.ai import AiUsageLog, CandidateAiIndex, CandidateCvText, JobAiProfile, JobRecommendation  # noqa: E402
from app.models.candidate import CandidateProfile  # noqa: E402
from app.models.job import Application, JobPosting  # noqa: E402
from app.services.ai import pipeline  # noqa: E402
from app.services.email.policy import AR_TZ  # noqa: E402

SALIDA = Path(__file__).resolve().parents[2] / "frontend" / "src" / "vista-previa" / "datos" / "ia.json"
VEREDICTO = {"si": "Cumple", "parcial": "Cumple en parte", "no": "No cumple", "sin_datos": "Sin dato"}


async def main() -> None:
    settings.MODULOS_NUEVOS_ACTIVOS = True
    try:
        provider = get_provider()
    except AIUnavailable:
        sys.exit("Falta GEMINI_API_KEY: la muestra se genera con Gemini de verdad.")

    engine = create_async_engine(settings.DATABASE_URL)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    # El mundo del simulacro, sin los pasos de mails: sólo lo que hace la IA.
    perfiles, job_id = await sim.armar_mundo(maker, nombres_limpios=True)

    async with maker() as db:
        for p, u, pdf in perfiles:
            async def fetch(_url, data=pdf):
                return data
            await pipeline.refresh_cv_text(db, p, u.email, fetch)
        await db.commit()
        await pipeline.index_candidates(db, provider, [p.id for p, _, _ in perfiles])
        job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one()
        await pipeline.compute_recommendations(db, provider, job, rerank_enabled=True)
        await db.commit()

        prof = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job_id))).scalar_one()
        req_text = {r.get("id"): r["texto"] for r in prof.requirements}
        postularon = set((await db.execute(
            select(Application.candidate_id).where(Application.job_posting_id == job_id))).scalars())
        rows = (await db.execute(
            select(JobRecommendation, CandidateProfile)
            .join(CandidateProfile, CandidateProfile.id == JobRecommendation.candidate_id)
            .where(JobRecommendation.job_id == job_id).order_by(JobRecommendation.final_score.desc())
        )).all()
        textos = {t.candidate_id: t for t in (await db.execute(select(CandidateCvText))).scalars()}
        indices = {i.candidate_id: i for i in (await db.execute(select(CandidateAiIndex))).scalars()}
        gasto = (await db.execute(select(func.coalesce(func.sum(AiUsageLog.cost_usd), 0))
                                  .where(AiUsageLog.job_id == job_id))).scalar_one()
        llamadas = (await db.execute(select(func.count()).select_from(AiUsageLog)
                                     .where(AiUsageLog.job_id == job_id))).scalar_one()

    candidatos = []
    for r, p in rows:
        evals = []
        for e in r.req_evals or []:
            rid = e.get("req_id")
            evals.append({
                "requisito": req_text.get(rid, rid), "tipo": e.get("kind"),
                "veredicto": VEREDICTO.get(e.get("verdict"), e.get("verdict")),
                "evidencia": (r.evidence or {}).get(rid),
            })
        idx, cv = indices.get(p.id), textos.get(p.id)
        oculto = bool(cv and any("ocultos" in n for n in cv.notes or []))
        candidatos.append({
            "nombre": f"{p.first_name} {p.last_name}", "puntaje": r.final_score, "cobertura": round(r.coverage, 2),
            "origen": "Se postuló" if p.id in postularon else "Base de Talento (no se postuló)",
            "recomendado": r.final_score >= 70, "motivos": r.reasons or [], "requisitos": evals,
            "alerta": ("El CV traía texto escondido (en blanco sobre blanco) que le pedía a la IA el puntaje "
                       "máximo. Se descartó antes de leerlo: no influyó en nada.") if oculto
                      else ("El perfil trae instrucciones dirigidas a la IA: se lo ordena sin IA."
                            if idx and idx.injection_flags else None),
        })

    # Un CV de ejemplo tal como le llega a la IA (sin nombre, teléfono, DNI ni fecha de nacimiento).
    # El PDF sintético repite una línea para llegar al largo mínimo: se muestra una vez.
    ejemplo = next((t for t in textos.values() if t.text and "autoelevador" in t.text.lower()), None)
    texto_ejemplo = None
    if ejemplo:
        texto_ejemplo = re.sub(r"(Responsable, puntual[^.]*\. Disponibilidad inmediata\.)(\1)+", r"\1", ejemplo.text)
    datos = {
        "disponible": True,
        "generado": datetime.now(AR_TZ).strftime("%d/%m/%Y"),
        "modelo": settings.GEMINI_GENERATION_MODEL,
        "gasto_usd": float(gasto), "llamadas": llamadas,
        "puesto": job.title, "descripcion": job.description,
        "requisitos": [{"texto": r["texto"], "tipo": r["tipo"]} for r in prof.requirements],
        "descartados": [{"texto": d["texto"], "motivo": d.get("motivo")} for d in prof.discarded],
        "cv_ejemplo": {
            "texto": texto_ejemplo[:900] if texto_ejemplo else None,
            "sacado": ejemplo.redaction_stats if ejemplo else {},
        },
        "candidatos": candidatos,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(candidatos)} candidatos · {llamadas} llamadas · USD {float(gasto):.4f} -> {SALIDA}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
