"""
Reporte de identidades de Clerk sin User local, y emails con más de una identidad
en Clerk (colisión — ver docs/planning/backend/09-migracion-clerk-auth.md, workstream
de onboarding). Sólo reporta, no borra ni modifica nada.

Uso: python scripts/find_orphaned_clerk_identities.py
"""
import asyncio
import os
from collections import defaultdict

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.integrations.clerk_client import get_clerk_client
from app.models.core import User

PAGE_SIZE = 500


def _primary_email(user) -> str | None:
    for addr in user.email_addresses:
        if addr.id == user.primary_email_address_id:
            return addr.email_address
    return user.email_addresses[0].email_address if user.email_addresses else None


def fetch_all_clerk_users() -> list:
    client = get_clerk_client()
    users = []
    offset = 0
    while True:
        page = client.users.list(request={"limit": PAGE_SIZE, "offset": offset})
        if not page:
            break
        users.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return users


async def main():
    clerk_users = fetch_all_clerk_users()
    print(f"Identidades en Clerk: {len(clerk_users)}")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        result = await db.execute(select(User.clerk_user_id).where(User.clerk_user_id.is_not(None)))
        local_clerk_ids = {row[0] for row in result.fetchall()}
    await engine.dispose()

    print(f"Users locales con clerk_user_id: {len(local_clerk_ids)}\n")

    by_email = defaultdict(list)
    orphaned = []
    for u in clerk_users:
        email = _primary_email(u)
        by_email[email].append(u.id)
        if u.id not in local_clerk_ids:
            orphaned.append((u.id, email))

    print("=== Identidades huérfanas (en Clerk, sin User local — onboarding nunca se completó) ===")
    if not orphaned:
        print("  Ninguna.")
    for clerk_id, email in orphaned:
        print(f"  {clerk_id}  {email}")

    print("\n=== Emails con más de una identidad en Clerk (colisión) ===")
    collisions = {email: ids for email, ids in by_email.items() if len(ids) > 1}
    if not collisions:
        print("  Ninguno.")
    for email, ids in collisions.items():
        print(f"  {email}: {ids}")


if __name__ == "__main__":
    asyncio.run(main())
