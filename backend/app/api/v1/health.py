import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

router = APIRouter()
logger = structlog.get_logger("app.api.health")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.get("/health/db")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    """Chequeo de vida de la base. Es público: lo consulta el hosting.

    NO devuelve el error real. Un fallo de conexión de asyncpg trae adentro el
    host, el puerto, el usuario y el nombre de la base — y este endpoint lo
    contesta a cualquiera que lo pida. El detalle va al log, donde lo vemos
    nosotros; afuera sale que la base no responde y nada más.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception:
        logger.exception("health_check_db_failed")
        return {"status": "error", "db": "unreachable"}
