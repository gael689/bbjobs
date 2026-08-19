"""Suma "Industria" al catálogo de rubros (que en pantalla pasa a llamarse "Sector")

Pedido de Eugenia (bbjobs2.pdf, punto 10, confirmado el 18/08/2026): *"Industria sería una
opción NUEVA entre todas las categorías, y en vez de 'Industria *' ahí se llamaría 'Sector'"*.

Es la lectura A del plan del 14/08: **no** es un campo nuevo, es una opción más de la lista
que ya existe. La tabla sigue llamándose `industries` y ninguna columna cambia — lo único que
se mueve en el código es la etiqueta que ve el usuario.

En Bahía Blanca la industria es de los rubros que más emplea y no estaba en la lista; una
búsqueda del polo o de una metalúrgica no tenía dónde clasificarse salvo en "Otro".

El INSERT es idempotente (`WHERE NOT EXISTS` por slug) porque el catálogo de producción no
se sembró con `seed.py` — algunas filas, como "Otro", se cargaron por fuera, así que no se
puede asumir que el contenido de la tabla sea exactamente el de `seed.py`.

Revision ID: b5c9e0a3f712
Revises: a8d2f6c1e534
Create Date: 2026-08-18

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "b5c9e0a3f712"
down_revision: Union[str, None] = "a8d2f6c1e534"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NOMBRE = "Industria"
SLUG = "industria"


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO industries (id, name, slug, is_active) "
            "SELECT :id, :name, :slug, true "
            "WHERE NOT EXISTS (SELECT 1 FROM industries WHERE slug = :slug)"
        ).bindparams(id=uuid.uuid4(), name=NOMBRE, slug=SLUG)
    )


def downgrade() -> None:
    # Sólo se borra si nadie la usó todavía. Si hay búsquedas o empresas clasificadas como
    # "Industria" la FK es RESTRICT y el DELETE fallaría; y `job_alerts` la tiene en CASCADE,
    # así que un borrado ciego le vaciaría la alerta a un candidato sin avisar. En cualquiera
    # de esos casos se desactiva, que es como el resto del catálogo saca una opción de
    # circulación sin perder los datos que la referencian.
    op.execute(
        sa.text(
            "UPDATE industries SET is_active = false WHERE slug = :slug"
        ).bindparams(slug=SLUG)
    )
    op.execute(
        sa.text(
            "DELETE FROM industries WHERE slug = :slug "
            "AND NOT EXISTS (SELECT 1 FROM job_postings WHERE industry_id = industries.id) "
            "AND NOT EXISTS (SELECT 1 FROM company_profiles WHERE industry_id = industries.id) "
            "AND NOT EXISTS (SELECT 1 FROM job_alerts WHERE industry_id = industries.id)"
        ).bindparams(slug=SLUG)
    )
