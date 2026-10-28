"""Estrella de postulantes (empresa y Talency), "ya lo vi" de Talency e índices del buscador

Pedido de Eugenia (22/10/2026, BUSCADOR-Y-SEGUIMIENTO-POSTULANTES-PLAN.md §3):

- `applications.company_starred_at` / `admin_starred_at` (+ `admin_starred_by`): la estrella de
  cada lado. Privada: no avisa al postulante y ningún endpoint de candidato la devuelve.
- `applications.admin_seen_at`: el "ya lo vi" de Talency, separado del `seen_at` de la empresa.
- Trigramas GIN sobre el nombre completo del candidato y el puesto y la empresa de sus
  experiencias. Dentro de una búsqueda no hacen falta (≤ 666 postulantes, ya entra por
  `ix_applications_job_posting_id`); son para `/admin/candidates`, que busca entre todos. Misma
  expresión que usa `services/applicant_search.py` (`f_unaccent(lower(...))`), si no Postgres
  no los usa.

Sin `CONCURRENTLY`, por lo explicado en `c1b7e4a90d52`. Columnas nulas sin default: en Postgres
agregarlas no reescribe la tabla.

Revision ID: b3f8d1e6a2c4
Revises: a9e3f1c5b7d2
Create Date: 2026-10-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3f8d1e6a2c4"
down_revision: Union[str, None] = "a9e3f1c5b7d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("applications", sa.Column("company_starred_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column("admin_starred_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("applications", sa.Column(
        "admin_starred_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("applications", sa.Column("admin_seen_at", sa.DateTime(timezone=True), nullable=True))

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_candidate_profiles_nombre_trgm ON candidate_profiles "
        "USING gin (public.f_unaccent(lower(first_name || ' ' || last_name)) public.gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_experiences_role_title_trgm ON experiences "
        "USING gin (public.f_unaccent(lower(role_title)) public.gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_experiences_company_name_trgm ON experiences "
        "USING gin (public.f_unaccent(lower(company_name)) public.gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_experiences_company_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_experiences_role_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_candidate_profiles_nombre_trgm")
    op.drop_column("applications", "admin_seen_at")
    op.drop_column("applications", "admin_starred_by")
    op.drop_column("applications", "admin_starred_at")
    op.drop_column("applications", "company_starred_at")
