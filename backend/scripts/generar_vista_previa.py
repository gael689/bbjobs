"""Genera los datos de la vista previa para Eugenia (`/vista-previa/<clave>` en el frontend).

Los mails salen del código real: `catalog.RULES` (qué aviso, a quién, con qué reglas) y
`outbox.build_content` / `render.render_email` (el HTML que recibiría la persona). El texto de
la campanita de cada aviso es el mismo que escribe cada pantalla del sistema al dispararlo.
Los nombres de personas y empresas de los ejemplos son inventados; no se lee ninguna base.

Además de los mails, el JSON lleva lo que necesita la página para explicarse sola: el código
de cada aviso en el PDF de Eugenia (C1…C11, E1…E21), un nombre claro, en qué momento del
recorrido está, cuándo sale (en una frase), quién escribió el texto y qué preguntas siguen
abiertas (P1–P13 de MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md §3).

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
from app.services.email.copy import COPY, DIGESTS, dias_texto, greeting  # noqa: E402
from app.services.email.outbox import build_content, manage_url_for  # noqa: E402
from app.services.email.render import EmailItem, render_email  # noqa: E402
from app.services.email.tokens import unsubscribe_page_url  # noqa: E402

SALIDA = Path(__file__).resolve().parents[2] / "frontend" / "src" / "vista-previa" / "datos" / "avisos.json"
UID = uuid.UUID("00000000-0000-0000-0000-000000000001")
JOB = "Operario/a de depósito con autoelevador"
JOB_URL = "/empleos/operario-a-de-deposito-con-autoelevador-00000000-0000-0000-0000-000000000000"

# Momentos del recorrido, en orden. La página agrupa los avisos así.
ETAPAS = [
    ("candidato", "c_registro", "Cuando se registra"),
    ("candidato", "c_postulacion", "Cuando se postula y su postulación avanza"),
    ("candidato", "c_perfil", "Su perfil y la base de candidatos"),
    ("candidato", "c_pagos", "Revisión de CV (servicio pago)"),
    ("candidato", "c_resumenes", "Resúmenes de búsquedas"),
    ("empresa", "e_registro", "Registro y verificación de la empresa"),
    ("empresa", "e_publicacion", "Publicación de búsquedas"),
    ("empresa", "e_postulaciones", "Postulaciones y perfiles recomendados"),
    ("empresa", "e_pagos", "Destacados y base de candidatos (pagos y regalos)"),
    ("empresa", "e_resumenes", "Resúmenes de postulaciones"),
    ("admin", "a_equipo", "Avisos para el equipo de Talency"),
]

# tipo: (código en el PDF, nombre claro, etapa, cuándo se manda, frecuencia)
# El orden de esta lista es el orden en la página.
META: list[tuple[str, str | None, str, str, str, str]] = [
    # ── Candidatos ──
    ("welcome_candidate", "C1", "Bienvenida", "c_registro",
     "Apenas la persona termina de registrarse como candidata.", "Una sola vez."),
    ("application_sent", "C2", "Postulación confirmada", "c_postulacion",
     "Cada vez que se postula a una búsqueda.", "Una por postulación."),
    ("application_seen", "C3", "Tu perfil fue revisado", "c_postulacion",
     "Cuando la empresa abre por primera vez su perfil o su CV desde la postulación, o la pasa a «Perfil revisado».",
     "Como mucho uno por día, aunque la vean varias empresas."),
    ("application_in_process", "C4", "Tu postulación avanzó", "c_postulacion",
     "Cuando la empresa pasa la postulación a «En proceso».", "Una vez por cambio de estado."),
    ("application_selected", "C5", "Fuiste seleccionado/a", "c_postulacion",
     "Cuando la empresa pasa la postulación a «Seleccionado».", "Una vez por cambio de estado."),
    ("application_discarded", "C6", "No avanza – revisión de perfil", "c_postulacion",
     "Cuando la empresa elige «No avanza – revisión de perfil». Si dejó un mensaje visible, va adentro (en este ejemplo, sí).",
     "Sale 24 horas después, y sólo si la empresa no cambió de idea."),
    ("application_discarded_interview", "C7", "No avanza – después de entrevistas", "c_postulacion",
     "Cuando la empresa elige «No avanza – después de entrevistas».",
     "Sale 24 horas después, y sólo si la empresa no cambió de idea."),
    ("application_note", None, "Mensaje de la empresa", "c_postulacion",
     "Cuando la empresa le deja un mensaje visible sin cambiar el estado. Las notas privadas no avisan nada.",
     "Como mucho uno por día."),
    ("talent_profile_unlocked", "C8", "Una empresa vio tu perfil", "c_perfil",
     "Cuando una empresa abre su perfil completo en la base de candidatos.", "Como mucho uno por día."),
    ("profile_incomplete", "C9", "Perfil incompleto", "c_perfil",
     "Cuando su perfil está incompleto.", "Como mucho uno por semana; se corta después de 3 sin que complete nada."),
    ("candidate_reactivation", "C10", "Una semana sin entrar", "c_perfil",
     "Cuando hace una semana que no entra a BBJobs.",
     "Como mucho uno cada 30 días; después de 3 sin que vuelva, no se le escribe más."),
    ("cv_review_paid", None, "Revisión de CV: pago recibido", "c_pagos",
     "Cuando paga la Revisión de CV.", "Una vez por pago."),
    ("cv_review_payment_rejected", None, "Revisión de CV: el pago no se acreditó", "c_pagos",
     "Cuando el pago de la Revisión de CV es rechazado o cancelado.", "Una vez por pago."),
    ("cv_review_in_progress", None, "Revisión de CV: en curso", "c_pagos",
     "Cuando alguien de Talency toma la revisión.", "Una vez."),
    ("cv_review_delivered", None, "Revisión de CV: terminada", "c_pagos",
     "Cuando Talency marca la revisión como entregada.", "Una vez."),
    ("digest_para_vos", "C11", "Resumen semanal de oportunidades", "c_resumenes",
     "Los lunes a la mañana: las búsquedas de la semana, primero las que encajan con su perfil.",
     "Uno por semana. Si no hay búsquedas nuevas, no sale."),
    ("digest_alertas", None, "Alertas de búsquedas", "c_resumenes",
     "Cuando se publican búsquedas que coinciden con una alerta que armó la persona.",
     "Diario o semanal, según elija. Si no hay nada nuevo, no sale."),
    # ── Empresas ──
    ("welcome_company", "E1", "Registro recibido", "e_registro",
     "Apenas la empresa termina de registrarse.", "Una sola vez."),
    ("company_verified", "E2", "Empresa verificada", "e_registro",
     "Cuando Talency aprueba la verificación de la empresa.", "Una vez."),
    ("company_rejected", "E3", "No pudimos verificar tu empresa", "e_registro",
     "Cuando Talency rechaza la verificación de la empresa.", "Una vez por rechazo."),
    ("company_suspended", "E4", "Empresa suspendida", "e_registro",
     "Cuando Talency suspende la cuenta de la empresa.", "Una vez."),
    ("company_reactivated", "E5", "Empresa reactivada", "e_registro",
     "Cuando Talency reactiva una empresa suspendida.", "Una vez."),
    ("company_onboarding_guide", "E6", "Publicá tu primera búsqueda", "e_registro",
     "Cuando la empresa ya está verificada pero todavía no publicó ninguna búsqueda.", "Una sola vez."),
    ("job_approved", "E7", "Publicación aprobada", "e_publicacion",
     "Cuando Talency aprueba una búsqueda y queda visible en el sitio.", "Una vez por búsqueda."),
    ("job_rejected", "E8", "Tu búsqueda necesita cambios", "e_publicacion",
     "Cuando Talency rechaza una búsqueda y le pide cambios.", "Una vez por rechazo."),
    ("job_takedown", "E9", "Publicación dada de baja", "e_publicacion",
     "Cuando Talency da de baja una búsqueda publicada por incumplir las políticas.", "Una vez."),
    ("job_reopened", "E10", "Publicación reactivada", "e_publicacion",
     "Cuando Talency vuelve a activar una búsqueda.", "Una vez."),
    ("job_deleted", "E11", "Publicación eliminada", "e_publicacion",
     "Cuando Talency elimina una búsqueda.", "Una vez."),
    ("job_expiring_soon", "E12", "Tu publicación está por vencer", "e_publicacion",
     "Cuando faltan 3 días (o menos) para que la búsqueda llegue a su plazo.", "Una vez por búsqueda."),
    ("job_expired", "E13", "Finalizó el plazo de tu publicación", "e_publicacion",
     "El día que la búsqueda llega a su plazo y deja de verse.", "Una vez por búsqueda."),
    ("job_no_applications", "E14", "Todavía sin postulaciones", "e_publicacion",
     "Cuando una búsqueda lleva una semana publicada y no recibió ninguna postulación.", "Una vez por búsqueda."),
    ("recommended_candidates_new", "E20", "Nuevos perfiles recomendados", "e_postulaciones",
     "De noche, cuando el sistema encuentra perfiles nuevos que encajan con sus búsquedas.",
     "Como mucho uno por noche por empresa, y como mucho 3 perfiles por búsqueda por semana."),
    ("job_feature_active", "E15", "Tu publicación ya está destacada", "e_pagos",
     "Cuando se acredita el pago para destacar una búsqueda.", "Una vez por pago."),
    ("job_feature_granted", None, "Destacado sin cargo (regalo de Talency)", "e_pagos",
     "Cuando Talency destaca una búsqueda sin cobrar.", "Una vez."),
    ("job_feature_rejected", "E16", "El pago del destacado no se acreditó", "e_pagos",
     "Cuando el pago para destacar es rechazado o cancelado.", "Una vez por pago."),
    ("job_feature_expired", "E17", "Destacado desactivado", "e_pagos",
     "Cuando termina el destacado (vence la búsqueda) o Talency lo saca.", "Una vez."),
    ("talent_pack_active", "E18", "Acceso a la base de candidatos", "e_pagos",
     "Cuando se acredita el pago de un pack de contactos.", "Una vez por pago."),
    ("talent_pack_granted", None, "Contactos sin cargo (regalo de Talency)", "e_pagos",
     "Cuando Talency le regala contactos de la base de candidatos.", "Una vez."),
    ("talent_pack_rejected", "E19", "El pago del pack no se completó", "e_pagos",
     "Cuando el pago del pack es rechazado o cancelado.", "Una vez por pago."),
    ("talent_pack_low", None, "Quedan pocos contactos", "e_pagos",
     "Cuando le quedan pocos contactos del pack.", "Una vez por pack."),
    ("digest_empresa", "E21", "Resumen de postulaciones", "e_resumenes",
     "Una vez por día, si sus búsquedas recibieron postulaciones nuevas.",
     "Uno por día como máximo. Si no hubo postulaciones, no sale."),
    # ── Equipo Talency ──
    ("admin_payment_received", None, "Pago recibido", "a_equipo", "Cuando se acredita un pago.", "Uno por pago."),
    ("admin_payment_refunded", None, "Pago devuelto", "a_equipo",
     "Cuando Mercado Pago informa una devolución o un desconocimiento.", "Uno por pago."),
    ("admin_cv_review_new", None, "Nueva Revisión de CV", "a_equipo",
     "Cuando alguien paga la Revisión de CV.", "Uno por pago."),
    ("admin_cv_review_duplicate_payment", None, "Revisión de CV pagada dos veces", "a_equipo",
     "Cuando una persona paga dos veces.", "Uno por caso."),
    ("admin_cv_review_overdue", None, "Revisión de CV sin tomar", "a_equipo",
     "Cuando pasan 48 horas y nadie tomó una revisión pagada.", "Uno por revisión."),
    ("admin_email_health", None, "Problemas con los envíos", "a_equipo",
     "Cuando los mails empiezan a rebotar o a fallar más de lo normal.", "Uno por problema."),
    ("admin_campaign_draft_ready", None, "Borrador de novedades listo", "a_equipo",
     "El primer día de cada mes.", "Uno por mes. Nunca sale solo: hay que aprobarlo."),
    ("digest_equipo", None, "Pendientes del equipo", "a_equipo",
     "Una vez por día, si hay algo esperando a Talency.", "Uno por día. Si no hay pendientes, no sale."),
]

# Estados que la empresa ya no puede elegir (Eugenia, 08/10/2026). Siguen en el catálogo para las
# postulaciones viejas que quedaron así, pero no se le muestran a Eugenia: no son parte del producto
# (Gael, 19/10/2026).
FUERA_DE_LA_VISTA_PREVIA = {"application_contacted", "application_finalist"}

# El texto de la campanita de cada aviso: (título, cuerpo, link). Es el que escribe el sistema.
CAMPANITA: dict[str, tuple[str, str, str | None]] = {
    "welcome_candidate": ("Bienvenido/a a BBJobs",
        "Completá tu perfil y cargá tu CV: es lo primero que miran las empresas. Después podés postularte con un clic y armar alertas para enterarte de las búsquedas nuevas.",
        "/dashboard/candidate/perfil"),
    "application_sent": ("Te postulaste", f"Tu postulación a '{JOB}' llegó a la empresa.", "/dashboard/candidate/postulaciones"),
    "application_contacted": ("Una empresa te contactó", f"La empresa de '{JOB}' se va a comunicar con vos.", "/dashboard/candidate/postulaciones"),
    "application_in_process": ("Tu postulación avanzó", f"Sobre '{JOB}': estás en proceso de selección.", "/dashboard/candidate/postulaciones"),
    "application_finalist": ("¡Llegaste a la final!", f"Sobre '{JOB}': sos uno de los finalistas.", "/dashboard/candidate/postulaciones"),
    "application_selected": ("¡Te seleccionaron!", f"Sobre '{JOB}'.", "/dashboard/candidate/postulaciones"),
    "application_discarded_interview": ("Novedades sobre tu postulación", f"Tu postulación a '{JOB}' no continuará a la siguiente etapa.", "/empleos"),
    "application_discarded": ("Novedades en tu postulación",
        f"Tu postulación a '{JOB}' no avanzó en esta oportunidad. ¡Seguí participando en otras búsquedas!",
        "/dashboard/candidate/postulaciones"),
    "application_seen": ("Una empresa vio tu CV", f"Logística Sur revisó tu perfil para la búsqueda '{JOB}'.", "/dashboard/candidate/postulaciones"),
    "application_note": ("La empresa te dejó un mensaje", f"Logística Sur te dejó un mensaje sobre tu postulación a '{JOB}'.", "/dashboard/candidate/postulaciones"),
    "profile_incomplete": ("Tu perfil está incompleto",
        "Tu perfil está 60% completo. Las empresas ven que te falta cargar datos — completalo para destacar frente a otros candidatos.",
        "/dashboard/candidate/perfil"),
    "talent_profile_unlocked": ("Una empresa vio tu perfil completo",
        "Una empresa de la Base de Talento desbloqueó tu perfil. Puede que te contacte.", "/dashboard/candidate/perfil"),
    "candidate_reactivation": ("¿Seguís buscando trabajo?",
        "Hay búsquedas nuevas en BBJobs. Si tu CV cambió, actualizalo para que las empresas vean lo último.", "/empleos"),
    "cv_review_paid": ("Recibimos tu pago de la revisión de CV",
        "Talency te va a contactar en las próximas 48 horas hábiles para revisar tu CV. La devolución es por WhatsApp o mail, fuera de la plataforma.",
        "/dashboard/candidate/revision-cv"),
    "cv_review_payment_rejected": ("El pago de la revisión de CV no se acreditó", "Podés volver a intentarlo desde tu panel.", "/dashboard/candidate/revision-cv"),
    "cv_review_in_progress": ("Talency ya está revisando tu CV", "En breve te contactan por el medio que elegiste.", "/dashboard/candidate/revision-cv"),
    "cv_review_delivered": ("Cerramos tu revisión de CV",
        "Talency te envió la devolución por WhatsApp o mail. Si no recibiste nada, respondé este mensaje o escribinos desde Contacto.",
        "/dashboard/candidate/revision-cv"),
    "welcome_company": ("Recibimos tu registro en BBJobs",
        "Talency va a verificar los datos de tu empresa. Te avisamos apenas esté lista para publicar búsquedas.", "/dashboard/company"),
    "company_verified": ("¡Tu empresa fue verificada!", "Tu empresa fue verificada exitosamente. Ya podés publicar búsquedas laborales en BBJobs.", "/dashboard/company"),
    "company_rejected": ("Verificación rechazada", "Tu solicitud de verificación fue rechazada. Motivo: no pudimos validar el CUIT con el nombre de la empresa.", "/dashboard/company"),
    "company_suspended": ("Tu empresa fue suspendida", "Tu empresa ha sido suspendida por el equipo de BBJobs. Contactanos para más información.", "/dashboard/company"),
    "company_reactivated": ("Tu empresa fue reactivada", "Tu empresa ha sido reactivada. Ya podés volver a gestionar tus búsquedas laborales en BBJobs.", "/dashboard/company"),
    "company_onboarding_guide": ("Publicá tu primera búsqueda",
        "Tu empresa ya está verificada. Publicar una búsqueda lleva unos minutos: puesto, requisitos y zona. Te avisamos cuando lleguen postulaciones.",
        "/dashboard/company/publicar"),
    "job_approved": ("¡Tu búsqueda ya está publicada!", f"'{JOB}' fue aprobada por el equipo de BBJobs y ya es visible en el portal.", "/dashboard/company/estadisticas"),
    "job_rejected": ("Tu búsqueda no fue aprobada", f"'{JOB}' no fue aprobada. Motivo: el aviso pide una edad determinada.", "/dashboard/company/estadisticas"),
    "job_takedown": ("Búsqueda dada de baja", f"La búsqueda '{JOB}' fue dada de baja por incumplimiento de las políticas de BBJobs.", "/dashboard/company/estadisticas"),
    "job_reopened": ("Tu búsqueda volvió a estar activa", f"'{JOB}' fue reactivada por el equipo de BBJobs.", "/dashboard/company/estadisticas"),
    "job_deleted": ("Tu búsqueda fue eliminada", f"'{JOB}' fue eliminada por el equipo de BBJobs.", "/dashboard/company/estadisticas"),
    "job_expiring_soon": ("Tu búsqueda está por vencer",
        f"'{JOB}' se va a dar de baja en 3 días por llegar a su plazo máximo. Revisá el estado de tus búsquedas desde tu panel.",
        "/dashboard/company/estadisticas"),
    "job_expired": ("Tu búsqueda venció", f"La búsqueda '{JOB}' llegó a su plazo máximo de 20 días y dejó de estar visible en el portal.", "/dashboard/company/estadisticas"),
    "job_no_applications": ("Tu búsqueda todavía no recibió postulaciones",
        f"'{JOB}' lleva una semana publicada sin postulaciones. Revisá que el título sea claro y que los requisitos excluyentes sean los indispensables.",
        "/dashboard/company/estadisticas"),
    "job_feature_active": ("Destacado activado", f"¡'{JOB}' ya está destacada en el portal!", "/dashboard/company/pagos"),
    "job_feature_granted": ("Destacado activado", f"Talency destacó '{JOB}' en el portal, sin cargo.", "/dashboard/company/busquedas"),
    "job_feature_rejected": ("El pago no se acreditó",
        f"Tu pago para destacar '{JOB}' fue rechazado o cancelado. Podés volver a intentarlo desde tu panel.", "/dashboard/company/estadisticas"),
    "job_feature_expired": ("Destacado desactivado", f"'{JOB}' ya no aparece destacada.", "/dashboard/company/busquedas"),
    "talent_pack_active": ("Ya tenés acceso a la Base de Talento",
        "Se acreditó tu pago. Sumaste 10 contactos para usar con los perfiles que quieras.", "/dashboard/company/talento"),
    "talent_pack_granted": ("Te asignamos acceso a la Base de Talento",
        "Tenés 10 desbloqueos para usar con los perfiles que quieras.", "/dashboard/company/talento"),
    "talent_pack_rejected": ("El pago no se acreditó",
        "Tu pago del pack de la Base de Talento fue rechazado o cancelado. Podés volver a intentarlo desde tu panel.", "/dashboard/company/talento"),
    "talent_pack_low": ("Te quedan pocos contactos", "Te quedan 2 contactos de la Base de Talento.", "/dashboard/company/talento"),
    "recommended_candidates_new": ("Hay candidatos nuevos que encajan con tus búsquedas",
        f"Encontramos 3 perfiles que encajan con '{JOB}'. Miralos en Recomendados.", "/dashboard/company/recomendados"),
    "admin_payment_received": ("Nuevo pago recibido", f"Se acreditaron $15000 ARS por destacar '{JOB}'.", "/dashboard/admin/pagos"),
    "admin_payment_refunded": ("Pago devuelto o desconocido",
        "Mercado Pago informa que se devolvió un pago de $15000 ARS por un destacado.", "/dashboard/admin/pagos"),
    "admin_cv_review_new": ("Nueva revisión de CV pagada",
        "Lucía Gómez pagó la revisión de CV. Objetivo: operaria de depósito. Contacto: WhatsApp 291 000-0000.", "/dashboard/admin/revisiones-cv"),
    "admin_cv_review_duplicate_payment": ("Pago duplicado de revisión de CV",
        "Lucía Gómez pagó dos veces la revisión de CV ($12000). Hay que devolver uno desde Mercado Pago.", "/dashboard/admin/revisiones-cv"),
    "admin_cv_review_overdue": ("Revisión de CV sin contactar hace 48 h",
        "Lucía Gómez pagó la revisión y todavía nadie la tomó. Contacto: WhatsApp 291 000-0000.", "/dashboard/admin/revisiones-cv"),
    "admin_email_health": ("Atención: problemas con los envíos",
        "En las últimas horas hubo rebotes y errores por encima de lo normal. Revisá el panel de Mails e IA.", "/dashboard/admin/modulos"),
    "admin_campaign_draft_ready": ("Tu borrador de novedades está listo",
        "Preparamos 'Novedades de octubre' con los datos del mes. Revisalo, editalo y aprobalo cuando quieras: no sale solo.",
        "/dashboard/admin/campanas"),
}

# Los resúmenes: (asunto, título, intro, filas, botón, link). Si el resumen tiene texto en
# copy.DIGESTS, ése pisa asunto, título, intro y botón.
RESUMENES: dict[str, tuple[str, str, str, list[EmailItem], str, str]] = {
    "digest_alertas": ("3 búsquedas nuevas para tu alerta", "Nuevas búsquedas que coinciden con tus alertas",
        "Estas búsquedas se publicaron en BBJobs y coinciden con lo que estás buscando.",
        [EmailItem("Operario/a de depósito con autoelevador", "Centro · presencial · Logística Sur", "/empleos/x"),
         EmailItem("Repositor/a turno mañana", "Norte · presencial · Supermercado Del Puerto", "/empleos/x"),
         EmailItem("Auxiliar administrativo/a", "Centro · híbrido · Estudio Contable Paz", "/empleos/x")],
        "Ver todas las búsquedas", "/empleos"),
    "digest_para_vos": ("Búsquedas de esta semana que te pueden interesar", "Búsquedas para vos",
        "Se publicaron esta semana y encajan con tu perfil. Postularte lleva un clic.",
        [EmailItem("Chofer de reparto", "Bahía Blanca · presencial · Distribuidora Sur", "/empleos/x"),
         EmailItem("Operario/a de depósito con autoelevador", "Centro · presencial · Logística Sur", "/empleos/x")],
        "Ver todas las búsquedas", "/empleos"),
    "digest_empresa": ("Postulaciones nuevas en tus búsquedas", "Tu resumen de hoy", "Esto llegó desde el último resumen.",
        [EmailItem("Operario/a de depósito con autoelevador", "4 postulaciones nuevas", "/dashboard/company/postulaciones"),
         EmailItem("Repositor/a turno mañana", "1 postulación nueva", "/dashboard/company/postulaciones")],
        "Ver postulaciones", "/dashboard/company/postulaciones"),
    "digest_equipo": ("BBJobs: lo pendiente de hoy", "Pendientes del equipo", "Lo que espera una acción de Talency.",
        [EmailItem("2 empresas esperan verificación", None, "/dashboard/admin/empresas"),
         EmailItem("3 búsquedas esperan aprobación", None, "/dashboard/admin/busquedas"),
         EmailItem("1 mensaje de contacto sin responder", None, "/dashboard/admin/mensajes")],
        "Abrir el panel", "/dashboard/admin"),
}

# Los que no salen sueltos: los junta un resumen, o quedan sólo en la web.
SIN_MAIL = {
    "application_new": ("empresa", "Cada postulación nueva a una búsqueda", "Va en el resumen diario de la empresa (E21)"),
    "application_new_status": ("candidato", "Cambios de estado intermedios", "Sólo en la campanita de la web"),
    "skill_suggestions_ready": ("candidato", "El sistema lee su CV y le sugiere habilidades", "Sólo en la campanita de la web"),
    "admin_company_pending": ("admin", "Una empresa se registra", "Va en el resumen del equipo"),
    "admin_company_reapplied": ("admin", "Una empresa rechazada vuelve a pedir verificación", "Va en el resumen del equipo"),
    "job_pending_review": ("admin", "Una empresa publica una búsqueda", "Va en el resumen del equipo"),
    "contact_message_received": ("admin", "Llega un mensaje de Contacto", "Va en el resumen del equipo"),
    "admin_campaign_weekly_ready": ("admin", "Se arma el borrador semanal de búsquedas", "Sólo en la campanita de la web"),
}

# Datos inventados para las variables de cada mail.
VARS: dict[str, dict] = {
    "application_discarded": {"mensaje_empresa": "Buscamos a alguien con carnet de autoelevador vigente. ¡Gracias por postularte!"},
    "application_note": {"mensaje_empresa": "Gracias por postularte. La semana que viene llamamos a entrevistas."},
    "profile_incomplete": {"porcentaje": 60},
    "company_rejected": {"detalle": "No pudimos validar el CUIT con el nombre de la empresa."},
    "job_rejected": {"detalle": "El aviso pide una edad determinada: no se puede publicar así."},
    "job_approved": {"enlace": JOB_URL},
    "job_reopened": {"enlace": JOB_URL},
    "job_feature_active": {"enlace": JOB_URL},
    "job_feature_granted": {"enlace": JOB_URL},
    "job_expiring_soon": {"dias": dias_texto(3)},
    "job_expired": {"dias": dias_texto(20)},
    "talent_pack_active": {"cantidad_contactos": 10},
    "talent_pack_granted": {"cantidad_contactos": 10},
    "talent_pack_low": {"mensaje": "Te quedan 2 contactos de la base de candidatos."},
    "recommended_candidates_new": {"cantidad": 3},
}
# Variantes: (clave, etiqueta, variables extra).
VARIANTES: dict[str, list[tuple[str, str, dict]]] = {
    "job_feature_active": [("sin_aprobar", "Si la búsqueda todavía espera aprobación", {"variante": "sin_aprobar"})],
    "recommended_candidates_new": [
        ("uno", "Con un solo perfil", {"variante": "uno"}),
        ("varias", "Con varias búsquedas", {"variante": "varias", "cantidad": 5,
                                            "puestos": f"{JOB}, Repositor/a turno mañana"}),
    ],
}
NOMBRE = {"candidato": "Lucía", "empresa": "Rocío", "admin": "Eugenia"}
ROL = {"candidato": "candidate", "empresa": "company", "admin": "admin"}
DEST_TXT = {"candidato": "A la persona que busca trabajo.", "empresa": "A la empresa (a la persona responsable de la cuenta).",
            "admin": "Al equipo de Talency."}

# Preguntas abiertas (MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md §3), en lenguaje simple.
PREGUNTAS = [
    {"codigo": "P8", "tema": "Mails", "titulo": "¿Cuántos días dura una publicación?",
     "texto": "En tu texto pusiste 30 días, pero en BBJobs una búsqueda dura como máximo 20 días, y la empresa puede elegir menos.",
     "propuesta": "Que el mail diga los días reales de cada búsqueda («cumplió el plazo máximo de 20 días»). Y que el aviso de «está por vencer» diga los días que faltan en lugar de «3» fijo: si la búsqueda dura menos de 3 días, el aviso llega antes."},
    {"codigo": "P9", "tema": "Mails", "titulo": "Destacados y contactos que regala Talency",
     "texto": "Cuando ustedes destacan una búsqueda sin cobrar, o le regalan contactos a una empresa, frases como «el servicio que contrataste» o «se acreditó tu pago» no son ciertas.",
     "propuesta": "Dos mails aparte, adaptados de los tuyos y sin hablar de pagos. Los vas a ver marcados como «Propuesto por Gael». ¿Te quedan bien así o preferís escribirlos vos?"},
    {"codigo": "P10", "tema": "Mails", "titulo": "Perfiles recomendados para varias búsquedas",
     "texto": "Tu texto habla de una búsqueda. El aviso sale como mucho una vez por noche por empresa, así que a veces junta perfiles de varias búsquedas.",
     "propuesta": "Con una búsqueda, tu texto tal cual. Con varias: «Identificamos 5 nuevos perfiles que podrían ajustarse a los requisitos de tus búsquedas: Chofer, Cajero/a». Con un solo perfil: «Identificamos un nuevo perfil…». ¿De acuerdo?"},
    {"codigo": "P11", "tema": "Mails", "titulo": "El motivo de un rechazo, ¿va en el mail?",
     "texto": "En «No pudimos verificar tu empresa» y en «Tu búsqueda necesita cambios» escribiste que el motivo se consulta en la cuenta. Hoy el motivo de una búsqueda rechazada se ve en el panel, pero el de la verificación de la empresa todavía no se ve en ningún lado.",
     "propuesta": "El mail no lleva el motivo, como lo escribiste, y sumamos el motivo de la verificación al perfil de la empresa. ¿Confirmás?"},
    {"codigo": "P12", "tema": "Mails", "titulo": "Detalles de forma",
     "texto": "Varios mails no tenían asunto. El de «empresa suspendida» no tenía saludo. Y los dos primeros de empresas (registro y verificación) tienen el estilo de los de candidatos, con «¡Hola!» y «BBJobs. El talento de Bahía, más cerca.».",
     "propuesta": "Como asunto usamos el título que escribiste arriba de cada mail (lo vas a ver como «Asunto propuesto»). A «empresa suspendida» le sumamos «Hola, {nombre}:». Los mails de empresas cierran con «Saludos, Equipo de BBJobs, Una iniciativa de Talency» y el WhatsApp; los de candidatos, con su firma de siempre. ¿Dejamos los dos primeros de empresas como los escribiste o los pasamos al estilo de empresas?"},
    {"codigo": "P13", "tema": "Mails", "titulo": "Avisos que todavía no tienen texto tuyo",
     "texto": "Hay avisos que no estaban en tu PDF: el mensaje de la empresa al postulante, los 4 de la Revisión de CV, las alertas de búsquedas, «quedan pocos contactos», los dos regalos de Talency y los del equipo.",
     "propuesta": "Quedan con el texto propuesto hasta que los revises. ¿Los escribís vos o te quedan bien así?"},
    {"codigo": "P1", "tema": "Mejoras del panel", "titulo": "¿Talency puede leer las notas privadas de las empresas?",
     "texto": "En tu pedido dijiste que con tu usuario general querés ver todo. Hasta ahora habíamos decidido que nadie fuera de la empresa las lea.",
     "propuesta": "Que sí, sólo para leer, quedando registrado cada vez que alguien de Talency abre una. El aviso del panel diría: «No la ve el postulante ni otras empresas. El equipo de Talency puede leerla». Lo validamos con el abogado."},
    {"codigo": "P2", "tema": "Mejoras del panel", "titulo": "¿La nota es de la persona o de la postulación?",
     "texto": "Tu ejemplo («ya lo entrevistamos y no se presentó») sirve para cualquier búsqueda futura de la misma empresa.",
     "propuesta": "Que la nota quede asociada a la persona dentro de cada empresa, y que se vea en todas sus búsquedas y en la base de candidatos."},
    {"codigo": "P3", "tema": "Mejoras del panel", "titulo": "Lo que se escribe en las notas",
     "texto": "Por ley (Ley 25.326), una persona puede pedir ver los datos que hay sobre ella, y una nota es un dato suyo. No se puede garantizar que nunca se entere.",
     "propuesta": "Un cartel que recuerde «registrá hechos, no opiniones», etiquetas rápidas («No se presentó», «Ya entrevistado») y que las notas privadas se borren a los 24 meses. ¿Estás de acuerdo?"},
    {"codigo": "P4", "tema": "Mejoras del panel", "titulo": "¿Abrir un perfil le avisa al candidato?",
     "texto": "Con los mails prendidos, cuando la empresa abre una ficha, la postulación pasa a «Perfil revisado» y le llega un mail (como mucho uno por día).",
     "propuesta": "Mantenerlo así, y que la marca verde de «ya lo vi» exista igual. ¿O preferís que la empresa pueda mirar sin que le avise?"},
    {"codigo": "P5", "tema": "Mejoras del panel", "titulo": "La marca de «ya lo vi» para tu usuario",
     "texto": "Hoy, cuando mirás postulaciones desde tu panel de Talency, no se marca nada.",
     "propuesta": "¿Querés tu propia marca de «ya lo vi», separada de la de cada empresa?"},
    {"codigo": "P6", "tema": "Mejoras del panel", "titulo": "¿Qué cuenta como «está en otro proceso»?",
     "texto": "Pediste un aviso cuando una segunda empresa avanza con un candidato que ya está en otro proceso.",
     "propuesta": "Que cuente si en otra empresa está «En proceso» o «Seleccionado» en los últimos 90 días, sin decir cuál empresa ni qué búsqueda. Que se vea al avanzarlo y en su ficha. ¿Te sirve así?"},
    {"codigo": "P7", "tema": "Mejoras del panel", "titulo": "¿Lo contamos en la política de privacidad?",
     "texto": "Ese aviso le muestra a una empresa un dato del candidato.",
     "propuesta": "Contarlo en la política de privacidad y darle al candidato la opción de oponerse. Lo decide el abogado."},
]


def variables_para(tipo: str, dest: str) -> dict:
    return {"puesto": JOB, "empresa": "Logística Sur", "nombre": NOMBRE[dest]} | VARS.get(tipo, {})


def texto_de(tipo: str):
    return COPY.get(tipo) or DIGESTS.get(tipo)


def fuente(tipo: str) -> str:
    """Quién escribió el texto: Talency (PDF de Eugenia), propuesto, o el texto del sistema."""
    copia = texto_de(tipo)
    return copia.source if copia is not None else "sistema"


def regla(rule) -> dict:
    return {
        "categoria": rule.category.value, "modo": rule.mode, "demora_horas": int(rule.delay.total_seconds() // 3600),
        "critico": rule.critical, "uno_por_dia": rule.once_per_day, "con_baja": rule.unsubscribable,
    }


def mail_suelto(tipo: str, dest: str, extra: dict | None = None):
    rule = RULES[tipo]
    titulo, cuerpo, link = CAMPANITA[tipo]
    return build_content(user_id=UID, category=rule.category, title=titulo, body=cuerpo, link=link,
                         cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=None,
                         type=tipo, variables=variables_para(tipo, dest) | (extra or {}), role=ROL[dest])


def resumen(tipo: str, dest: str):
    rule = RULES[tipo]
    asunto, titulo, intro, items, cta, url = RESUMENES[tipo]
    copia = DIGESTS.get(tipo)
    item_cta = hola = outro = ayuda = None
    voz = "candidato"
    if copia is not None:
        asunto, titulo, intro, cta, item_cta = copia.subject, copia.heading, copia.intro, copia.cta_label, copia.item_cta
        voz, outro, ayuda = copia.voice, copia.outro, copia.help_whatsapp
        hola = greeting(NOMBRE[dest], voz)
    r = render_email(heading=titulo, body=intro, items=items, cta_label=cta, cta_url=url,
                     greeting=hola, item_cta=item_cta, voice=voz, outro=outro, help_whatsapp=ayuda,
                     manage_url=manage_url_for(ROL[dest]) if rule.unsubscribable else None,
                     unsubscribe_url=unsubscribe_page_url(UID, rule.category) if rule.unsubscribable else None)
    return asunto, r


def destinatario(etapa: str) -> str:
    return next(g for g, k, _ in ETAPAS if k == etapa)


def main() -> None:
    avisos = []
    for orden, (tipo, codigo, nombre, etapa, cuando, frecuencia) in enumerate(META):
        dest = destinatario(etapa)
        es_resumen = tipo in RESUMENES
        asunto, r = resumen(tipo, dest) if es_resumen else mail_suelto(tipo, dest)
        copia = texto_de(tipo)
        variantes = []
        for clave, etiqueta, extra in VARIANTES.get(tipo, []):
            v_asunto, v = mail_suelto(tipo, dest, extra)
            v_copia = COPY[tipo].variants[clave]
            variantes.append({"clave": clave, "etiqueta": etiqueta, "asunto": v_asunto, "html": v.html,
                              "texto": v.text, "fuente": v_copia.source})
        campanita = None if es_resumen else {"titulo": CAMPANITA[tipo][0], "cuerpo": CAMPANITA[tipo][1]}
        avisos.append({
            "tipo": tipo, "codigo": codigo, "nombre": nombre, "grupo": dest, "etapa": etapa, "orden": orden,
            "destinatario": dest, "a_quien": DEST_TXT[dest], "cuando": cuando, "frecuencia": frecuencia,
            "campanita": campanita, "asunto": asunto, "html": r.html, "texto": r.text,
            "resumen": es_resumen, "fuente": fuente(tipo),
            "confirmar": list(getattr(copia, "confirmar", ()) or ()),
            "asunto_propuesto": bool(getattr(copia, "subject_proposed", False)),
            "variantes": variantes, **regla(RULES[tipo]),
        })
    sin_mail = [{"tipo": t, "destinatario": d, "grupo": d, "cuando": c, "nota": n, **regla(RULES[t])}
                for t, (d, c, n) in SIN_MAIL.items()]

    # Garantías: no se puede olvidar un tipo del catálogo, ni repetir uno.
    tipos = [a["tipo"] for a in avisos] + [s["tipo"] for s in sin_mail]
    if len(tipos) != len(set(tipos)):
        sys.exit("Hay un tipo repetido en la vista previa")
    faltan = set(RULES) - set(tipos) - FUERA_DE_LA_VISTA_PREVIA
    if faltan:
        sys.exit(f"Faltan muestras para: {sorted(faltan)}")
    codigos = {c for a in avisos for c in a["confirmar"]}
    sin_pregunta = codigos - {p["codigo"] for p in PREGUNTAS}
    if sin_pregunta:
        sys.exit(f"Preguntas sin texto: {sorted(sin_pregunta)}")
    preguntas = [p | {"avisos": [a["codigo"] or a["nombre"] for a in avisos if p["codigo"] in a["confirmar"]]}
                 for p in PREGUNTAS]

    etapas = [{"grupo": g, "clave": k, "titulo": t} for g, k, t in ETAPAS]
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps({"etapas": etapas, "avisos": avisos, "sin_mail": sin_mail, "preguntas": preguntas},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(avisos)} mails + {len(sin_mail)} avisos sin mail suelto + {len(preguntas)} preguntas -> {SALIDA}")


if __name__ == "__main__":
    main()
