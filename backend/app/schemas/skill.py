from pydantic import BaseModel
from typing import Optional
import uuid
from app.models.catalogs import SkillStatus

class SkillResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: SkillStatus

    class Config:
        from_attributes = True

class SkillSuggest(BaseModel):
    name: str
