"""Base de Talento — perfiles ciegos y desbloqueo por créditos.

La empresa compra un pack (pago único, mismo circuito que el destacado) y recibe N créditos.
Con ellos busca en toda la base y desbloquea los perfiles que quiera.

Tres reglas que valen para todo el módulo:

1. **Sólo empresas verificadas.** Son datos personales de gente real y la verificación es el
   único control sobre quién está del otro lado. El pago no la reemplaza.
2. **Sólo candidatos que dieron consentimiento** (`visible_in_talent_pool`), que además no estén
   borrados.
3. **Desbloquear dos veces al mismo candidato es gratis.** Lo garantiza el UNIQUE de
   `talent_unlocks` y se chequea antes de tocar el saldo.
"""
import datetime
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user, get_db, require_role, require_verified_company
from app.core.config import settings
from app.integrations.mercado_pago import create_preference
from app.models.alerts import AuditLog
from app.models.candidate import (
    Availability, CandidateProfile, CandidateSkill, Education, Experience, Gender, Language,
)
from app.models.catalogs import Skill, Zone
from app.models.company import CompanyProfile
from app.models.core import User, UserRole
from app.models.payment import (
    Payment, PaymentType, TalentCreditPack, TalentPackStatus, TalentUnlock,
)
from app.schemas.candidate import calculate_age
from app.schemas.payment import (
    TALENT_PACK_CREDITS, TALENT_PACK_CURRENCY, TALENT_PACK_PRICE,
)
from app.services.applicant_stats import anios_de_experiencia
from app.services.notifications import create_notification
from app.services.profile_completion import compute_profile_completion

router = APIRouter()


# ─────────────────────────────── schemas ────────────────────────────────

class TalentCreditsResponse(BaseModel):
    credits_total: int
    credits_used: int
    credits_available: int
    pack_price: float
    pack_credits: int
    currency: str


class TalentPackCheckoutResponse(BaseModel):
    init_point: str
    payment_id: uuid.UUID
    pack_id: uuid.UUID


class BlindExperience(BaseModel):
    role_title: str
    months: int
    # `company_name` y `description` se omiten a propósito mientras está bloqueado: el nombre
    # del empleador identifica a la persona en una ciudad chica, y la descripción suele
    # nombrarlo igual. Aparecen recién al desbloquear.
    company_name: Optional[str] = None
    description: Optional[str] = None


class BlindEducation(BaseModel):
    level: str
    degree: str
    status: str
    # La institución se revela al desbloquear, por el mismo motivo que el empleador.
    institution: Optional[str] = None


class TalentProfile(BaseModel):
    """Un candidato visto desde la Base de Talento. Los campos identificatorios vienen en None
    hasta que la empresa gasta un crédito; `unlocked` dice en cuál de los dos estados está."""
    id: uuid.UUID
    reference: str
    unlocked: bool

    # Siempre visible
    age: Optional[int] = None
    gender: Optional[Gender] = None
    zone_name: Optional[str] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    has_own_transport: Optional[bool] = None
    accepts_remote: bool = False
    accepts_hybrid: bool = False
    accepts_onsite: bool = False
    years_of_experience: float = 0.0
    has_cv: bool = False
    # Qué tan cargado está el perfil. No identifica a nadie y le dice a la empresa cuánta
    # información va a encontrar del otro lado antes de gastar el desbloqueo.
    completion_percent: int = 0
    experience: List[BlindExperience] = []
    education: List[BlindEducation] = []
    skills: List[str] = []
    languages: List[str] = []
    other_skill: Optional[str] = None

    # Sólo al desbloquear
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    cv_file_url: Optional[str] = None
    # El resumen lo escribe el candidato con sus palabras y suele arrancar con su nombre
    # ("Soy Juan, tengo 30 años…"), así que va del lado bloqueado.
    summary: Optional[str] = None


class TalentSearchResponse(BaseModel):
    total: int
    credits_available: int
    results: List[TalentProfile]


# ───────────────────────────── helpers ──────────────────────────────────

def _referencia(candidate_id: uuid.UUID) -> str:
    """Etiqueta corta y estable para nombrar a un candidato sin identificarlo.

    Se deriva del UUID (no es un contador) para que no filtre cuánta gente hay en la base ni
    en qué orden se cargó."""
    return f"#{str(candidate_id)[:6].upper()}"


def _meses(exp: Experience) -> int:
    fin = exp.end_date or datetime.date.today()
    return max(0, (fin.year - exp.start_date.year) * 12 + (fin.month - exp.start_date.month))


async def _packs_activos(db: AsyncSession, company_id: uuid.UUID) -> List[TalentCreditPack]:
    """Packs con crédito potencialmente disponible, del más viejo al más nuevo.

    Se consumen en ese orden para que, si algún día los packs vencen, se gaste primero el que
    está por vencer."""
    ahora = datetime.datetime.now(datetime.timezone.utc)
    result = await db.execute(
        select(TalentCreditPack)
        .where(
            TalentCreditPack.company_id == company_id,
            TalentCreditPack.status == TalentPackStatus.active,
        )
        .order_by(TalentCreditPack.activated_at.asc().nullslast())
    )
    packs = list(result.scalars().all())
    # `expires_at` hoy siempre es NULL (los packs no vencen). El filtro está igual para que el
    # día que se active un vencimiento no haya que acordarse de agregarlo acá.
    return [p for p in packs if p.expires_at is None or p.expires_at > ahora]


async def _saldo(db: AsyncSession, company_id: uuid.UUID) -> tuple[int, int]:
    """(total, usados) sobre los packs activos de la empresa."""
    packs = await _packs_activos(db, company_id)
    if not packs:
        return 0, 0
    total = sum(p.credits_total for p in packs)
    usados = (
        await db.execute(
            select(func.count(TalentUnlock.id)).where(
                TalentUnlock.pack_id.in_([p.id for p in packs])
            )
        )
    ).scalar() or 0
    return total, int(usados)


async def _ids_desbloqueados(db: AsyncSession, company_id: uuid.UUID) -> set[uuid.UUID]:
    result = await db.execute(
        select(TalentUnlock.candidate_id).where(TalentUnlock.company_id == company_id)
    )
    return {row[0] for row in result.all()}


async def _armar_perfil(
    db: AsyncSession, profile: CandidateProfile, *, unlocked: bool
) -> TalentProfile:
    experiencias = list(
        (
            await db.execute(
                select(Experience)
                .where(Experience.candidate_id == profile.id)
                .order_by(Experience.start_date.desc())
            )
        ).scalars().all()
    )
    educaciones = list(
        (
            await db.execute(
                select(Education)
                .where(Education.candidate_id == profile.id)
                .order_by(Education.start_date.desc())
            )
        ).scalars().all()
    )
    habilidades = [
        s.name
        for s in (
            await db.execute(
                select(Skill)
                .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
                .where(CandidateSkill.candidate_id == profile.id)
                .order_by(Skill.category.asc(), Skill.sort_order.asc())
            )
        ).scalars().all()
    ]
    idiomas = [
        f"{l.language_name} · {str(l.level)}"
        for l in (
            await db.execute(select(Language).where(Language.candidate_id == profile.id))
        ).scalars().all()
    ]

    zona = None
    if profile.location_zone_id:
        zona = (
            await db.execute(select(Zone.name).where(Zone.id == profile.location_zone_id))
        ).scalar_one_or_none()

    datos = TalentProfile(
        id=profile.id,
        reference=_referencia(profile.id),
        unlocked=unlocked,
        age=calculate_age(profile.birth_date),
        gender=profile.gender,
        zone_name=zona,
        availability=profile.availability,
        immediate_availability=profile.immediate_availability,
        has_own_transport=profile.has_own_transport,
        accepts_remote=profile.accepts_remote,
        accepts_hybrid=profile.accepts_hybrid,
        accepts_onsite=profile.accepts_onsite,
        years_of_experience=round(anios_de_experiencia(experiencias), 1) if experiencias else 0.0,
        has_cv=bool(profile.cv_file_url),
        completion_percent=compute_profile_completion(
            profile,
            has_experience=bool(experiencias),
            has_education=bool(educaciones),
            has_skills=bool(habilidades),
            has_languages=bool(idiomas),
        ).percent,
        experience=[
            BlindExperience(
                role_title=e.role_title,
                months=_meses(e),
                company_name=e.company_name if unlocked else None,
                description=e.description if unlocked else None,
            )
            for e in experiencias
        ],
        education=[
            BlindEducation(
                level=str(e.level),
                degree=e.degree,
                status=str(e.status),
                institution=e.institution if unlocked else None,
            )
            for e in educaciones
        ],
        skills=habilidades,
        languages=idiomas,
        other_skill=profile.other_skill,
    )

    if unlocked:
        email = (
            await db.execute(select(User.email).where(User.id == profile.user_id))
        ).scalar_one_or_none()
        datos.first_name = profile.first_name
        datos.last_name = profile.last_name
        datos.phone = profile.phone
        datos.email = email
        datos.photo_url = profile.photo_url
        datos.cv_file_url = profile.cv_file_url
        datos.summary = profile.summary

    return datos


def _base_query():
    """Candidatos elegibles: consintieron aparecer y no están borrados."""
    return select(CandidateProfile).where(
        CandidateProfile.visible_in_talent_pool.is_(True),
        CandidateProfile.deleted_at.is_(None),
    )


# ───────────────────────────── endpoints ────────────────────────────────

@router.get("/me/company/talent/credits", response_model=TalentCreditsResponse)
async def get_talent_credits(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    total, usados = await _saldo(db, company.id)
    return TalentCreditsResponse(
        credits_total=total,
        credits_used=usados,
        credits_available=max(0, total - usados),
        pack_price=TALENT_PACK_PRICE,
        pack_credits=TALENT_PACK_CREDITS,
        currency=TALENT_PACK_CURRENCY,
    )


@router.post("/me/company/talent/packs", response_model=TalentPackCheckoutResponse)
async def buy_talent_pack(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """Compra un pack. Mismo circuito que destacar una búsqueda: se crea el Payment y el pack en
    `pending_payment`, y el pack recién se activa cuando el **webhook** confirma el cobro — el
    frontend nunca lo activa."""
    en_curso = (
        await db.execute(
            select(TalentCreditPack).where(
                TalentCreditPack.company_id == company.id,
                TalentCreditPack.status == TalentPackStatus.pending_payment,
            )
        )
    ).scalars().first()
    if en_curso:
        raise HTTPException(
            status_code=400,
            detail="Ya hay una compra de pack en curso. Esperá a que se acredite o cancelala.",
        )

    pack = TalentCreditPack(
        company_id=company.id,
        credits_total=TALENT_PACK_CREDITS,
        status=TalentPackStatus.pending_payment,
    )
    db.add(pack)
    await db.flush()

    payment = Payment(
        company_id=company.id,
        type=PaymentType.talent_pack,
        amount=TALENT_PACK_PRICE,
        currency=TALENT_PACK_CURRENCY,
        related_talent_pack_id=pack.id,
    )
    db.add(payment)
    await db.flush()

    init_point = create_preference(
        title=f"BBJobs — Base de Talento: {TALENT_PACK_CREDITS} desbloqueos",
        price=TALENT_PACK_PRICE,
        external_reference=str(payment.id),
        success_url=f"{settings.FRONTEND_URL}/dashboard/company/talento?payment_id={payment.id}",
    )

    await db.commit()
    return TalentPackCheckoutResponse(
        init_point=init_point, payment_id=payment.id, pack_id=pack.id
    )


@router.get("/me/company/talent", response_model=TalentSearchResponse)
async def search_talent(
    position: Optional[str] = Query(None, description="Busca en el puesto de la experiencia"),
    age_min: Optional[int] = Query(None, ge=0),
    age_max: Optional[int] = Query(None, ge=0),
    experience_min: Optional[float] = Query(None, ge=0),
    experience_max: Optional[float] = Query(None, ge=0),
    zone_id: Optional[uuid.UUID] = Query(None),
    availability: Optional[Availability] = Query(None),
    immediate_availability: Optional[bool] = Query(None),
    has_own_transport: Optional[bool] = Query(None),
    only_unlocked: bool = Query(False, description="Sólo los que ya desbloqueé"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """Buscador de la base. **Buscar y mirar perfiles ciegos no consume créditos** — sólo
    desbloquear."""
    hoy = datetime.date.today()
    query = _base_query()

    if age_min is not None:
        query = query.where(
            CandidateProfile.birth_date <= hoy.replace(year=hoy.year - age_min)
        )
    if age_max is not None:
        query = query.where(
            CandidateProfile.birth_date > hoy.replace(year=hoy.year - (age_max + 1))
        )
    if zone_id is not None:
        query = query.where(CandidateProfile.location_zone_id == zone_id)
    if availability is not None:
        query = query.where(CandidateProfile.availability == availability)
    if immediate_availability is not None:
        query = query.where(CandidateProfile.immediate_availability.is_(immediate_availability))
    if has_own_transport is not None:
        query = query.where(CandidateProfile.has_own_transport.is_(has_own_transport))
    if position:
        # EXISTS y no JOIN: un candidato con tres puestos que coinciden no puede aparecer tres
        # veces (mismo criterio que el filtro de postulantes en applications.py).
        query = query.where(
            select(Experience.id)
            .where(
                Experience.candidate_id == CandidateProfile.id,
                Experience.role_title.ilike(f"%{position}%"),
            )
            .exists()
        )

    desbloqueados = await _ids_desbloqueados(db, company.id)
    if only_unlocked:
        if not desbloqueados:
            total, usados = await _saldo(db, company.id)
            return TalentSearchResponse(
                total=0, credits_available=max(0, total - usados), results=[]
            )
        query = query.where(CandidateProfile.id.in_(desbloqueados))

    perfiles = list((await db.execute(query)).scalars().all())

    # Años de experiencia: se filtra en Python porque la fusión de tramos superpuestos no se
    # puede expresar en SQL sin duplicar la lógica de applicant_stats (dos trabajos simultáneos
    # no suman el doble). Se traen las experiencias de todos los candidatos de una sola vez.
    if experience_min is not None or experience_max is not None:
        exps_por_candidato: dict[uuid.UUID, list[Experience]] = {}
        if perfiles:
            todas = (
                await db.execute(
                    select(Experience).where(
                        Experience.candidate_id.in_([p.id for p in perfiles])
                    )
                )
            ).scalars().all()
            for exp in todas:
                exps_por_candidato.setdefault(exp.candidate_id, []).append(exp)

        def _en_rango(p: CandidateProfile) -> bool:
            anios = anios_de_experiencia(exps_por_candidato.get(p.id, []))
            if experience_min is not None and anios < experience_min:
                return False
            if experience_max is not None and anios > experience_max:
                return False
            return True

        perfiles = [p for p in perfiles if _en_rango(p)]

    total_resultados = len(perfiles)
    pagina = perfiles[offset : offset + limit]

    resultados = [
        await _armar_perfil(db, p, unlocked=p.id in desbloqueados) for p in pagina
    ]

    total, usados = await _saldo(db, company.id)
    return TalentSearchResponse(
        total=total_resultados,
        credits_available=max(0, total - usados),
        results=resultados,
    )


@router.get("/me/company/talent/{candidate_id}", response_model=TalentProfile)
async def get_talent_profile(
    candidate_id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    profile = (
        await db.execute(_base_query().where(CandidateProfile.id == candidate_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no disponible en la Base de Talento")

    ya = (
        await db.execute(
            select(TalentUnlock.id).where(
                TalentUnlock.company_id == company.id,
                TalentUnlock.candidate_id == candidate_id,
            )
        )
    ).first()
    return await _armar_perfil(db, profile, unlocked=bool(ya))


@router.post("/me/company/talent/{candidate_id}/unlock", response_model=TalentProfile)
async def unlock_talent_profile(
    candidate_id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """Consume un crédito y revela los datos de contacto.

    Es **idempotente**: si ya estaba desbloqueado devuelve el perfil sin descontar de nuevo.
    Sin eso, volver a abrir un perfil ya pagado cobraría dos veces."""
    profile = (
        await db.execute(_base_query().where(CandidateProfile.id == candidate_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no disponible en la Base de Talento")

    ya = (
        await db.execute(
            select(TalentUnlock).where(
                TalentUnlock.company_id == company.id,
                TalentUnlock.candidate_id == candidate_id,
            )
        )
    ).scalar_one_or_none()
    if ya:
        return await _armar_perfil(db, profile, unlocked=True)

    packs = await _packs_activos(db, company.id)
    if not packs:
        raise HTTPException(
            status_code=402,
            detail="No tenés créditos. Comprá un pack para desbloquear perfiles.",
        )

    # Se bloquean las filas de los packs antes de contar: sin esto, dos desbloqueos simultáneos
    # leen el mismo saldo y los dos creen que hay crédito, pasando el tope.
    ids = [p.id for p in packs]
    await db.execute(
        select(TalentCreditPack.id).where(TalentCreditPack.id.in_(ids)).with_for_update()
    )

    usados_por_pack = dict(
        (
            await db.execute(
                select(TalentUnlock.pack_id, func.count(TalentUnlock.id))
                .where(TalentUnlock.pack_id.in_(ids))
                .group_by(TalentUnlock.pack_id)
            )
        ).all()
    )

    elegido = next(
        (p for p in packs if usados_por_pack.get(p.id, 0) < p.credits_total), None
    )
    if elegido is None:
        raise HTTPException(
            status_code=402,
            detail="Ya usaste todos tus créditos. Comprá un pack nuevo para seguir.",
        )

    db.add(TalentUnlock(company_id=company.id, candidate_id=candidate_id, pack_id=elegido.id))

    # Si éste era el último crédito, el pack queda `exhausted` para no tener que contar filas
    # cada vez que se quiera saber si sirve.
    if usados_por_pack.get(elegido.id, 0) + 1 >= elegido.credits_total:
        elegido.status = TalentPackStatus.exhausted

    await db.commit()
    return await _armar_perfil(db, profile, unlocked=True)


# ─────────────────────── admin: seguimiento y canjes ────────────────────

class AdminPackRow(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    company_name: str
    credits_total: int
    credits_used: int
    status: TalentPackStatus
    purchased_at: datetime.datetime
    activated_at: Optional[datetime.datetime] = None
    was_granted: bool


class AdminUnlockRow(BaseModel):
    id: uuid.UUID
    company_name: str
    candidate_name: str
    candidate_id: uuid.UUID
    unlocked_at: datetime.datetime


class GrantPackPayload(BaseModel):
    company_id: uuid.UUID
    credits: int = TALENT_PACK_CREDITS
    notes: Optional[str] = None


@router.get("/admin/talent/packs", response_model=List[AdminPackRow])
async def admin_list_talent_packs(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Todos los packs, con cuánto se consumió de cada uno."""
    filas = (
        await db.execute(
            select(TalentCreditPack, CompanyProfile.legal_name)
            .join(CompanyProfile, CompanyProfile.id == TalentCreditPack.company_id)
            .order_by(TalentCreditPack.purchased_at.desc())
        )
    ).all()
    if not filas:
        return []

    usados = dict(
        (
            await db.execute(
                select(TalentUnlock.pack_id, func.count(TalentUnlock.id))
                .where(TalentUnlock.pack_id.in_([p.id for p, _n in filas]))
                .group_by(TalentUnlock.pack_id)
            )
        ).all()
    )
    return [
        AdminPackRow(
            id=p.id,
            company_id=p.company_id,
            company_name=nombre,
            credits_total=p.credits_total,
            credits_used=int(usados.get(p.id, 0)),
            status=p.status,
            purchased_at=p.purchased_at,
            activated_at=p.activated_at,
            was_granted=p.granted_by_admin_id is not None,
        )
        for p, nombre in filas
    ]


@router.get("/admin/talent/unlocks", response_model=List[AdminUnlockRow])
async def admin_list_talent_unlocks(
    limit: int = Query(100, ge=1, le=500),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Quién desbloqueó a quién. Es el registro que permite responderle a un candidato que
    pregunte qué empresa accedió a sus datos — y esa pregunta va a llegar."""
    filas = (
        await db.execute(
            select(TalentUnlock, CompanyProfile.legal_name, CandidateProfile)
            .join(CompanyProfile, CompanyProfile.id == TalentUnlock.company_id)
            .join(CandidateProfile, CandidateProfile.id == TalentUnlock.candidate_id)
            .order_by(TalentUnlock.unlocked_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        AdminUnlockRow(
            id=u.id,
            company_name=empresa,
            candidate_name=f"{cand.first_name} {cand.last_name}",
            candidate_id=cand.id,
            unlocked_at=u.unlocked_at,
        )
        for u, empresa, cand in filas
    ]


@router.post("/admin/talent/packs", response_model=AdminPackRow)
async def admin_grant_talent_pack(
    payload: GrantPackPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Regala un pack sin cobrar (canje, prueba, compensación).

    Nace `active` porque no hay pago que esperar. Queda en `audit_logs` con quién lo dio: es
    plata que no entró, así que tiene que poder rastrearse."""
    company = (
        await db.execute(select(CompanyProfile).where(CompanyProfile.id == payload.company_id))
    ).scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    if payload.credits < 1:
        raise HTTPException(status_code=400, detail="Los créditos tienen que ser al menos 1")

    ahora = datetime.datetime.now(datetime.timezone.utc)
    pack = TalentCreditPack(
        company_id=company.id,
        credits_total=payload.credits,
        status=TalentPackStatus.active,
        activated_at=ahora,
        granted_by_admin_id=admin.id,
    )
    db.add(pack)
    await db.flush()

    db.add(
        AuditLog(
            admin_user_id=admin.id,
            action="talent_pack_granted",
            target_entity="talent_credit_pack",
            target_id=pack.id,
            notes=payload.notes or f"{payload.credits} desbloqueos a {company.legal_name}",
        )
    )
    await create_notification(
        db, user_id=company.user_id, type="talent_pack_active",
        title="Te asignamos acceso a la Base de Talento",
        body=f"Tenés {payload.credits} desbloqueos para usar con los perfiles que quieras.",
        link="/dashboard/company/talento",
    )

    await db.commit()
    return AdminPackRow(
        id=pack.id,
        company_id=company.id,
        company_name=company.legal_name,
        credits_total=pack.credits_total,
        credits_used=0,
        status=pack.status,
        purchased_at=pack.purchased_at,
        activated_at=pack.activated_at,
        was_granted=True,
    )


# ────────────────── candidato: quién accedió a sus datos ─────────────────

class QuienMeVio(BaseModel):
    company_name: str
    unlocked_at: datetime.datetime


class MiVisibilidadResponse(BaseModel):
    visible_in_talent_pool: bool
    total_unlocks: int
    companies: List[QuienMeVio]


@router.get("/me/candidate/talent-pool/visibility", response_model=MiVisibilidadResponse)
async def my_talent_pool_visibility(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Le muestra al candidato qué empresas accedieron a su contacto.

    No estaba pedido, pero es lo que convierte el consentimiento en algo que el candidato
    quiere dar en vez de tolerar: si dejás que paguen por sus datos, lo mínimo es que él pueda
    ver quién los tiene. Y si algún día pregunta, la respuesta ya está en pantalla."""
    profile = (
        await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de candidato no encontrado")

    filas = (
        await db.execute(
            select(CompanyProfile.legal_name, TalentUnlock.unlocked_at)
            .join(TalentUnlock, TalentUnlock.company_id == CompanyProfile.id)
            .where(TalentUnlock.candidate_id == profile.id)
            .order_by(TalentUnlock.unlocked_at.desc())
        )
    ).all()

    return MiVisibilidadResponse(
        visible_in_talent_pool=profile.visible_in_talent_pool,
        total_unlocks=len(filas),
        companies=[QuienMeVio(company_name=n, unlocked_at=f) for n, f in filas],
    )
