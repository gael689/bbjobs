"""El texto de cada mail, separado del texto corto de la campanita.

La notificación de la web es una línea ("Tu postulación avanzó"); el mail es una carta: saludo,
una línea en negrita, dos o tres párrafos, un botón y la firma. Los textos marcados `eugenia`
son los que escribió Talency (PDF "bbjobs mails automáticos", 08/10/2026) y se copian tal cual;
los `propuesto` siguen la misma voz y esperan su visto bueno.

Variables (`{nombre}`, `{puesto}`, `{empresa}`, `{porcentaje}`, `{detalle}`, `{mensaje}`) se
reemplazan en texto plano antes de escapar (ver `render.py`). A los valores se les sacan los
asteriscos: así un título de búsqueda no puede meter negritas. Un párrafo que queda vacío
porque su variable vino vacía (p. ej. `{detalle}` sin motivo) se omite.

Un `type` sin entrada acá sale como antes: título y cuerpo de la notificación.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Source = Literal["eugenia", "propuesto"]

CANDIDATE_APPS = "/dashboard/candidate/postulaciones"
CANDIDATE_PROFILE = "/dashboard/candidate/perfil"
JOBS = "/empleos"
COMPANY_HOME = "/dashboard/company"
COMPANY_APPS = "/dashboard/company/postulaciones"
COMPANY_JOBS = "/dashboard/company/estadisticas"
COMPANY_PUBLISH = "/dashboard/company/publicar"

COMPANY_MESSAGE_LABEL = "Mensaje de la empresa:"


@dataclass(frozen=True)
class MailCopy:
    subject: str
    heading: str
    paragraphs: tuple[str, ...]
    cta_label: str | None = None
    # `None` = el link de la notificación.
    link: str | None = None
    source: Source = "propuesto"


_VAR = re.compile(r"\{([a-z_]+)\}")


def clean_value(value: object) -> str:
    return str(value if value is not None else "").replace("*", "").strip()


def fill(template: str, variables: dict[str, str]) -> str:
    return _VAR.sub(lambda m: variables.get(m.group(1), ""), template)


def first_name(full_name: str | None) -> str:
    return (full_name or "").strip().split(" ")[0] if full_name and full_name.strip() else ""


def greeting(nombre: str | None) -> str:
    return f"¡Hola, {nombre}!" if nombre else "¡Hola!"


@dataclass(frozen=True)
class FilledCopy:
    subject: str
    heading: str
    body: str
    cta_label: str | None
    link: str | None


def fill_copy(copy: MailCopy, variables: dict[str, object], default_link: str | None) -> FilledCopy:
    values = {k: clean_value(v) for k, v in variables.items()}
    # Un párrafo cuyas variables vinieron todas vacías no se manda ("**Motivo:** " sin motivo).
    paragraphs = [
        fill(p, values).strip() for p in copy.paragraphs
        if not (names := _VAR.findall(p)) or any(values.get(n) for n in names)
    ]
    if values.get("mensaje_empresa"):
        paragraphs.append(f"**{COMPANY_MESSAGE_LABEL}** {values['mensaje_empresa']}")
    return FilledCopy(
        subject=fill(copy.subject, values).strip(),
        heading=fill(copy.heading, values).strip(),
        body="\n\n".join(paragraphs),
        cta_label=copy.cta_label,
        link=copy.link or default_link,
    )


E = "eugenia"

COPY: dict[str, MailCopy] = {
    # ══ Postulante — textos de Eugenia ══════════════════════════════════════════════════
    "welcome_candidate": MailCopy(
        "Bienvenido/a a BBJobs",
        "Tu próximo trabajo puede estar más cerca.",
        ("Ya sos parte de BBJobs, el portal de empleo de Bahía Blanca y la zona.",
         "Completá tu perfil y cargá tu CV para que las empresas puedan conocer tu experiencia y "
         "tenerte en cuenta en sus búsquedas. Además, vas a poder postularte a las oportunidades "
         "que te interesen."),
        "Completar mi perfil", CANDIDATE_PROFILE, E),
    "application_sent": MailCopy(
        "Postulación confirmada: {puesto}",
        "¡Tu postulación quedó registrada!",
        ("Te postulaste a **{puesto}** a través de BBJobs.",
         "Tu perfil y tu CV quedaron disponibles para que el equipo responsable de la búsqueda "
         "pueda evaluarlos. Si tu perfil avanza en el proceso, podrán contactarte a través de los "
         "datos que cargaste.",
         "Asegurate de que tu teléfono y correo estén actualizados.",
         "Podés consultar esta y tus otras postulaciones desde tu cuenta."),
        "Ver mis postulaciones", CANDIDATE_APPS, E),
    "application_seen": MailCopy(
        "Tu perfil fue revisado: {puesto}",
        "Hay una novedad sobre tu postulación",
        ("El equipo responsable de la búsqueda de **{puesto}** revisó tu perfil.",
         "Esto todavía no confirma que avances a la siguiente etapa. Si deciden continuar con tu "
         "postulación, podrán contactarte a través de los datos que cargaste."),
        "Ver mi postulación", CANDIDATE_APPS, E),
    "application_in_process": MailCopy(
        "Tu postulación avanzó: {puesto}",
        "¡Tu postulación avanzó!",
        ("El equipo responsable de la búsqueda de **{puesto}** decidió continuar evaluando tu "
         "perfil y tu postulación está **en proceso**.",
         "Prestá atención a tu correo y teléfono: podrán contactarte por esos medios para "
         "coordinar los próximos pasos o solicitarte más información."),
        "Ver mi postulación", CANDIDATE_APPS, E),
    "application_selected": MailCopy(
        "¡Fuiste seleccionado/a para {puesto}!",
        "¡Una nueva etapa comienza!",
        ("El equipo responsable de la búsqueda de **{puesto}** confirmó tu selección para cubrir "
         "la posición.",
         "Los detalles de tu incorporación los coordinarás directamente con la empresa.",
         "Gracias por ser parte de BBJobs. ¡Te deseamos un gran comienzo en este nuevo trabajo!"),
        "Ver mi postulación", CANDIDATE_APPS, E),
    "application_discarded": MailCopy(
        "Novedades sobre tu postulación a {puesto}",
        "Novedades sobre tu postulación",
        ("Gracias por tu interés en la búsqueda de **{puesto}** y por compartir tu experiencia.",
         "Luego de revisar tu perfil, el equipo responsable de la búsqueda decidió no continuar con "
         "tu postulación en esta oportunidad.",
         "Esta decisión corresponde únicamente a esta búsqueda. Te invitamos a seguir postulándote "
         "a otras oportunidades que se ajusten a tu experiencia e intereses.",
         "Gracias por ser parte de BBJobs. ¡Esperamos que encuentres una oportunidad para dar tu "
         "próximo paso laboral!"),
        "Ver otras oportunidades", JOBS, E),
    "application_discarded_interview": MailCopy(
        "Novedades sobre tu postulación a {puesto}",
        "Gracias por tu participación",
        ("Gracias por el tiempo que dedicaste al proceso de selección para **{puesto}** y por "
         "compartir tu experiencia en las entrevistas.",
         "En esta oportunidad, tu candidatura no continuará a la siguiente etapa.",
         "Sabemos que participar de un proceso implica dedicar tiempo y poner expectativas en una "
         "nueva oportunidad. Por eso, queríamos darte una respuesta y agradecerte por tu "
         "participación.",
         "Esta decisión corresponde a esta búsqueda en particular. Esperamos que pronto encuentres "
         "una oportunidad que se ajuste a tu experiencia y a lo que buscás para tu próximo paso "
         "laboral."),
        "Ver otras oportunidades", JOBS, E),
    "talent_profile_unlocked": MailCopy(
        "Una empresa vio tu perfil en BBJobs",
        "¡Tu perfil recibió una visita!",
        ("**{empresa}** consultó tu perfil en la base de candidatos de BBJobs.",
         "Tener tu perfil disponible permite que las empresas conozcan tu experiencia, incluso "
         "cuando no te postulaste a sus búsquedas.",
         "Esta visita no confirma una entrevista. Si la empresa quiere contactarte, podrá hacerlo a "
         "través de los datos que cargaste. Aprovechá para revisar que tu CV, teléfono y correo "
         "estén actualizados."),
        "Ver mi perfil", CANDIDATE_PROFILE, E),
    "profile_incomplete": MailCopy(
        "Tu experiencia merece un perfil completo",
        "Tu experiencia merece un perfil completo",
        ("Tu perfil está completo en un **{porcentaje}%**. Todavía podés sumar información para que "
         "las empresas conozcan mejor tu experiencia, tus conocimientos y el tipo de trabajo que "
         "buscás.",
         "Completá los datos pendientes y revisá que tu CV esté actualizado. Cada dato ayuda a "
         "evaluar tu perfil para oportunidades que se ajusten a vos."),
        "Completar mi perfil", CANDIDATE_PROFILE, E),
    "candidate_reactivation": MailCopy(
        "¿Seguís buscando trabajo? Explorá oportunidades en BBJobs",
        "Tu próxima oportunidad puede estar en BBJobs",
        ("Si seguís buscando trabajo, te invitamos a revisar las búsquedas disponibles en Bahía "
         "Blanca y la zona. Podés consultar los requisitos y postularte a las que se ajusten a tu "
         "experiencia e intereses.",
         "¡Nos gustaría acompañarte en tu próximo paso laboral!"),
        "Ver oportunidades", JOBS, E),

    # ══ Postulante — propuestos con la misma voz ═══════════════════════════════════════
    "application_note": MailCopy(
        "Tenés un mensaje sobre tu postulación a {puesto}",
        "Tenés un mensaje sobre tu postulación",
        ("El equipo responsable de la búsqueda de **{puesto}** te dejó un mensaje.",),
        "Ver mi postulación", CANDIDATE_APPS),
    # Estados que ya no se eligen (Eugenia los sacó el 08/10) pero existen en postulaciones viejas.
    "application_contacted": MailCopy(
        "Novedades sobre tu postulación a {puesto}",
        "Una empresa quiere contactarte",
        ("El equipo responsable de la búsqueda de **{puesto}** quiere contactarte.",
         "Prestá atención a tu correo y teléfono en los próximos días."),
        "Ver mi postulación", CANDIDATE_APPS),
    "application_finalist": MailCopy(
        "Tu postulación avanzó: {puesto}",
        "¡Quedaste entre los finalistas!",
        ("El equipo responsable de la búsqueda de **{puesto}** te eligió entre los finalistas.",
         "Prestá atención a tu correo y teléfono: podrán contactarte para los próximos pasos."),
        "Ver mi postulación", CANDIDATE_APPS),

    # ══ Empresa — textos de Eugenia ════════════════════════════════════════════════════
    "welcome_company": MailCopy(
        "Recibimos el registro de {empresa} en BBJobs",
        "¡Gracias por registrar tu empresa en BBJobs!",
        ("Recibimos los datos de **{empresa}**.",
         "El equipo de Talency los revisará para validar el registro y habilitar la publicación de "
         "búsquedas.",
         "Te avisaremos por correo cuando tu empresa esté habilitada.",
         "Si necesitamos algún dato adicional, nos pondremos en contacto con vos. Por ahora, no "
         "necesitás realizar ninguna acción."),
        None, None, E),
    "company_verified": MailCopy(
        "{empresa} ya puede publicar búsquedas en BBJobs",
        "¡Tu empresa ya está habilitada!",
        ("Verificamos el registro de **{empresa}**. Ya podés publicar búsquedas laborales y recibir "
         "postulaciones en BBJobs.",
         "Para empezar, cargá el puesto que necesitás cubrir, sus tareas y requisitos. Una "
         "descripción clara ayuda a los candidatos a entender la propuesta y decidir si postularse.",
         "Desde tu cuenta vas a poder revisar los perfiles recibidos y gestionar cada postulación."),
        "Publicar una búsqueda", COMPANY_PUBLISH, E),

    # ══ Empresa — propuestos ═══════════════════════════════════════════════════════════
    "company_rejected": MailCopy(
        "Necesitamos revisar el registro de {empresa}",
        "Todavía no pudimos habilitar tu empresa",
        ("Revisamos los datos de **{empresa}** y, por ahora, no pudimos validar el registro.",
         "**Motivo:** {detalle}",
         "Podés corregir los datos desde tu cuenta y volver a enviarlos. Si tenés dudas, escribinos "
         "desde Contacto y te ayudamos."),
        "Revisar mis datos", COMPANY_HOME),
    "company_suspended": MailCopy(
        "La cuenta de {empresa} en BBJobs fue suspendida",
        "Suspendimos la cuenta de tu empresa",
        ("La cuenta de **{empresa}** quedó suspendida: sus búsquedas dejaron de estar visibles y no "
         "se pueden publicar nuevas.",
         "Si querés saber el motivo o creés que se trata de un error, escribinos desde Contacto y "
         "lo revisamos juntos."),
        "Ir a mi cuenta", COMPANY_HOME),
    "company_reactivated": MailCopy(
        "{empresa} vuelve a estar habilitada en BBJobs",
        "¡Tu empresa vuelve a estar habilitada!",
        ("Reactivamos la cuenta de **{empresa}**. Ya podés volver a publicar y gestionar tus "
         "búsquedas en BBJobs.",),
        "Ir a mi cuenta", COMPANY_HOME),
    "company_onboarding_guide": MailCopy(
        "Publicá tu primera búsqueda en BBJobs",
        "Tu primera búsqueda está a pocos minutos",
        ("**{empresa}** ya está habilitada en BBJobs, pero todavía no publicó ninguna búsqueda.",
         "Publicar lleva unos minutos: el puesto, las tareas, los requisitos y la zona. Mientras más "
         "clara sea la descripción, mejores postulaciones vas a recibir.",
         "Cuando lleguen postulaciones, te avisamos por correo con un resumen diario."),
        "Publicar una búsqueda", COMPANY_PUBLISH),
    "job_approved": MailCopy(
        "Tu búsqueda {puesto} ya está publicada",
        "¡Tu búsqueda ya está publicada!",
        ("La búsqueda **{puesto}** fue aprobada y ya está visible en BBJobs para los candidatos de "
         "Bahía Blanca y la zona.",
         "Te vamos a enviar un resumen diario con las postulaciones que vayan llegando. También "
         "podés verlas en cualquier momento desde tu cuenta."),
        "Ver mis búsquedas", COMPANY_JOBS),
    "job_rejected": MailCopy(
        "Tu búsqueda {puesto} necesita cambios",
        "Tu búsqueda necesita algunos cambios",
        ("Revisamos la búsqueda **{puesto}** y, antes de publicarla, necesitamos que ajustes algunos "
         "datos.",
         "**Motivo:** {detalle}",
         "Podés editarla desde tu cuenta y volver a enviarla. Si tenés dudas, escribinos desde "
         "Contacto y te ayudamos."),
        "Revisar la búsqueda", COMPANY_JOBS),
    "job_takedown": MailCopy(
        "La búsqueda {puesto} fue dada de baja",
        "Dimos de baja tu búsqueda",
        ("La búsqueda **{puesto}** dejó de estar visible en BBJobs porque no cumple con las "
         "políticas de publicación.",
         "Si creés que se trata de un error, escribinos desde Contacto y lo revisamos juntos."),
        "Ver mis búsquedas", COMPANY_JOBS),
    "job_reopened": MailCopy(
        "Tu búsqueda {puesto} volvió a estar activa",
        "Tu búsqueda volvió a estar activa",
        ("El equipo de BBJobs reactivó la búsqueda **{puesto}**: ya está visible otra vez y puede "
         "recibir postulaciones.",),
        "Ver mis búsquedas", COMPANY_JOBS),
    "job_deleted": MailCopy(
        "La búsqueda {puesto} fue eliminada",
        "Eliminamos tu búsqueda",
        ("El equipo de BBJobs eliminó la búsqueda **{puesto}** y dejó de estar visible en el portal.",
         "Si tenés dudas, escribinos desde Contacto."),
        "Ver mis búsquedas", COMPANY_JOBS),
    "job_expiring_soon": MailCopy(
        "Tu búsqueda {puesto} está por vencer",
        "Tu búsqueda está por vencer",
        ("La búsqueda **{puesto}** está por llegar a su plazo máximo de publicación y en pocos días "
         "va a dejar de estar visible.",
         "Si todavía no cubriste el puesto, revisá las postulaciones recibidas. Si ya lo cubriste, "
         "actualizá el estado de cada candidato: cada cambio le llega como aviso y nadie queda sin "
         "respuesta."),
        "Ver postulaciones", COMPANY_APPS),
    "job_expired": MailCopy(
        "Tu búsqueda {puesto} venció",
        "Tu búsqueda llegó a su plazo máximo",
        ("La búsqueda **{puesto}** dejó de estar visible en BBJobs.",
         "Las postulaciones que recibiste siguen disponibles en tu cuenta. Te recomendamos darles "
         "una respuesta a los candidatos: cambiar su estado les envía un aviso automático.",
         "Si todavía necesitás cubrir el puesto, podés publicar una búsqueda nueva."),
        "Ver postulaciones", COMPANY_APPS),
    "job_no_applications": MailCopy(
        "Tu búsqueda {puesto} todavía no recibió postulaciones",
        "Algunos ajustes pueden ayudar",
        ("La búsqueda **{puesto}** lleva una semana publicada sin postulaciones.",
         "Tres cosas que suelen ayudar: un título simple, como lo escribiría un candidato (por "
         "ejemplo, \"Administrativo/a contable\"); dejar como excluyentes sólo los requisitos "
         "indispensables; y contar la zona, el horario y, si se puede, el rango salarial.",
         "Podés editarla desde tu cuenta en cualquier momento."),
        "Revisar la búsqueda", None),
    "recommended_candidates_new": MailCopy(
        "Hay perfiles que encajan con tus búsquedas",
        "Encontramos perfiles que encajan con tus búsquedas",
        ("{mensaje}",
         "Son sugerencias orientativas: la decisión siempre es tuya. Podés verlos, con los motivos "
         "de cada sugerencia, en la sección Recomendados."),
        "Ver recomendados", None),
    "job_feature_active": MailCopy(
        "Tu búsqueda {puesto} ya está destacada",
        "¡Tu búsqueda ya está destacada!",
        ("{mensaje}",
         "Las búsquedas destacadas aparecen primeras en el portal y llegan a más candidatos."),
        "Ver mis búsquedas", None),
    "job_feature_rejected": MailCopy(
        "El pago para destacar {puesto} no se acreditó",
        "El pago no se acreditó",
        ("{mensaje}",),
        "Volver a intentarlo", None),
    "job_feature_expired": MailCopy(
        "Terminó el destacado de {puesto}",
        "Terminó el destacado de tu búsqueda",
        ("La búsqueda **{puesto}** sigue publicada, pero ya no aparece entre las destacadas.",),
        "Ver mis búsquedas", None),
    "talent_pack_active": MailCopy(
        "Ya tenés acceso a la Base de Talento de BBJobs",
        "¡Ya tenés acceso a la Base de Talento!",
        ("{mensaje}",
         "Podés buscar perfiles por zona, sector y habilidades, y ver los datos de contacto de los "
         "que te interesen."),
        "Ir a la Base de Talento", None),
    "talent_pack_rejected": MailCopy(
        "El pago de la Base de Talento no se acreditó",
        "El pago no se acreditó",
        ("{mensaje}",),
        "Volver a intentarlo", None),
    "talent_pack_low": MailCopy(
        "Te quedan pocos contactos en la Base de Talento",
        "Te quedan pocos contactos",
        ("{mensaje}",),
        "Ir a la Base de Talento", None),
}


@dataclass(frozen=True)
class DigestCopy:
    subject: str
    heading: str
    intro: str
    cta_label: str
    item_cta: str | None = None
    source: Source = "propuesto"


DIGESTS: dict[str, DigestCopy] = {
    "digest_para_vos": DigestCopy(
        "Las nuevas oportunidades de la semana en BBJobs",
        "Nuevas oportunidades para tu próximo paso laboral",
        "Estas son las búsquedas publicadas esta semana en BBJobs. Revisá los requisitos de cada "
        "propuesta y postulate a las que se ajusten a tu experiencia e intereses.",
        "Ver todas las oportunidades", "Ver búsqueda", E),
    "digest_alertas": DigestCopy(
        "Nuevas búsquedas para tu alerta en BBJobs",
        "Hay búsquedas nuevas que coinciden con tu alerta",
        "Se publicaron en BBJobs y coinciden con lo que estás buscando. Revisá los requisitos y "
        "postulate a las que te interesen.",
        "Ver todas las oportunidades", "Ver búsqueda"),
    "digest_empresa": DigestCopy(
        "Postulaciones nuevas en tus búsquedas",
        "Llegaron postulaciones nuevas",
        "Estas son las postulaciones que recibiste desde el último resumen. Revisá los perfiles y "
        "actualizá su estado: cada cambio le llega como aviso al candidato.",
        "Ver postulaciones"),
}


def copy_for(notification_type: str) -> MailCopy | None:
    return COPY.get(notification_type)
