from pydantic import BaseModel
from typing import List
import uuid
from app.models.catalogs import SkillCategory


class SkillResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    category: SkillCategory

    class Config:
        from_attributes = True


class SkillCatalogResponse(BaseModel):
    """El catálogo ya agrupado, ordenado y con sus reglas.

    Viene todo junto a propósito: el tope de 6, la lista de idiomas y el largo del texto libre
    los necesitan tanto el perfil del candidato como el wizard de la empresa, y si cada pantalla
    los hardcodea por su cuenta terminan desincronizados con el backend que los valida.
    """
    soft: List[SkillResponse]
    technical: List[SkillResponse]
    max_per_category: int
    languages: List[str]
    other_skill_max_length: int
