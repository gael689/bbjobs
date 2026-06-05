from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

async def set_rls_context(session: AsyncSession, user_id: uuid.UUID, role: str) -> None:
    """
    Configura el contexto de Row Level Security (RLS) para la sesión y transacción actual.
    Debe llamarse al inicio de las peticiones autenticadas que acceden a datos protegidos.
    """
    await session.execute(
        text("SET LOCAL app.current_user_id = :uid"), 
        {"uid": str(user_id)}
    )
    await session.execute(
        text("SET LOCAL app.current_role = :role"), 
        {"role": role}
    )
