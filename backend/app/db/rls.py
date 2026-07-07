from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid

async def set_rls_context(session: AsyncSession, user_id: uuid.UUID, role: str) -> None:
    # SET LOCAL does not support bind parameters — values must be inlined.
    # Safe here: user_id is a UUID (no injection risk) and role comes from our enum.
    uid = str(user_id).replace("'", "")
    safe_role = role.replace("'", "")
    await session.execute(text(f"SET LOCAL app.current_user_id = '{uid}'"))
    await session.execute(text(f"SET LOCAL app.user_role = '{safe_role}'"))
