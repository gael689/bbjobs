"""Genera los datos de la vista previa para Eugenia (`/vista-previa/<clave>` en el frontend).

Los mails salen del código real: `catalog.RULES` (qué aviso, a quién, cuándo) y
`outbox.build_content` / `render.render_email` (el HTML que recibiría la persona). Los textos de
cada aviso son los mismos que escribe cada pantalla del sistema al disparar la notificación.
Los nombres de personas y empresas de los ejemplos son inventados; no se lee ninguna base.

Uso (desde backend/):  python scripts/generar_vista_previa.py
Escribe frontend/src/vista-previa/datos/avisos.json
"""
from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402

settings.FRONTEND_URL = "https://www.bbjobs.com.ar"

from app.services.email.catalog import RULES  # noqa: E402
from app.services.email.outbox import build_content  # noqa: E402
from app.services.email.render import EmailItem, render_email  # noqa: E402
from app.services.email.tokens import unsubscribe_page_url  # noqa: E402

SALIDA = Path(__file__).resolve().parents[2] / "frontend" / "src" / "vista-previa" / "datos" / "avisos.json"
UID = uuid.UUID("00000000-0000-0000-0000-000000000001")
JOB = "Operario/a de depósito con autoelevador"

# tipo: (destinatario, cuándo ocurre, título, cuerpo, link)
INSTANT: dict[str, tuple[str, str, str, str, str | None]] = {
    # ── Postulante ──
    "welcome_candidate": ("candidato", "Apenas se registra", "Bienvenido/a a BBJobs",
        "Completá tu perfil y cargá tu CV: es lo primero que miran las empresas. Después podés postularte con un clic y armar alertas para enterarte de las búsquedas nuevas.",
        "/dashboard/candidate/perfil"),
    "application_sent": ("candidato", "Cuando se postula", "Te postulaste",
        f"Tu postulación a '{JOB}' llegó a la empresa.", "/dashboard/candidate/postulaciones"),
    "application_contacted": ("candidato", "La empresa lo marca como contactado", "Una empresa te contactó",
        f"La empresa de '{JOB}' se va a comunicar con vos.", "/dashboard/candidate/postulaciones"),
    "application_in_process": ("candidato", "La empresa lo pasa a entrevistas", "Tu postulación avanzó",
        f"Sobre '{JOB}': estás en proceso de selección.", "/dashboard/candidate/postulaciones"),
    "application_finalist": ("candidato", "La empresa lo marca finalista", "¡Llegaste a la final!",
        f"Sobre '{JOB}': sos uno de los finalistas.", "/dashboard/candidate/postulaciones"),
    "application_selected": ("candidato", "La empresa lo selecciona", "¡Te seleccionaron!",
        f"Sobre '{JOB}'.", "/dashboard/candidate/postulaciones"),
    "application_discarded": ("candidato", "La empresa descarta la postulación (sale 24 h después, si sigue descartada). Si la empresa dejó una nota visible, va adentro",
        "Novedades en tu postulación",
        f"Tu postulación a '{JOB}' no avanzó en esta oportunidad. ¡Seguí participando en otras búsquedas!\n\n"
        "Mensaje de la empresa: buscamos a alguien con carnet de autoelevador vigente. ¡Gracias por postularte!",
        "/dashboard/candidate/postulaciones"),
    "application_seen": ("candidato", "La empresa abre por primera vez su perfil o su CV desde la postulación (uno por día como máximo)",
        "Una empresa vio tu CV", f"Logística Sur revisó tu perfil para la búsqueda '{JOB}'.",
        "/dashboard/candidate/postulaciones"),
    "application_note": ("candidato", "La empresa le deja un mensaje visible sin cambiar el estado (las notas privadas no avisan nada; uno por día como máximo)",
        "La empresa te dejó un mensaje",
        f"Logística Sur te dejó un mensaje sobre tu postulación a '{JOB}':\n\n"
        "Gracias por postularte. La semana que viene llamamos a entrevistas.",
        "/dashboard/candidate/postulaciones"),
    "profile_incomplete": ("candidato", "Perfil incompleto (se corta tras 3 mails sin cambios)", "Tu perfil está incompleto",
        "Tu perfil está 60% completo. Las empresas ven que te falta cargar datos — completalo para destacar frente a otros candidatos.",
        "/dashboard/candidate/perfil"),
    "talent_profile_unlocked": ("candidato", "Una empresa abre su perfil en la Base de Talento", "Una empresa vio tu perfil completo",
        "Una empresa de la Base de Talento desbloqueó tu perfil. Puede que te contacte.", "/dashboard/candidate/perfil"),
    "candidate_reactivation": ("candidato", "Hace semanas que no entra", "¿Seguís buscando trabajo?",
        "Hay búsquedas nuevas en BBJobs. Si tu CV cambió, actualizalo para que las empresas vean lo último.", "/empleos"),
    "cv_review_paid": ("candidato", "Paga la Revisión de CV", "Recibimos tu pago de la revisión de CV",
        "Talency te va a contactar en las próximas 48 horas hábiles para revisar tu CV. La devolución es por WhatsApp o mail, fuera de la plataforma.",
        "/dashboard/candidate/revision-cv"),
    "cv_review_payment_rejected": ("candidato", "El pago de la Revisión de CV no se acredita", "El pago de la revisión de CV no se acreditó",
        "Podés volver a intentarlo desde tu panel.", "/dashboard/candidate/revision-cv"),
    "cv_review_in_progress": ("candidato", "Talency toma la revisión", "Talency ya está revisando tu CV",
        "En breve te contactan por el medio que elegiste.", "/dashboard/candidate/revision-cv"),
    "cv_review_delivered": ("candidato", "Talency cierra la revisión", "Cerramos tu revisión de CV",
        "Talency te envió la devolución por WhatsApp o mail. Si no recibiste nada, respondé este mensaje o escribinos desde Contacto.",
        "/dashboard/candidate/revision-cv"),
    # ── Empresa ──
    "welcome_company": ("empresa", "Apenas se registra", "Recibimos tu registro en BBJobs",
        "Talency va a verificar los datos de tu empresa. Te avisamos apenas esté lista para publicar búsquedas.", "/dashboard/company"),
    "company_verified": ("empresa", "Talency verifica la empresa", "Tu empresa fue verificada",
        "Ya podés publicar búsquedas en BBJobs.", "/dashboard/company"),
    "company_rejected": ("empresa", "Talency rechaza la verificación", "No pudimos verificar tu empresa",
        "Revisá los datos y volvé a enviarlos, o escribinos para ayudarte.", "/dashboard/company"),
    "company_suspended": ("empresa", "Talency suspende la empresa", "Tu empresa fue suspendida",
        "Tu empresa ha sido suspendida por el equipo de BBJobs. Contactanos para más información.", "/dashboard/company"),
    "company_reactivated": ("empresa", "Talency la reactiva", "Tu empresa fue reactivada",
        "Tu empresa ha sido reactivada. Ya podés volver a gestionar tus búsquedas laborales en BBJobs.", "/dashboard/company"),
    "company_onboarding_guide": ("empresa", "Verificada y sin publicar nada", "Publicá tu primera búsqueda",
        "Tu empresa ya está verificada. Publicar una búsqueda lleva unos minutos: puesto, requisitos y zona. Te avisamos cuando lleguen postulaciones.",
        "/dashboard/company/publicar"),
    "job_approved": ("empresa", "Talency aprueba la búsqueda", "Tu búsqueda fue aprobada",
        f"'{JOB}' ya está publicada en BBJobs.", "/dashboard/company/estadisticas"),
    "job_rejected": ("empresa", "Talency rechaza la búsqueda", "Tu búsqueda necesita cambios",
        f"'{JOB}' no pudo publicarse. Revisá el motivo y volvé a enviarla.", "/dashboard/company/estadisticas"),
    "job_takedown": ("empresa", "Talency da de baja la búsqueda", "Búsqueda dada de baja",
        f"La búsqueda '{JOB}' fue dada de baja por incumplimiento de las políticas de BBJobs.", "/dashboard/company/estadisticas"),
    "job_reopened": ("empresa", "Talency la reactiva", "Tu búsqueda volvió a estar activa",
        f"'{JOB}' fue reactivada por el equipo de BBJobs.", "/dashboard/company/estadisticas"),
    "job_deleted": ("empresa", "Talency la elimina", "Tu búsqueda fue eliminada",
        f"'{JOB}' fue eliminada por el equipo de BBJobs.", "/dashboard/company/estadisticas"),
    "job_expiring_soon": ("empresa", "Faltan pocos días para el plazo máximo", "Tu búsqueda está por vencer",
        f"'{JOB}' se va a dar de baja en 3 días por llegar a su plazo máximo. Revisá el estado de tus búsquedas desde tu panel.",
        "/dashboard/company/estadisticas"),
    "job_expired": ("empresa", "Llega al plazo máximo", "Tu búsqueda venció",
        f"La búsqueda '{JOB}' llegó a su plazo máximo de 30 días y dejó de estar visible en el portal.", "/dashboard/company/estadisticas"),
    "job_no_applications": ("empresa", "Una semana publicada sin postulaciones", "Tu búsqueda todavía no recibió postulaciones",
        f"'{JOB}' lleva una semana publicada sin postulaciones. Revisá que el título sea claro y que los requisitos excluyentes sean los indispensables.",
        "/dashboard/company/estadisticas"),
    "job_feature_active": ("empresa", "Búsqueda destacada (pago o regalo de Talency)", "Destacado activado",
        f"Talency destacó '{JOB}' en el portal, sin cargo.", "/dashboard/company/busquedas"),
    "job_feature_rejected": ("empresa", "El pago del destacado no se acredita", "El pago no se acreditó",
        f"Tu pago para destacar '{JOB}' fue rechazado o cancelado. Podés volver a intentarlo desde tu panel.", "/dashboard/company/estadisticas"),
    "job_feature_expired": ("empresa", "Termina el destacado", "Destacado desactivado",
        f"'{JOB}' ya no aparece destacada.", "/dashboard/company/busquedas"),
    "talent_pack_active": ("empresa", "Acredita un pack de la Base de Talento", "Ya tenés acceso a la Base de Talento",
        "Se acreditó tu pago. Sumaste 10 contactos para usar con los perfiles que quieras.", "/dashboard/company/talento"),
    "talent_pack_rejected": ("empresa", "El pago del pack no se acredita", "El pago no se acreditó",
        "Tu pago del pack de la Base de Talento fue rechazado o cancelado. Podés volver a intentarlo desde tu panel.", "/dashboard/company/talento"),
    "talent_pack_low": ("empresa", "Quedan pocos contactos", "Te quedan pocos contactos",
        "Te quedan 2 contactos de la Base de Talento.", "/dashboard/company/talento"),
    "recommended_candidates_new": ("empresa", "De noche, si la IA encuentra perfiles nuevos que encajan (uno por empresa por noche)",
        "Hay candidatos nuevos que encajan con tus búsquedas",
        f"Encontramos 2 perfiles que encajan con '{JOB}'. Miralos en Recomendados.", "/dashboard/company/postulaciones"),
    # ── Equipo Talency ──
    "admin_payment_received": ("admin", "Se acredita un pago", "Nuevo pago recibido",
        f"Se acreditaron $15000 ARS por destacar '{JOB}'.", "/dashboard/admin/pagos"),
    "admin_payment_refunded": ("admin", "Mercado Pago informa una devolución", "Pago devuelto o desconocido",
        "Mercado Pago informa que se devolvió un pago de $15000 ARS por un destacado.", "/dashboard/admin/pagos"),
    "admin_cv_review_new": ("admin", "Alguien paga la Revisión de CV", "Nueva revisión de CV pagada",
        "Lucía Gómez pagó la revisión de CV. Objetivo: operaria de depósito. Contacto: WhatsApp 291 000-0000.", "/dashboard/admin/revisiones-cv"),
    "admin_cv_review_duplicate_payment": ("admin", "Una persona paga dos veces", "Pago duplicado de revisión de CV",
        "Lucía Gómez pagó dos veces la revisión de CV ($12000). Hay que devolver uno desde Mercado Pago.", "/dashboard/admin/revisiones-cv"),
    "admin_cv_review_overdue": ("admin", "Pasan las horas y nadie tomó la revisión", "Revisión de CV sin contactar hace 48 h",
        "Lucía Gómez pagó la revisión y todavía nadie la tomó. Contacto: WhatsApp 291 000-0000.", "/dashboard/admin/revisiones-cv"),
    "admin_email_health": ("admin", "Los mails empiezan a rebotar o a fallar", "Atención: problemas con los envíos",
        "En las últimas horas hubo rebotes y errores por encima de lo normal. Revisá el panel de Mails e IA.", "/dashboard/admin/modulos"),
    "admin_campaign_draft_ready": ("admin", "El primer día del mes", "Tu borrador de novedades está listo",
        "Preparamos 'Novedades de octubre' con los datos del mes. Revisalo, editalo y aprobalo cuando quieras: no sale solo.",
        "/dashboard/admin/campanas"),
}

# Los que no salen sueltos: los junta un resumen.
EN_RESUMEN = {
    "application_new": ("empresa", "Nueva postulación en una búsqueda", "Va en el resumen diario de la empresa"),
    "admin_company_pending": ("admin", "Una empresa se registra", "Va en el resumen del equipo"),
    "admin_company_reapplied": ("admin", "Una empresa rechazada vuelve a pedir verificación", "Va en el resumen del equipo"),
    "job_pending_review": ("admin", "Una empresa publica una búsqueda", "Va en el resumen del equipo"),
    "contact_message_received": ("admin", "Llega un mensaje de Contacto", "Va en el resumen del equipo"),
}
SOLO_WEB = {
    "application_new_status": ("candidato", "Cambios de estado intermedios", "Sólo en la campanita de la web"),
}

RESUMENES = [
    ("digest_alertas", "candidato", "Cuando se publican búsquedas que coinciden con una alerta del postulante (diaria o semanal, según elija)",
     "3 búsquedas nuevas para tu alerta", "Nuevas búsquedas que coinciden con tus alertas",
     "Estas búsquedas se publicaron en BBJobs y coinciden con lo que estás buscando.",
     [EmailItem("Operario/a de depósito con autoelevador", "Centro · presencial · Logística Sur", "/empleos/x"),
      EmailItem("Repositor/a turno mañana", "Norte · presencial · Supermercado Del Puerto", "/empleos/x"),
      EmailItem("Auxiliar administrativo/a", "Centro · híbrido · Estudio Contable Paz", "/empleos/x")],
     "Ver todas las búsquedas", "/empleos"),
    ("digest_para_vos", "candidato", "Lunes por la mañana: búsquedas de la semana que encajan con su perfil",
     "Búsquedas de esta semana que te pueden interesar", "Búsquedas para vos",
     "Se publicaron esta semana y encajan con tu perfil. Postularte lleva un clic.",
     [EmailItem("Chofer de reparto", "Bahía Blanca · presencial · Distribuidora Sur", "/empleos/x"),
      EmailItem("Operario/a de depósito con autoelevador", "Centro · presencial · Logística Sur", "/empleos/x")],
     "Ver todas las búsquedas", "/empleos"),
    ("digest_empresa", "empresa", "Una vez por día, si hubo postulaciones nuevas",
     "Postulaciones nuevas en tus búsquedas", "Tu resumen de hoy", "Esto llegó desde el último resumen.",
     [EmailItem("Operario/a de depósito con autoelevador", "4 postulaciones nuevas", None),
      EmailItem("Repositor/a turno mañana", "1 postulación nueva", None)],
     "Ver postulaciones", "/dashboard/company/postulaciones"),
    ("digest_equipo", "admin", "Una vez por día, si hay algo esperando a Talency",
     "BBJobs: lo pendiente de hoy", "Pendientes del equipo", "Lo que espera una acción de Talency.",
     [EmailItem("2 empresas esperan verificación", None, "/dashboard/admin/empresas"),
      EmailItem("3 búsquedas esperan aprobación", None, "/dashboard/admin/busquedas"),
      EmailItem("1 mensaje de contacto sin responder", None, "/dashboard/admin/mensajes")],
     "Abrir el panel", "/dashboard/admin"),
]


def regla(rule) -> dict:
    return {
        "categoria": rule.category.value, "modo": rule.mode, "demora_horas": int(rule.delay.total_seconds() // 3600),
        "critico": rule.critical, "uno_por_dia": rule.once_per_day, "con_baja": rule.unsubscribable,
    }


def main() -> None:
    avisos = []
    for tipo, (dest, cuando, titulo, cuerpo, link) in INSTANT.items():
        rule = RULES[tipo]
        asunto, r = build_content(user_id=UID, category=rule.category, title=titulo, body=cuerpo, link=link,
                                  cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=None)
        avisos.append({"tipo": tipo, "destinatario": dest, "cuando": cuando, "asunto": asunto,
                       "html": r.html, "texto": r.text, **regla(rule)})
    for clave, dest, cuando, asunto, titulo, intro, items, cta, url in RESUMENES:
        rule = RULES[clave]
        r = render_email(heading=titulo, body=intro, items=items, cta_label=cta, cta_url=url,
                         unsubscribe_url=unsubscribe_page_url(UID, rule.category) if rule.unsubscribable else None)
        avisos.append({"tipo": clave, "destinatario": dest, "cuando": cuando, "asunto": asunto,
                       "html": r.html, "texto": r.text, "resumen": True, **regla(rule)})
    sin_mail = [{"tipo": t, "destinatario": d, "cuando": c, "nota": n, **regla(RULES[t])}
                for t, (d, c, n) in {**EN_RESUMEN, **SOLO_WEB}.items()]

    # Garantía: no se puede olvidar un tipo del catálogo.
    cubiertos = {a["tipo"] for a in avisos} | {s["tipo"] for s in sin_mail}
    faltan = set(RULES) - cubiertos
    if faltan:
        sys.exit(f"Faltan muestras para: {sorted(faltan)}")

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps({"avisos": avisos, "sin_mail": sin_mail}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(avisos)} mails + {len(sin_mail)} avisos sin mail suelto -> {SALIDA}")


if __name__ == "__main__":
    main()
