"""Medición para la auditoría del RAG. SOLO LECTURA y SOLO AGREGADOS (sin datos personales)."""
import asyncio, os, sys
sys.path.insert(0, os.getcwd())
import asyncpg
from app.core.config import settings

Q = {
 "pg_version": "SHOW server_version",
 "pgvector": "SELECT coalesce(json_agg(row_to_json(t))::text,'[]') FROM (SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name='vector') t",
 # --- candidatos
 "cand_total": "SELECT count(*) FROM candidate_profiles WHERE deleted_at IS NULL",
 "cand_con_cv": "SELECT count(*) FROM candidate_profiles WHERE deleted_at IS NULL AND cv_file_url IS NOT NULL",
 "cand_cv_pdf_ext": "SELECT lower(coalesce(substring(cv_file_url from '\\.([A-Za-z0-9]{2,5})(\\?|$)'),'(sin ext)')) ext, count(*) FROM candidate_profiles WHERE deleted_at IS NULL AND cv_file_url IS NOT NULL GROUP BY 1 ORDER BY 2 DESC",
 "cand_con_summary": "SELECT count(*) FILTER (WHERE length(coalesce(summary,''))>0), percentile_cont(0.5) WITHIN GROUP (ORDER BY length(summary)) FILTER (WHERE length(coalesce(summary,''))>0), max(length(summary)) FROM candidate_profiles WHERE deleted_at IS NULL",
 "cand_con_zona": "SELECT count(*) FILTER (WHERE location_zone_id IS NOT NULL) FROM candidate_profiles WHERE deleted_at IS NULL",
 "cand_modalidades": "SELECT count(*) FILTER (WHERE accepts_onsite), count(*) FILTER (WHERE accepts_hybrid), count(*) FILTER (WHERE accepts_remote), count(*) FILTER (WHERE NOT accepts_onsite AND NOT accepts_hybrid AND NOT accepts_remote) FROM candidate_profiles WHERE deleted_at IS NULL",
 "cand_disponibilidad": "SELECT coalesce(availability,'(null)'), count(*) FROM candidate_profiles WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC",
 "cand_talent_pool": "SELECT count(*) FILTER (WHERE visible_in_talent_pool) FROM candidate_profiles WHERE deleted_at IS NULL",
 "cand_skills_dist": "SELECT n, count(*) FROM (SELECT c.id, count(cs.skill_id) n FROM candidate_profiles c LEFT JOIN candidate_skills cs ON cs.candidate_id=c.id WHERE c.deleted_at IS NULL GROUP BY c.id) t GROUP BY n ORDER BY n",
 "cand_exp_dist": "SELECT least(n,6) n, count(*) FROM (SELECT c.id, count(e.id) n FROM candidate_profiles c LEFT JOIN experiences e ON e.candidate_id=c.id WHERE c.deleted_at IS NULL GROUP BY c.id) t GROUP BY 1 ORDER BY 1",
 "exp_desc_len": "SELECT count(*), count(*) FILTER (WHERE length(coalesce(description,''))>0), percentile_cont(0.5) WITHIN GROUP (ORDER BY length(description)) FILTER (WHERE length(coalesce(description,''))>0) FROM experiences",
 "cand_edu_dist": "SELECT least(n,4) n, count(*) FROM (SELECT c.id, count(e.id) n FROM candidate_profiles c LEFT JOIN educations e ON e.candidate_id=c.id WHERE c.deleted_at IS NULL GROUP BY c.id) t GROUP BY 1 ORDER BY 1",
 "cand_nada": "SELECT count(*) FROM candidate_profiles c WHERE c.deleted_at IS NULL AND c.cv_file_url IS NULL AND length(coalesce(c.summary,''))=0 AND NOT EXISTS(SELECT 1 FROM experiences e WHERE e.candidate_id=c.id) AND NOT EXISTS(SELECT 1 FROM candidate_skills s WHERE s.candidate_id=c.id)",
 "cand_solo_cv": "SELECT count(*) FROM candidate_profiles c WHERE c.deleted_at IS NULL AND c.cv_file_url IS NOT NULL AND length(coalesce(c.summary,''))=0 AND NOT EXISTS(SELECT 1 FROM experiences e WHERE e.candidate_id=c.id) AND NOT EXISTS(SELECT 1 FROM candidate_skills s WHERE s.candidate_id=c.id)",
 "cand_altas_por_mes": "SELECT to_char(date_trunc('month',created_at),'YYYY-MM'), count(*) FROM candidate_profiles GROUP BY 1 ORDER BY 1 DESC LIMIT 6",
 "cand_cv_cambios_30d": "SELECT count(*) FROM candidate_profiles WHERE deleted_at IS NULL AND cv_uploaded_at > now() - interval '30 days'",
 "cand_upd_30d": "SELECT count(*) FROM candidate_profiles WHERE deleted_at IS NULL AND updated_at > now() - interval '30 days'",
 # --- catálogo
 "skills_catalogo": "SELECT category, count(*) FROM skills WHERE is_active GROUP BY 1",
 "skills_top": "SELECT s.name, count(*) FROM candidate_skills cs JOIN skills s ON s.id=cs.skill_id GROUP BY 1 ORDER BY 2 DESC LIMIT 8",
 # --- búsquedas
 "jobs_estado": "SELECT status, moderation_status, count(*) FROM job_postings WHERE deleted_at IS NULL GROUP BY 1,2 ORDER BY 3 DESC",
 "jobs_skills": "SELECT count(*) jobs, count(*) FILTER (WHERE nreq>0) con_oblig, count(*) FILTER (WHERE nopt>0) con_deseables, avg(nreq) prom_oblig, avg(nopt) prom_des FROM (SELECT j.id, count(*) FILTER (WHERE js.is_required) nreq, count(*) FILTER (WHERE js.is_required=false) nopt FROM job_postings j LEFT JOIN job_posting_skills js ON js.job_posting_id=j.id WHERE j.deleted_at IS NULL GROUP BY j.id) t",
 "jobs_min_exp_edu": "SELECT count(*), count(*) FILTER (WHERE min_experience_years IS NOT NULL), count(*) FILTER (WHERE min_education_level IS NOT NULL) FROM job_postings WHERE deleted_at IS NULL",
 "jobs_modalidad": "SELECT modality, count(*) FROM job_postings WHERE deleted_at IS NULL GROUP BY 1",
 "jobs_desc_len": "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY length(description)), max(length(description)) FROM job_postings WHERE deleted_at IS NULL",
 "jobs_por_mes": "SELECT to_char(date_trunc('month',created_at),'YYYY-MM'), count(*) FROM job_postings GROUP BY 1 ORDER BY 1 DESC LIMIT 6",
 # --- postulaciones (set de evaluación)
 "apps_total": "SELECT count(*) FROM applications WHERE deleted_at IS NULL",
 "apps_estado": "SELECT status, count(*) FROM applications WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC",
 "apps_por_job": "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY n), max(n), count(*) FILTER (WHERE n>30) FROM (SELECT job_posting_id, count(*) n FROM applications WHERE deleted_at IS NULL GROUP BY 1) t",
 "eval_jobs_con_final_o_sel": "SELECT count(DISTINCT job_posting_id) FROM applications WHERE deleted_at IS NULL AND status IN ('finalist','selected')",
 "eval_jobs_con_sel": "SELECT count(DISTINCT job_posting_id) FROM applications WHERE deleted_at IS NULL AND status='selected'",
 "eval_hist_alguna_vez_final_sel": "SELECT count(DISTINCT a.job_posting_id) FROM application_status_history h JOIN applications a ON a.id=h.application_id WHERE h.to_status IN ('finalist','selected')",
 "eval_jobs_con_avance": "SELECT count(DISTINCT job_posting_id) FROM applications WHERE deleted_at IS NULL AND status IN ('contacted','in_process','finalist','selected')",
 "eval_positivos_por_job": "SELECT job_posting_id IS NOT NULL, percentile_cont(0.5) WITHIN GROUP (ORDER BY pos), percentile_cont(0.5) WITHIN GROUP (ORDER BY tot) FROM (SELECT job_posting_id, count(*) FILTER (WHERE status IN ('contacted','in_process','finalist','selected')) pos, count(*) tot FROM applications WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) FILTER (WHERE status IN ('contacted','in_process','finalist','selected'))>0) t GROUP BY 1",
 "apps_por_mes": "SELECT to_char(date_trunc('month',created_at),'YYYY-MM'), count(*) FROM applications GROUP BY 1 ORDER BY 1 DESC LIMIT 6",
 # --- alertas, unlocks
 "job_alerts": "SELECT count(*) FROM job_alerts",
 "talent_unlocks": "SELECT count(*) FROM talent_unlocks",
 "companies_verificadas": "SELECT verification_status, count(*) FROM company_profiles GROUP BY 1",
}

async def main():
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(url)
    try:
        async with conn.transaction(readonly=True):
            for k, q in Q.items():
                try:
                    rows = await conn.fetch(q)
                    print(f"{k}: " + " | ".join(str(tuple(r.values())) for r in rows))
                except Exception as e:
                    print(f"{k}: ERROR {type(e).__name__}: {e}")
    finally:
        await conn.close()

asyncio.run(main())
