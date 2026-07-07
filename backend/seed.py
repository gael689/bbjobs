"""
Run: python seed.py
Creates initial catalog data + admin user in the Railway DB.
"""
import asyncio
import os
import re
import unicodedata
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from app.core.config import settings
from app.integrations.clerk_client import create_clerk_user
from app.models import (
    Base, User, AdminProfile, Industry, Zone, ContractType,
    Plan, UserRole,
)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text)


INDUSTRIES = [
    "Tecnología", "Comercio", "Salud", "Educación", "Construcción",
    "Gastronomía", "Administración", "Marketing", "Recursos Humanos", "Logística",
]

ZONES = [
    "Bahía Blanca", "Monte Hermoso", "Punta Alta", "Coronel Suárez",
    "Zona Norte", "Zona Sur",
]

CONTRACT_TYPES = [
    "Relación de dependencia", "Freelance", "Pasantía", "Temporal",
]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@bbjobs.com.ar")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin1234!")


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Industries
        for name in INDUSTRIES:
            existing = await db.execute(select(Industry).where(Industry.name == name))
            if not existing.scalar_one_or_none():
                db.add(Industry(name=name, slug=slugify(name)))
        await db.flush()
        print(f"  OK Industries ({len(INDUSTRIES)})")

        # Zones
        for name in ZONES:
            existing = await db.execute(select(Zone).where(Zone.name == name))
            if not existing.scalar_one_or_none():
                db.add(Zone(name=name, slug=slugify(name)))
        await db.flush()
        print(f"  OK Zones ({len(ZONES)})")

        # Contract types
        for name in CONTRACT_TYPES:
            existing = await db.execute(select(ContractType).where(ContractType.name == name))
            if not existing.scalar_one_or_none():
                db.add(ContractType(name=name))
        await db.flush()
        print(f"  OK Contract types ({len(CONTRACT_TYPES)})")

        # Free plan
        plan_result = await db.execute(select(Plan).where(Plan.code == "free"))
        if not plan_result.scalar_one_or_none():
            db.add(Plan(
                name="Free",
                code="free",
                monthly_price=0,
                currency="ARS",
                max_active_job_postings=3,
                included_featured_per_month=0,
                includes_psychometric_results=False,
                includes_observatory_full=False,
            ))
            await db.flush()
        print("  OK Free plan")

        # Admin user (creado en Clerk vía Backend API — Clerk es dueño de las credenciales)
        admin_result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if not admin_result.scalar_one_or_none():
            clerk_user_id = create_clerk_user(
                email=ADMIN_EMAIL,
                password=ADMIN_PASSWORD,
                first_name="Admin",
                public_metadata={"role": "admin"},
            )
            admin = User(
                email=ADMIN_EMAIL,
                clerk_user_id=clerk_user_id,
                role=UserRole.admin,
                is_active=True,
                email_verified_at=datetime.now(timezone.utc),
            )
            db.add(admin)
            await db.flush()
            db.add(AdminProfile(user_id=admin.id, full_name="Admin BBJobs"))
            print(f"  OK Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            print(f"  - Admin ya existe: {ADMIN_EMAIL}")

        await db.commit()

    await engine.dispose()
    print("\nSeed completado.")


if __name__ == "__main__":
    asyncio.run(seed())
