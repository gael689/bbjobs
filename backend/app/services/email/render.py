"""Armado del HTML y el texto plano de cada mail.

Los clientes de mail no soportan CSS moderno (Outlook usa el motor de Word), así que el layout
es una tabla con estilos inline. Dos reglas de seguridad:

- **Todo lo que viene de un usuario se escapa.** El nombre de una empresa, el título de una
  búsqueda o el texto de una campaña terminan dentro de un mail con la marca de BBJobs: sin
  escapar, es un vector directo de inyección de HTML.
- **Las variables `{{x}}` se reemplazan en texto plano, antes de escapar.** Así una variable
  nunca puede traer markup, y el texto de las plantillas editables no ejecuta nada: es
  sustitución de strings, sin lógica.
"""
import html
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from app.core.config import settings

TEAL = "#1E8EA3"
# El fondo del botón es el teal oscuro: con texto blanco, #1E8EA3 da 3,85:1 (no llega al AA de
# 4,5) y #187B8E da 4,93:1. El teal de marca queda para el logo, que es texto grande.
BUTTON = "#187B8E"
TEXT = "#1C2230"
MUTED = "#64748B"
BORDER = "#DDE3EC"
BG = "#FAFBFD"
# La marca no es sólo celeste: el logo lleva acentos cálidos y la paleta, el naranja pastel.
SECONDARY = "#D4B7A2"
SECONDARY_LIGHT = "#F7EFE9"
LOGO_PATH = "/logo.png"

_VAR_RE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")
_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
TAGLINE = "BBJobs. El talento de Bahía, más cerca."
INITIATIVE = "Una iniciativa de Talency."
_FONT = "'DM Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


@dataclass
class EmailItem:
    """Una fila de un resumen: título (con link opcional) y un detalle corto."""
    title: str
    detail: str | None = None
    url: str | None = None


@dataclass
class RenderedEmail:
    html: str
    text: str


def substitute(template: str, variables: dict[str, str]) -> str:
    """Reemplaza `{{variable}}`. Una variable desconocida se deja vacía: preferible a mandar
    "{{nombre}}" literal a mil personas."""
    return _VAR_RE.sub(lambda m: variables.get(m.group(1), ""), template)


def absolute_url(link: str | None) -> str | None:
    """`/dashboard/...` → URL completa del frontend. Sólo http(s): un `javascript:` en el CTA
    de una campaña no debe llegar a un mail."""
    if not link:
        return None
    # `//host` es una URL "relativa al protocolo" que apunta a otro dominio, no una ruta nuestra.
    if link.startswith("/") and not link.startswith("//"):
        return f"{settings.FRONTEND_URL.rstrip('/')}{link}"
    parsed = urlparse(link)
    if parsed.scheme in ("http", "https") and parsed.netloc:
        return link
    return None


def _inline(text: str) -> str:
    """Escapa y después convierte `**texto**` en negrita. El orden importa: primero se escapa,
    así el marcado nunca puede abrir una etiqueta propia. Las variables de usuario llegan sin
    asteriscos (`copy.clean_value`), así que la negrita sólo sale del texto fijo."""
    escaped = html.escape(text).replace(chr(10), "<br>")
    return _BOLD_RE.sub(r"<strong>\1</strong>", escaped)


def strip_bold(text: str) -> str:
    return _BOLD_RE.sub(r"\1", text)


def _paragraphs(body: str) -> list[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", body.strip()) if p.strip()]


def render_email(
    *,
    heading: str,
    body: str,
    cta_label: str | None = None,
    cta_url: str | None = None,
    preheader: str | None = None,
    image_url: str | None = None,
    unsubscribe_url: str | None = None,
    footer_note: str | None = None,
    items: list[EmailItem] | None = None,
    greeting: str | None = None,
    manage_url: str | None = None,
    item_cta: str | None = None,
) -> RenderedEmail:
    """`body` es texto plano: párrafos separados por línea en blanco, saltos simples = <br>."""
    cta_url = absolute_url(cta_url)
    image_url = absolute_url(image_url)
    manage_url = absolute_url(manage_url)
    e = html.escape

    paragraphs_html = "".join(
        f'<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:{TEXT};">{_inline(p)}</p>'
        for p in _paragraphs(body)
    )
    greeting_html = (
        f'<p style="margin:0 0 8px;font-size:16px;line-height:1.5;color:{TEXT};">{e(greeting)}</p>'
        if greeting else ""
    )
    image_html = (
        f'<img src="{e(image_url, quote=True)}" alt="" width="520" '
        f'style="display:block;width:100%;max-width:520px;height:auto;border-radius:8px;margin:0 0 20px;">'
        if image_url else ""
    )
    cta_html = (
        f'<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 8px;"><tr>'
        f'<td style="background:{BUTTON};border-radius:8px;">'
        f'<a href="{e(cta_url, quote=True)}" style="display:inline-block;padding:12px 24px;'
        f'font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">{e(cta_label or "Ver más")}</a>'
        f'</td></tr></table>'
        if cta_url else ""
    )
    items_html = ""
    if items:
        rows = []
        for it in items:
            link = absolute_url(it.url)
            title = (f'<a href="{e(link, quote=True)}" style="color:{BUTTON};font-weight:600;text-decoration:none;">'
                     f'{e(it.title)}</a>') if link else f'<strong style="color:{TEXT};">{e(it.title)}</strong>'
            detail = (f'<div style="font-size:14px;color:{MUTED};margin-top:2px;">{e(it.detail)}</div>'
                      if it.detail else "")
            if link and item_cta:
                detail += (f'<div style="margin-top:4px;"><a href="{e(link, quote=True)}" '
                           f'style="font-size:14px;color:{BUTTON};text-decoration:underline;">{e(item_cta)}</a></div>')
            rows.append(f'<tr><td style="padding:10px 0;border-top:1px solid {BORDER};font-size:15px;'
                        f'line-height:1.4;">{title}{detail}</td></tr>')
        items_html = ('<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
                      f'style="margin:0 0 16px;">{"".join(rows)}</table>')
    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{e(preheader)}</div>'
        if preheader else ""
    )
    # Firma de Talency (PDF de Eugenia, 08/10/2026) y, abajo, los links de preferencias.
    footer_lines = [f'<strong style="font-size:14px;">{e(TAGLINE)}</strong>', e(INITIATIVE)]
    if footer_note:
        footer_lines.append(e(footer_note))
    links = []
    if manage_url:
        links.append(f'<a href="{e(manage_url, quote=True)}" style="color:{TEXT};">Administrar notificaciones</a>')
    if unsubscribe_url:
        links.append(f'<a href="{e(unsubscribe_url, quote=True)}" style="color:{TEXT};">'
                     f'Dejar de recibir estos mails</a>')
    if links:
        footer_lines.append(" · ".join(links))
    footer_html = "<br>".join(footer_lines)
    logo_url = absolute_url(LOGO_PATH)
    logo_html = (
        f'<td style="padding-right:8px;vertical-align:middle;"><img src="{e(logo_url, quote=True)}" alt="" '
        f'width="26" height="32" style="display:block;width:26px;height:32px;"></td>'
        if logo_url else ""
    )

    document = (
        f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{e(heading)}</title></head>'
        f'<body style="margin:0;padding:0;background:{BG};font-family:{_FONT};">'
        f'{preheader_html}'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{BG};">'
        f'<tr><td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" width="560" cellspacing="0" cellpadding="0" '
        f'style="width:100%;max-width:560px;background:#ffffff;border:1px solid {BORDER};border-radius:12px;'
        f'overflow:hidden;">'
        # Encabezado como el del sitio: el logo y "BB" celeste + "JOBS" oscuro, en itálica. Si el
        # cliente bloquea imágenes, la marca escrita se sigue leyendo.
        f'<tr><td style="padding:20px 32px 16px;border-bottom:4px solid {SECONDARY};">'
        f'<table role="presentation" cellspacing="0" cellpadding="0"><tr>'
        f'{logo_html}'
        f'<td style="font-size:24px;font-weight:800;font-style:italic;letter-spacing:-0.5px;color:{TEXT};">'
        f'<span style="color:{TEAL};">BB</span>JOBS</td></tr></table></td></tr>'
        f'<tr><td style="padding:24px 32px 8px;">'
        f'{greeting_html}'
        f'<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:{TEXT};">{e(heading)}</h1>'
        f'{image_html}{paragraphs_html}{items_html}{cta_html}</td></tr>'
        f'<tr><td style="padding:16px 32px 24px;background:{SECONDARY_LIGHT};'
        f'font-size:12px;line-height:1.6;color:{TEXT};">{footer_html}</td></tr>'
        f'</table></td></tr></table></body></html>'
    )

    text_parts = ([greeting, ""] if greeting else []) + [heading, "", strip_bold(body.strip())]
    for it in items or []:
        link = absolute_url(it.url)
        text_parts.append("")
        text_parts.append(f"- {it.title}" + (f" ({it.detail})" if it.detail else ""))
        if link:
            text_parts.append(f"  {(item_cta + ': ') if item_cta else ''}{link}")
    if cta_url:
        text_parts += ["", f"{cta_label or 'Ver más'}: {cta_url}"]
    text_parts += ["", TAGLINE, INITIATIVE]
    if footer_note:
        text_parts.append(footer_note)
    if manage_url:
        text_parts.append(f"Administrar notificaciones: {manage_url}")
    if unsubscribe_url:
        text_parts.append(f"Dejar de recibir estos mails: {unsubscribe_url}")
    return RenderedEmail(html=document, text="\n".join(text_parts))
