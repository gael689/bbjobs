"""Buscador: extensiones unaccent + pg_trgm, función f_unaccent e índices de trigramas

Frente 5 de MAILS-SEO-IA-OCTUBRE-PLAN.md. El buscador de /empleos compara todo como
`f_unaccent(lower(campo))` (sin tildes ni mayúsculas) y tolera errores de tipeo en el título con
`word_similarity` de pg_trgm. Ver `app/services/job_search.py`.

- `f_unaccent(text)`: `unaccent()` es STABLE (depende del search_path para encontrar el
  diccionario), así que no se puede usar en un índice. El patrón estándar es envolverla en una
  función IMMUTABLE que nombra el diccionario con su esquema (`public.unaccent`). Si algún día se
  mueve la extensión a otro esquema, hay que recrear la función y los índices.
  Además pasa a minúsculas **después** de sacar tildes: con una base en locale `C` (la local de
  desarrollo lo es) `lower('É')` devuelve `É` sin tocar, y `unaccent` lo deja en `E` mayúscula.
  Así `f_unaccent(lower(x))` da lo mismo en cualquier locale.
- Índices GIN `gin_trgm_ops` sobre el título y el nombre de la empresa: sirven para `LIKE '%x%'`
  y para los operadores de similitud. Con el volumen de hoy (cientos de avisos) el planner puede
  preferir el escaneo secuencial; están para cuando crezca.
- **Downgrade**: borra los índices y la función, pero **no** las extensiones. `unaccent` y
  `pg_trgm` son de toda la base, otra migración o una consulta manual pueden depender de ellas,
  y dejarlas instaladas no cambia ningún comportamiento. Si hiciera falta sacarlas, a mano:
  `DROP EXTENSION pg_trgm; DROP EXTENSION unaccent;`.
- El interruptor `busqueda_ia_activa` (site_settings) **no** necesita datos: la tabla es
  clave-valor y una clave sin fila vale su default (apagado), igual que los otros interruptores.

**Permisos (Railway, Postgres 16)**: hoy la app se conecta como superusuario, así que
`CREATE EXTENSION` funciona desde la migración. Si se pasa a un rol de mínimo privilegio
(SEGURIDAD-PLAN.md bloque E), las extensiones tiene que crearlas el owner de la base antes de
correr esta migración (el `IF NOT EXISTS` hace que acá no falle), y la función queda del rol que
corra la migración.

Revision ID: c7d1e5f9a2b4
Revises: b6e2d9a4c7f1
Create Date: 2026-10-08
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c7d1e5f9a2b4"
down_revision: Union[str, None] = "b6e2d9a4c7f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.f_unaccent(text)
        RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $func$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $func$
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_job_postings_title_trgm ON job_postings "
        "USING gin (public.f_unaccent(lower(title)) public.gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_job_postings_company_name_trgm ON job_postings "
        "USING gin (public.f_unaccent(lower(company_legal_name_snapshot)) public.gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_job_postings_company_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_job_postings_title_trgm")
    op.execute("DROP FUNCTION IF EXISTS public.f_unaccent(text)")
    # Las extensiones quedan instaladas a propósito (ver docstring).
