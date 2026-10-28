"""Notas de la empresa en cada postulación y marca de "automático" en el historial de estados

- `application_notes`: observación **privada** de una empresa sobre una persona (siempre
  privada; Eugenia, 22/10/2026). Asociada al candidato dentro de la empresa (`candidate_id`);
  `application_id` es opcional y sólo dice de qué búsqueda salió. `company_id` es redundante
  a propósito: el filtro por empresa no depende de un JOIN. `body` admite NULL porque el
  borrado de cuenta del candidato lo vacía (igual que `cover_letter`).
- `application_status_history.automatico`: el paso a "Perfil revisado" que hace la plataforma
  sola cuando la empresa abre el perfil o el CV ("Vieron tu CV").

Ver AVISOS-POR-ACCION-Y-NOTAS-PLAN.md §2–§3.

Revision ID: b6e2d9a4c7f1
Revises: f9c3d5e7a1b2
Create Date: 2026-10-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "b6e2d9a4c7f1"
down_revision: Union[str, None] = "f9c3d5e7a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "application_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", UUID(as_uuid=True),
                  sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("application_id", UUID(as_uuid=True),
                  sa.ForeignKey("applications.id", ondelete="SET NULL"), nullable=True),
        sa.Column("company_id", UUID(as_uuid=True),
                  sa.ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("tags", ARRAY(sa.String(30)), nullable=False, server_default="{}"),
        sa.Column("status_at_time", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("body IS NULL OR char_length(body) <= 1000", name="ck_application_notes_body_len"),
    )
    op.create_index("ix_application_notes_candidate_id", "application_notes", ["candidate_id"])
    op.create_index("ix_application_notes_application_id", "application_notes", ["application_id"])
    op.create_index("ix_application_notes_company_id", "application_notes", ["company_id"])
    op.create_index("ix_application_notes_company_candidate", "application_notes",
                    ["company_id", "candidate_id", "created_at"])

    op.add_column("application_status_history",
                  sa.Column("automatico", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("application_status_history", "automatico")
    op.drop_index("ix_application_notes_company_candidate", table_name="application_notes")
    op.drop_index("ix_application_notes_company_id", table_name="application_notes")
    op.drop_index("ix_application_notes_application_id", table_name="application_notes")
    op.drop_index("ix_application_notes_candidate_id", table_name="application_notes")
    op.drop_table("application_notes")
