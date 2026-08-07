"""Catálogo de habilidades en dos grupos (blandas/técnicas), con seed

Reestructura `skills` para el pedido de Eugenia (agosto/2026):
  - dos grupos, tope de 6 por grupo (el tope se valida en la app, no acá)
  - catálogo cerrado curado por Talency: se elimina el flujo de "sugerir habilidad → aprobar"
    (la pantalla del admin ya no existía desde julio y su notificación llevaba a un 404)
  - se elimina el nivel autoevaluado por habilidad
  - texto libre corto para la habilidad "Otra"

Se puede reestructurar la tabla sin contemplaciones porque estaba **vacía**: verificado contra
producción el 06/08/2026 — 0 skills, 0 candidate_skills, 0 job_posting_skills. Nunca se sembró
ninguna habilidad, y ese era justamente el bug de "no se despliegan habilidades".

Lo que sí tiene datos son los **idiomas** (13 registros de candidatos reales). Como ahora los
idiomas se cargan detrás de la habilidad técnica "Idiomas", el downgrade/upgrade preserva esa
tabla y el upgrade le asigna la habilidad "Idiomas" a quien ya tenga idiomas cargados — si no,
esos 13 candidatos quedarían con idiomas visibles pero sin la habilidad que los explica.

Revision ID: f1a4c7e2b9d8
Revises: 4b8f2c1a6e33
Create Date: 2026-08-06

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "f1a4c7e2b9d8"
down_revision: Union[str, None] = "4b8f2c1a6e33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Copia congelada de app/data/skills_catalog.py al 06/08/2026. Una migración de datos no debe
# importar código de la app: si mañana el catálogo cambia, va una migración nueva.
BLANDAS = [
    ("comunicacion-efectiva", "Comunicación efectiva"),
    ("trabajo-en-equipo", "Trabajo en equipo"),
    ("responsabilidad-y-compromiso", "Responsabilidad y compromiso"),
    ("organizacion-y-gestion-del-tiempo", "Organización y gestión del tiempo"),
    ("proactividad-e-iniciativa", "Proactividad e iniciativa"),
    ("adaptabilidad-y-flexibilidad", "Adaptabilidad y flexibilidad"),
    ("resolucion-de-problemas", "Resolución de problemas"),
    ("pensamiento-analitico-y-critico", "Pensamiento analítico y crítico"),
    ("orientacion-al-cliente", "Orientación al cliente"),
    ("orientacion-a-resultados", "Orientación a resultados"),
    ("atencion-al-detalle", "Atención al detalle"),
    ("autonomia", "Autonomía"),
    ("liderazgo", "Liderazgo"),
    ("negociacion", "Negociación"),
    ("empatia-y-escucha-activa", "Empatía y escucha activa"),
    ("capacidad-de-aprendizaje", "Capacidad de aprendizaje"),
]

TECNICAS = [
    ("excel", "Excel"),
    ("herramientas-de-oficina", "Herramientas de oficina: Word, PowerPoint y Google Workspace"),
    ("sistemas-de-gestion-erp", "Sistemas de gestión / ERP"),
    ("facturacion-y-cobranzas", "Facturación y cobranzas"),
    ("contabilidad-y-conciliaciones", "Contabilidad y conciliaciones"),
    ("manejo-de-caja-y-posnet", "Manejo de caja y posnet"),
    ("atencion-al-cliente", "Atención al cliente"),
    ("ventas", "Ventas"),
    ("crm-y-cartera-de-clientes", "CRM y gestión de cartera de clientes"),
    ("compras-y-proveedores", "Compras y gestión de proveedores"),
    ("control-de-stock-e-inventarios", "Control de stock e inventarios"),
    ("recepcion-despacho-y-pedidos", "Recepción, despacho y preparación de pedidos"),
    ("manejo-de-autoelevador", "Manejo de autoelevador"),
    ("produccion-y-maquinaria", "Producción y manejo de maquinaria"),
    ("mantenimiento-industrial", "Mantenimiento industrial"),
    ("electricidad", "Electricidad"),
    ("mecanica-y-electromecanica", "Mecánica y electromecánica"),
    ("soldadura", "Soldadura"),
    ("lectura-de-planos", "Lectura e interpretación de planos"),
    ("seguridad-e-higiene", "Seguridad e higiene"),
    ("manipulacion-de-alimentos", "Manipulación de alimentos"),
    ("limpieza-y-desinfeccion", "Limpieza y desinfección"),
    ("redes-sociales-y-marketing-digital", "Redes sociales y marketing digital"),
    ("diseno-grafico-canva", "Diseño gráfico / Canva"),
    ("programacion-y-desarrollo-web", "Programación y desarrollo web"),
    ("soporte-tecnico-y-redes", "Soporte técnico y redes informáticas"),
    ("analisis-de-datos-power-bi", "Análisis de datos / Power BI"),
    ("idiomas", "Idiomas"),
    ("operacion-de-maquinaria-pesada", "Operación de maquinaria pesada"),
    ("automatizacion-con-ia", "Automatización de tareas con IA"),
    ("otra", "Otra"),
]


def upgrade() -> None:
    # ── skills: columnas nuevas ────────────────────────────────────────────────
    op.add_column("skills", sa.Column("slug", sa.String(255), nullable=True))
    op.add_column("skills", sa.Column("category", sa.String(50), nullable=True))
    op.add_column("skills", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("skills", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    # ── skills: fuera lo del flujo de sugerencias ──────────────────────────────
    op.drop_column("skills", "merged_into_id")
    op.drop_column("skills", "created_by_user_id")
    op.drop_column("skills", "approved_by_admin_id")
    op.drop_column("skills", "status")

    # ── seed del catálogo ──────────────────────────────────────────────────────
    skills_tbl = sa.table(
        "skills",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("category", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    filas = [
        {
            "id": uuid.uuid4(),
            "name": nombre,
            "slug": slug,
            "category": categoria,
            "sort_order": i,
            "is_active": True,
        }
        for categoria, lista in (("soft", BLANDAS), ("technical", TECNICAS))
        for i, (slug, nombre) in enumerate(lista)
    ]
    op.bulk_insert(skills_tbl, filas)

    # Recién ahora se pueden poner NOT NULL: ya no hay filas sin slug/category.
    op.alter_column("skills", "slug", nullable=False)
    op.alter_column("skills", "category", nullable=False)
    op.create_index("ix_skills_slug", "skills", ["slug"], unique=True)

    # ── candidate_skills: se va el nivel autoevaluado ──────────────────────────
    op.drop_column("candidate_skills", "level")

    # ── texto libre de la habilidad "Otra" ─────────────────────────────────────
    op.add_column("candidate_profiles", sa.Column("other_skill", sa.String(80), nullable=True))

    # ── backfill: quien ya tenía idiomas cargados, se queda con la habilidad ───
    # Sin esto, los 13 idiomas ya cargados quedarían huérfanos: el perfil mostraría idiomas
    # sin la habilidad "Idiomas" que ahora es su puerta de entrada.
    op.execute(
        """
        INSERT INTO candidate_skills (candidate_id, skill_id)
        SELECT DISTINCT l.candidate_id, s.id
        FROM languages l
        CROSS JOIN skills s
        WHERE s.slug = 'idiomas'
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM candidate_skills")
    op.drop_column("candidate_profiles", "other_skill")
    op.add_column("candidate_skills", sa.Column("level", sa.String(50), nullable=False, server_default="básico"))
    op.alter_column("candidate_skills", "level", server_default=None)

    op.execute("DELETE FROM skills")
    op.drop_index("ix_skills_slug", table_name="skills")
    op.drop_column("skills", "is_active")
    op.drop_column("skills", "sort_order")
    op.drop_column("skills", "category")
    op.drop_column("skills", "slug")

    op.add_column("skills", sa.Column("status", sa.String(50), nullable=False, server_default="pending"))
    op.alter_column("skills", "status", server_default=None)
    op.add_column("skills", sa.Column("approved_by_admin_id", sa.Uuid(), nullable=True))
    op.add_column("skills", sa.Column("created_by_user_id", sa.Uuid(), nullable=True))
    op.add_column("skills", sa.Column("merged_into_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(None, "skills", "users", ["approved_by_admin_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key(None, "skills", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key(None, "skills", "skills", ["merged_into_id"], ["id"], ondelete="SET NULL")
