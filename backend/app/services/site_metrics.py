"""Medición propia del sitio: limpieza de eventos entrantes y agregados para el panel de admin.

Entrada (`parse_batch`): el navegador manda lotes de hasta 20 eventos. Todo se valida campo por
campo y lo que no sirve **se descarta**, nunca se rechaza con error: un evento raro no puede
tirar un 500 ni un 422 (el navegador ni siquiera lee la respuesta de un beacon).

Qué NO se guarda, por diseño: IP, user agent completo, user_id, Referer. Del user agent sale sólo
`device` (mobile/desktop) y si es un bot (se descarta el lote); del Referer sólo la categoría
`source`.

Origen: `navigator.sendBeacon` manda como Referer la página actual (bbjobs), no de dónde vino la
persona. Por eso el frontend manda `referrer` (= document.referrer) en la primera vista de cada
carga de página; acá se clasifica y se tira. Si el evento no lo trae, se usa el header Referer
(que en un beacon es la propia página → "interno").

Zona horaria: Argentina, UTC-3 fija (sin horario de verano desde 2009). Los días del panel se
cortan a medianoche de Argentina, nunca de UTC.
"""
from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlsplit

from sqlalchemy import and_, case, distinct, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Application, JobPosting
from app.models.metrics import SiteEvent

MAX_EVENTS = 20
MAX_BODY_BYTES = 32 * 1024
ALLOWED_EVENTS = frozenset({
    "page_view", "search", "view_item", "apply", "sign_up", "generate_lead", "publish_job",
})
# Eventos que sin aviso no significan nada (no suman a "avisos más vistos" ni al embudo).
NEEDS_JOB = frozenset({"view_item", "apply"})
# Vistas que no son del sitio público: el panel y la vista previa no se miden.
PRIVATE_PREFIXES = ("/dashboard", "/vista-previa")

AR_OFFSET = timedelta(hours=-3)
AR_TZ = timezone(AR_OFFSET)
RETENTION = "13 months"

_BOT_UA = re.compile(
    r"bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|"
    r"whatsapp|telegram|embedly|python|curl|wget|httpclient|okhttp|java/|go-http|scrapy|"
    r"phantom|selenium|puppeteer|monitor|uptime|pingdom|archive|semrush|ahrefs|mj12",
    re.I,
)
_MOBILE_UA = re.compile(r"mobi|android|iphone|ipad|ipod|windows phone", re.I)
_LABEL = re.compile(r"^[a-z0-9_]{1,30}$")

_IA_HOSTS = ("chatgpt.com", "chat.openai.com", "perplexity.ai", "gemini.google.com", "claude.ai",
             "copilot.microsoft.com")
_REDES_HOSTS = ("facebook.com", "fb.com", "fb.me", "instagram.com", "linkedin.com", "lnkd.in",
                "whatsapp.com", "wa.me", "t.co", "x.com", "twitter.com", "tiktok.com")
INTERNAL_HOSTS = ("bbjobs.com.ar",)

SOURCES = ("google", "bing", "redes", "ia", "directo", "otro", "interno")


def _host_matches(host: str, domains: tuple[str, ...]) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def classify_source(referrer: str | None, internal_hosts: tuple[str, ...] = INTERNAL_HOSTS) -> str:
    """Categoría de origen a partir de una URL de referencia. El URL en sí no se guarda."""
    if not referrer or not referrer.strip():
        return "directo"
    try:
        host = (urlsplit(referrer.strip()).hostname or "").lower()
    except ValueError:
        return "otro"
    if not host:
        return "otro"
    if _host_matches(host, internal_hosts):
        return "interno"
    if _host_matches(host, _IA_HOSTS):  # antes que google: gemini.google.com es IA
        return "ia"
    if re.search(r"(^|\.)google\.[a-z.]+$", host):
        return "google"
    if _host_matches(host, ("bing.com",)):
        return "bing"
    if _host_matches(host, _REDES_HOSTS):
        return "redes"
    return "otro"


def is_bot(user_agent: str | None) -> bool:
    return not user_agent or bool(_BOT_UA.search(user_agent))


def device_of(user_agent: str | None) -> str:
    return "mobile" if user_agent and _MOBILE_UA.search(user_agent) else "desktop"


def normalize_term(value: object) -> str | None:
    """Minúsculas, sin tildes (ñ → n, igual que f_unaccent del buscador), espacios colapsados."""
    if not isinstance(value, str):
        return None
    sin_tildes = "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))
    limpio = " ".join(sin_tildes.lower().split())
    return limpio[:100] or None


def clean_path(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    path = value.strip().split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/") or path.startswith("//"):
        return None
    if len(path) > 1:
        path = path.rstrip("/")
    return path[:300]


def _uuid(value: object) -> uuid.UUID | None:
    if not isinstance(value, str) or len(value) > 36:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _id36(value: object) -> str | None:
    u = _uuid(value)
    return str(u) if u else None


def _results(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if 0 <= value <= 1_000_000 else None


def _label(raw: dict) -> str | None:
    for key in ("method", "topic", "label"):
        value = raw.get(key)
        if isinstance(value, str) and _LABEL.match(value.strip().lower()):
            return value.strip().lower()
    return None


def parse_event(raw: object, *, device: str, header_referer: str | None,
                internal_hosts: tuple[str, ...] = INTERNAL_HOSTS) -> SiteEvent | None:
    """Un evento del navegador → fila lista para guardar, o None si no sirve."""
    if not isinstance(raw, dict):
        return None
    event = raw.get("event")
    if event not in ALLOWED_EVENTS:
        return None
    path = clean_path(raw.get("path"))
    if path is None:
        return None
    if event == "page_view" and path.startswith(PRIVATE_PREFIXES):
        return None
    job_id = _uuid(raw.get("job_id"))
    if event in NEEDS_JOB and job_id is None:
        return None
    if "referrer" in raw:
        ref = raw.get("referrer")
        source = classify_source(ref if isinstance(ref, str) else None, internal_hosts)
    else:
        source = classify_source(header_referer, internal_hosts)
    return SiteEvent(
        event=event,
        path=path,
        job_id=job_id,
        search_term=normalize_term(raw.get("search_term")) if event == "search" else None,
        results=_results(raw.get("results")) if event == "search" else None,
        label=_label(raw) if event in ("sign_up", "generate_lead") else None,
        source=source,
        device=device,
        visitor_id=_id36(raw.get("visitor_id")),
        session_id=_id36(raw.get("session_id")),
    )


def parse_batch(payload: object, *, user_agent: str | None, header_referer: str | None,
                internal_hosts: tuple[str, ...] = INTERNAL_HOSTS) -> list[SiteEvent]:
    if is_bot(user_agent):
        return []
    if isinstance(payload, dict):
        payload = payload.get("events")
    if not isinstance(payload, list):
        return []
    device = device_of(user_agent)
    out = []
    for raw in payload[:MAX_EVENTS]:
        ev = parse_event(raw, device=device, header_referer=header_referer, internal_hosts=internal_hosts)
        if ev is not None:
            out.append(ev)
    return out


# ---------------------------------------------------------------------------------------------
# Agregados para el panel
# ---------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Period:
    start: datetime  # UTC, incluido
    end: datetime    # UTC, excluido
    first_day: date  # en hora de Argentina
    days: int


def periods(days: int, now: datetime | None = None) -> tuple[Period, Period]:
    """El período actual (hoy en Argentina + los `days - 1` días anteriores) y el anterior, del
    mismo largo, para comparar."""
    now = now or datetime.now(timezone.utc)
    today_ar = now.astimezone(AR_TZ).date()
    first = today_ar - timedelta(days=days - 1)
    start = datetime.combine(first, time(0), tzinfo=AR_TZ).astimezone(timezone.utc)
    end = datetime.combine(today_ar + timedelta(days=1), time(0), tzinfo=AR_TZ).astimezone(timezone.utc)
    prev_first = first - timedelta(days=days)
    prev = Period(start - timedelta(days=days), start, prev_first, days)
    return Period(start, end, first, days), prev


def local_day(column):
    """Fecha en Argentina (UTC-3 fija) de un timestamptz. `timezone('UTC', ts)` lo pasa a hora UTC
    sin zona; restarle 3 horas da la hora de Argentina, independiente del TimeZone de la sesión."""
    return func.date(func.timezone("UTC", column) - literal_column("interval '3 hours'"))


def _in(period: Period):
    return and_(SiteEvent.created_at >= period.start, SiteEvent.created_at < period.end)


async def _totals(db: AsyncSession, period: Period) -> dict:
    def count_of(name: str):
        return func.count().filter(SiteEvent.event == name)

    row = (await db.execute(
        select(
            count_of("page_view"),
            func.count(distinct(SiteEvent.visitor_id)),
            count_of("search"),
            count_of("view_item"),
            count_of("apply"),
            count_of("sign_up"),
            count_of("generate_lead"),
            count_of("publish_job"),
        ).where(_in(period))
    )).one()
    keys = ("visitas", "visitantes", "busquedas", "avisos_vistos", "postulaciones", "registros",
            "contactos", "publicaciones")
    return dict(zip(keys, (int(v or 0) for v in row)))


async def build_report(db: AsyncSession, days: int, now: datetime | None = None) -> dict:
    cur, prev = periods(days, now)
    in_cur = _in(cur)

    totals = await _totals(db, cur)
    prev_totals = await _totals(db, prev)

    # Registros por tipo (candidato / empresa)
    reg_rows = (await db.execute(
        select(SiteEvent.label, func.count())
        .where(in_cur, SiteEvent.event == "sign_up")
        .group_by(SiteEvent.label)
    )).all()
    registros_por_tipo = {(label or "sin_dato"): int(n) for label, n in reg_rows}

    # Serie diaria (hora de Argentina), con los días vacíos en cero.
    day = local_day(SiteEvent.created_at).label("dia")
    serie_rows = (await db.execute(
        select(day, func.count(), func.count(distinct(SiteEvent.visitor_id)))
        .where(in_cur, SiteEvent.event == "page_view")
        .group_by(day)
    )).all()
    por_dia = {d: (int(v), int(u)) for d, v, u in serie_rows}
    serie = []
    for i in range(days):
        d = cur.first_day + timedelta(days=i)
        v, u = por_dia.get(d, (0, 0))
        serie.append({"fecha": d.isoformat(), "visitas": v, "visitantes": u})

    # Orígenes: sólo entradas al sitio (las navegaciones internas no dicen de dónde llegó nadie).
    origen_rows = (await db.execute(
        select(SiteEvent.source, func.count())
        .where(in_cur, SiteEvent.event == "page_view", SiteEvent.source != "interno")
        .group_by(SiteEvent.source)
        .order_by(func.count().desc())
    )).all()
    origenes = [{"origen": s, "visitas": int(n)} for s, n in origen_rows]

    disp_rows = (await db.execute(
        select(SiteEvent.device, func.count())
        .where(in_cur, SiteEvent.event == "page_view")
        .group_by(SiteEvent.device)
        .order_by(func.count().desc())
    )).all()
    dispositivos = [{"dispositivo": d, "visitas": int(n)} for d, n in disp_rows]

    # Páginas más vistas: las fichas de empleo (/empleos/<slug>-<id>) se agrupan en una sola fila;
    # el detalle por aviso está en "avisos más vistos".
    pagina = case((SiteEvent.path.like("/empleos/%"), literal_column("'/empleos/*'")), else_=SiteEvent.path)
    pag_rows = (await db.execute(
        select(pagina.label("p"), func.count())
        .where(in_cur, SiteEvent.event == "page_view")
        .group_by(literal_column("p"))
        .order_by(func.count().desc(), literal_column("p"))
        .limit(10)
    )).all()
    paginas = [{"path": p, "fichas": p == "/empleos/*", "visitas": int(n)} for p, n in pag_rows]

    busq_rows = (await db.execute(
        select(SiteEvent.search_term, func.count(), func.avg(SiteEvent.results))
        .where(in_cur, SiteEvent.event == "search", SiteEvent.search_term.is_not(None))
        .group_by(SiteEvent.search_term)
        .order_by(func.count().desc(), SiteEvent.search_term)
        .limit(15)
    )).all()
    busquedas = [
        {"termino": t, "veces": int(n), "resultados_promedio": round(float(avg), 1) if avg is not None else None}
        for t, n, avg in busq_rows
    ]

    sin_rows = (await db.execute(
        select(SiteEvent.search_term, func.count())
        .where(in_cur, SiteEvent.event == "search", SiteEvent.search_term.is_not(None), SiteEvent.results == 0)
        .group_by(SiteEvent.search_term)
        .order_by(func.count().desc(), SiteEvent.search_term)
        .limit(15)
    )).all()
    sin_resultados = [{"termino": t, "veces": int(n)} for t, n in sin_rows]

    # Avisos más vistos, con las postulaciones reales del período (tabla applications: cuentan
    # también las de quienes no aceptaron la medición, por eso la conversión puede pasar el 100%).
    vistos_rows = (await db.execute(
        select(SiteEvent.job_id, func.count())
        .where(in_cur, SiteEvent.event == "view_item", SiteEvent.job_id.is_not(None))
        .group_by(SiteEvent.job_id)
        .order_by(func.count().desc(), SiteEvent.job_id)
        .limit(10)
    )).all()
    avisos = []
    if vistos_rows:
        ids = [j for j, _ in vistos_rows]
        info = {
            j.id: j for j in (await db.execute(
                select(JobPosting).where(JobPosting.id.in_(ids))
            )).scalars().all()
        }
        apps = dict((await db.execute(
            select(Application.job_posting_id, func.count())
            .where(Application.job_posting_id.in_(ids),
                   Application.created_at >= cur.start, Application.created_at < cur.end)
            .group_by(Application.job_posting_id)
        )).all())
        for job_id, vistas in vistos_rows:
            job = info.get(job_id)
            post = int(apps.get(job_id, 0))
            avisos.append({
                "job_id": str(job_id),
                "titulo": job.title if job else None,
                "empresa": job.company_legal_name_snapshot if job else None,
                "estado": (job.status.value if hasattr(job.status, "value") else job.status) if job else None,
                "vistas": int(vistas),
                "postulaciones": post,
                "conversion": round(post / vistas, 4) if vistas else None,
            })

    # Embudo por visitante (id anónimo): visitaron → vieron un aviso → se postularon.
    embudo_row = (await db.execute(
        select(
            func.count(distinct(SiteEvent.visitor_id)),
            func.count(distinct(SiteEvent.visitor_id)).filter(SiteEvent.event == "view_item"),
            func.count(distinct(SiteEvent.visitor_id)).filter(SiteEvent.event == "apply"),
        ).where(in_cur, SiteEvent.visitor_id.is_not(None))
    )).one()
    embudo = {
        "visitantes": int(embudo_row[0] or 0),
        "vieron_aviso": int(embudo_row[1] or 0),
        "se_postularon": int(embudo_row[2] or 0),
    }

    primer = (await db.execute(select(func.min(SiteEvent.created_at)))).scalar_one_or_none()

    return {
        "dias": days,
        "desde": cur.first_day.isoformat(),
        "hasta": (cur.first_day + timedelta(days=days - 1)).isoformat(),
        "datos_desde": primer.astimezone(AR_TZ).date().isoformat() if primer else None,
        "totales": totals,
        "totales_anteriores": prev_totals,
        "registros_por_tipo": registros_por_tipo,
        "serie": serie,
        "origenes": origenes,
        "dispositivos": dispositivos,
        "paginas": paginas,
        "busquedas": busquedas,
        "busquedas_sin_resultados": sin_resultados,
        "avisos": avisos,
        "embudo": embudo,
    }


def retention_cutoff():
    """Expresión SQL del corte de retención (13 meses atrás)."""
    return func.now() - literal_column(f"interval '{RETENTION}'")
