"""Género preferido de la búsqueda (11/11/2026): dato interno, nunca público, sólo para ordenar a mano."""
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.models.candidate import CandidateProfile
from app.models.job import Application
from app.schemas.job import (
    JobPostingCompanyResponse, JobPostingCreate, JobPostingPublicResponse, JobPostingUpdate,
)
from app.services.applicant_search import FiltrosPostulantes, aplicar_filtros


def test_la_respuesta_publica_no_tiene_el_genero_preferido():
    assert "preferred_gender" not in JobPostingPublicResponse.model_fields
    assert "preferred_gender" in JobPostingCompanyResponse.model_fields


def test_solo_acepta_masculino_o_femenino():
    base = dict(title="t", description="d", industry_id="00000000-0000-0000-0000-000000000001",
                zone_id="00000000-0000-0000-0000-000000000001",
                contract_type_id="00000000-0000-0000-0000-000000000001", modality="presencial")
    assert JobPostingCreate(**base, preferred_gender="femenino").preferred_gender == "femenino"
    assert JobPostingCreate(**base).preferred_gender is None
    with pytest.raises(ValidationError):
        JobPostingCreate(**base, preferred_gender="otro")


def test_el_patch_puede_borrarlo_y_si_no_viene_no_lo_toca():
    assert JobPostingUpdate(preferred_gender=None).model_dump(exclude_unset=True) == {"preferred_gender": None}
    assert "preferred_gender" not in JobPostingUpdate(title="x").model_dump(exclude_unset=True)


@pytest.mark.asyncio
async def test_orden_por_genero_pone_primero_al_preferido_de_la_busqueda():
    query = (select(Application, CandidateProfile).select_from(Application)
             .join(CandidateProfile, Application.candidate_id == CandidateProfile.id))
    q = await aplicar_filtros(None, query, FiltrosPostulantes(orden="genero"), lado="empresa")
    sql = str(q.compile(dialect=postgresql.dialect())).lower()
    order_by = sql[sql.index("order by"):]
    assert "preferred_gender" in order_by and "case when" in order_by
    # Después del género, el desempate de siempre.
    assert order_by.index("preferred_gender") < order_by.index("applications.created_at desc")
