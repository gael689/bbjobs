"""Índices de rendimiento

Los once índices que faltaban sobre las columnas por las que la app filtra y ordena todo el
tiempo: las claves foráneas de los datos del candidato (experiencias, educaciones, idiomas), las
postulaciones por búsqueda, las búsquedas por empresa, el listado público, la zona del candidato,
la cola de verificación de empresas, los pagos y los mensajes de contacto sin resolver.

**No son una mejora de hoy, son un seguro.** Con 12 búsquedas y 143 candidatos Postgres elige
*seq scan* porque es el plan correcto, y va a seguir ignorando estos índices hasta que las tablas
crezcan. Se agregan ahora porque el día que el volumen los haga necesarios, agregarlos va a ser
sobre tablas grandes y con el portal en uso.

**Por qué NO va `CONCURRENTLY`.** `alembic/env.py` corre sobre asyncpg con
`async_engine_from_config`, y el truco de `op.execute("COMMIT")` para salir de la transacción es
de la era psycopg2 síncrono: con SQLAlchemy 2.x + asyncpg desincroniza el estado de transacción
del driver. Además el `CMD` del Dockerfile es `alembic upgrade head && uvicorn`, así que una
migración a medio aplicar **deja el servidor sin levantar**: `CONCURRENTLY` que falla deja el
índice en estado `INVALID` y el reintento muere con "already exists". Sobre tablas de 12 a 1.057
filas un `CREATE INDEX` normal tarda milisegundos y no bloquea nada perceptible — `CONCURRENTLY`
no compra nada acá y trae ese riesgo.

Dos ausencias deliberadas:

- **`candidate_skills` no lleva índice**: su clave primaria ya es `(candidate_id, skill_id)`.
- **No hay índice parcial para la Base de Talento** (`visible_in_talent_pool`): 128 de 143
  candidatos dieron consentimiento. Un índice parcial que cubre el 90% de la tabla no ahorra
  nada.

Lo que estos índices **no** arreglan: todos los buscadores por texto del portal son
`ILIKE '%…%'`, y ningún B-tree sirve para eso. Haría falta `pg_trgm` + GIN, y la extensión no
está instalada.

Revision ID: c1b7e4a90d52
Revises: d7f4a1c8e620
Create Date: 2026-08-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1b7e4a90d52"
down_revision: Union[str, None] = "d7f4a1c8e620"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Todo lo que cuelga de un candidato y se pide por candidate_id: el perfil, el listado de
    # postulantes y el cálculo de "perfil completo".
    op.create_index("ix_experiences_candidate_id", "experiences", ["candidate_id"])
    op.create_index("ix_educations_candidate_id", "educations", ["candidate_id"])
    op.create_index("ix_languages_candidate_id", "languages", ["candidate_id"])

    # Los postulantes de una búsqueda. El único índice que hay hoy sobre applications es
    # (candidate_id, job_posting_id), que no sirve para filtrar sólo por la búsqueda.
    op.create_index("ix_applications_job_posting_id", "applications", ["job_posting_id"])

    op.create_index("ix_job_postings_company_id", "job_postings", ["company_id"])

    # El listado público de empleos, tal como lo arma jobs.py: filtra por estado y moderación,
    # descarta las borradas, y ordena destacadas primero y después por fecha. Las cuatro
    # columnas van en ese orden y con esa dirección porque un índice sólo evita el paso de Sort
    # si su orden coincide exactamente con el del ORDER BY.
    op.create_index(
        "ix_job_postings_publicas",
        "job_postings",
        [
            "status",
            "moderation_status",
            sa.text("is_featured DESC"),
            sa.text("published_at DESC"),
        ],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_index("ix_candidate_profiles_zone", "candidate_profiles", ["location_zone_id"])

    # La cola de verificación del panel de Talency: empresas por estado, las verificadas más
    # recientes primero.
    op.create_index(
        "ix_company_profiles_verificacion",
        "company_profiles",
        ["verification_status", sa.text("verified_at DESC")],
    )

    # El webhook de Mercado Pago resuelve el destacado desde el pago, y el historial de la
    # empresa se pide por (empresa, tipo de pago).
    op.create_index("ix_job_features_payment_id", "job_features", ["payment_id"])
    op.create_index("ix_payments_company_type", "payments", ["company_id", "type"])

    # Los mensajes de contacto sin resolver, los más nuevos arriba — es la bandeja de entrada
    # del panel.
    op.create_index(
        "ix_contact_messages_pendientes",
        "contact_messages",
        ["resolved", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_contact_messages_pendientes", table_name="contact_messages")
    op.drop_index("ix_payments_company_type", table_name="payments")
    op.drop_index("ix_job_features_payment_id", table_name="job_features")
    op.drop_index("ix_company_profiles_verificacion", table_name="company_profiles")
    op.drop_index("ix_candidate_profiles_zone", table_name="candidate_profiles")
    op.drop_index("ix_job_postings_publicas", table_name="job_postings")
    op.drop_index("ix_job_postings_company_id", table_name="job_postings")
    op.drop_index("ix_applications_job_posting_id", table_name="applications")
    op.drop_index("ix_languages_candidate_id", table_name="languages")
    op.drop_index("ix_educations_candidate_id", table_name="educations")
    op.drop_index("ix_experiences_candidate_id", table_name="experiences")
