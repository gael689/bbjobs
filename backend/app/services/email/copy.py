"""El texto de cada mail, separado del texto corto de la campanita.

La notificación de la web es una línea ("Tu postulación avanzó"); el mail es una carta: saludo,
una línea en negrita, dos o tres párrafos, un botón y la firma. Los textos marcados `eugenia`
son los que escribió Talency (PDF "bbjobs mails automáticos": candidatos y E1–E2 el 08/10/2026,
E3–E21 el 19/10/2026) y se copian tal cual, salvo tipeos evidentes; los `propuesto` siguen la
misma voz y esperan su visto bueno. `confirmar` lista las preguntas abiertas para Eugenia
(MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md §3, P8–P13) que afectan a ese texto: la vista previa
las muestra como "A confirmar".

Dos voces (`voice`):
- `candidato`: "¡Hola, X!", una línea en negrita y la firma "BBJobs. El talento de Bahía, más
  cerca." al pie.
- `empresa` (E3 en adelante): "Hola, X:", sin línea en negrita, el renglón de WhatsApp de
  Talency (`help_whatsapp`) y "Saludos, / Equipo de BBJobs / Una iniciativa de Talency".
  En `help_whatsapp`, `{whatsapp}` lo reemplaza el render con el número y el link de
  `settings.TALENCY_WHATSAPP`: nunca sale de texto de un usuario.

Variables (`{nombre}`, `{puesto}`, `{empresa}`, `{porcentaje}`, `{detalle}`, `{mensaje}`,
`{dias}`, `{cantidad}`, `{cantidad_contactos}`, `{puestos}`) se reemplazan en texto plano antes
de escapar (ver `render.py`). A los valores se les sacan los asteriscos: así un título de
búsqueda no puede meter negritas. Un párrafo que queda vacío porque su variable vino vacía
(p. ej. `{detalle}` sin motivo) se omite. `{dias}` llega ya con su unidad ("3 días", "1 día"):
ver `dias_texto`. `{enlace}` (opcional, armado por el sistema) es el link del botón cuando la
plantilla no fija uno, p. ej. la ficha pública de la búsqueda.

`variants`: textos alternativos del mismo aviso, elegidos con la variable `variante` (p. ej.
E20 con una o con varias búsquedas). Si la variante no existe, sale el texto principal.

Un `type` sin entrada acá sale como antes: título y cuerpo de la notificación.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

Source = Literal["eugenia", "propuesto"]
Voice = Literal["candidato", "empresa"]

CANDIDATE_APPS = "/dashboard/candidate/postulaciones"
CANDIDATE_PROFILE = "/dashboard/candidate/perfil"
JOBS = "/empleos"
COMPANY_HOME = "/dashboard/company"
COMPANY_APPS = "/dashboard/company/postulaciones"
COMPANY_JOBS = "/dashboard/company/estadisticas"
COMPANY_MY_JOBS = "/dashboard/company/busquedas"
COMPANY_PUBLISH = "/dashboard/company/publicar"
COMPANY_PROFILE = "/dashboard/company/perfil"
COMPANY_TALENT = "/dashboard/company/talento"
COMPANY_RECOMMENDED = "/dashboard/company/recomendados"

COMPANY_MESSAGE_LABEL = "Mensaje de la empresa:"
WHATSAPP_TOKEN = "{whatsapp}"


@dataclass(frozen=True)
class MailCopy:
    subject: str
    # Vacío = sin línea en negrita (los textos de empresa de Eugenia no la tienen).
    heading: str
    paragraphs: tuple[str, ...]
    cta_label: str | None = None
    # `None` = `{enlace}` si vino, y si no el link de la notificación.
    link: str | None = None
    source: Source = "propuesto"
    voice: Voice = "candidato"
    # Renglón de ayuda con `{whatsapp}` (lo arma el render desde la configuración).
    help_whatsapp: str | None = None
    # False = el mail no lleva botón (E1 y E4: no hay nada que hacer en la cuenta).
    button: bool = True
    # Preguntas abiertas para Eugenia que tocan este texto (P8–P13).
    confirmar: tuple[str, ...] = ()
    # El asunto no estaba en su PDF: lo armamos con el título del aviso (P12).
    subject_proposed: bool = False
    variants: dict[str, "MailCopy"] = field(default_factory=dict, hash=False, compare=False)


_VAR = re.compile(r"\{([a-z_]+)\}")


def clean_value(value: object) -> str:
    return str(value if value is not None else "").replace("*", "").strip()


def fill(template: str, variables: dict[str, str]) -> str:
    return _VAR.sub(lambda m: variables.get(m.group(1), ""), template)


def first_name(full_name: str | None) -> str:
    return (full_name or "").strip().split(" ")[0] if full_name and full_name.strip() else ""


def greeting(nombre: str | None, voice: Voice = "candidato") -> str:
    if voice == "empresa":
        return f"Hola, {nombre}:" if nombre else "Hola:"
    return f"¡Hola, {nombre}!" if nombre else "¡Hola!"


def dias_texto(n: int) -> str:
    """`{dias}` con su unidad: "1 día", "3 días"."""
    return f"{n} día" if n == 1 else f"{n} días"


@dataclass(frozen=True)
class FilledCopy:
    subject: str
    heading: str
    body: str
    cta_label: str | None
    link: str | None
    voice: Voice = "candidato"
    help_whatsapp: str | None = None
    button: bool = True


def pick_variant(copy: MailCopy, variant: object | None) -> MailCopy:
    return copy.variants.get(str(variant), copy) if variant else copy


def fill_copy(copy: MailCopy, variables: dict[str, object], default_link: str | None) -> FilledCopy:
    values = {k: clean_value(v) for k, v in variables.items()}
    copy = pick_variant(copy, values.get("variante"))
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
        link=copy.link or values.get("enlace") or default_link,
        voice=copy.voice,
        help_whatsapp=copy.help_whatsapp,
        button=copy.button,
    )


E = "eugenia"
EMP = "empresa"

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

    # ══ Empresa — textos de Eugenia (E1 y E2, 08/10/2026: con el estilo de los candidatos) ══
    "welcome_company": MailCopy(
        "Recibimos el registro de {empresa} en BBJobs",
        "¡Gracias por registrar tu empresa en BBJobs!",
        ("Recibimos los datos de **{empresa}**.",
         "El equipo de Talency los revisará para validar el registro y habilitar la publicación de "
         "búsquedas.",
         "Te avisaremos por correo cuando tu empresa esté habilitada.",
         "Si necesitamos algún dato adicional, nos pondremos en contacto con vos. Por ahora, no "
         "necesitás realizar ninguna acción."),
        None, None, E, button=False, confirmar=("P12",)),
    "company_verified": MailCopy(
        "{empresa} ya puede publicar búsquedas en BBJobs",
        "¡Tu empresa ya está habilitada!",
        ("Verificamos el registro de **{empresa}**. Ya podés publicar búsquedas laborales y recibir "
         "postulaciones en BBJobs.",
         "Para empezar, cargá el puesto que necesitás cubrir, sus tareas y requisitos. Una "
         "descripción clara ayuda a los candidatos a entender la propuesta y decidir si postularse.",
         "Desde tu cuenta vas a poder revisar los perfiles recibidos y gestionar cada postulación."),
        "Publicar una búsqueda", COMPANY_PUBLISH, E, confirmar=("P12",)),

    # ══ Empresa — textos de Eugenia (E3–E21, 19/10/2026: "Hola, X:", WhatsApp y "Saludos") ══
    # Los asuntos que no estaban en el PDF salen del título de cada aviso (P12).
    # E3. Sin el párrafo "Motivo": ella escribió "ingresá a tu cuenta" (P11).
    "company_rejected": MailCopy(
        "Necesitamos revisar los datos de tu empresa", "",
        ("Revisamos la información de tu empresa y no pudimos completar la verificación con los "
         "datos proporcionados.",
         "Para continuar, ingresá a tu cuenta, revisá la información registrada y realizá las "
         "correcciones necesarias. Luego, enviá nuevamente la solicitud para que podamos evaluarla."),
        "Revisar datos de mi empresa", COMPANY_PROFILE, E, EMP,
        "Si necesitás ayuda con la verificación, escribinos por WhatsApp al {whatsapp} y te "
        "orientamos para completar el proceso.",
        confirmar=("P11",), subject_proposed=True),
    # E4. Su texto no tiene saludo ni botón; el saludo lo sumamos (P12).
    "company_suspended": MailCopy(
        "Tu empresa fue suspendida", "",
        ("Te informamos que la cuenta de tu empresa en BBJobs fue suspendida. Mientras la "
         "suspensión esté vigente, no podrás utilizar las funciones disponibles para empresas en la "
         "plataforma.",),
        None, None, E, EMP,
        "Para conocer el motivo y recibir orientación sobre los pasos a seguir, escribinos por "
        "WhatsApp al {whatsapp}.",
        button=False, confirmar=("P12",), subject_proposed=True),
    # E5
    "company_reactivated": MailCopy(
        "Tu empresa ya puede volver a operar en BBJobs", "",
        ("Te confirmamos que la cuenta de tu empresa fue reactivada. Ya podés ingresar y volver a "
         "utilizar las funciones de la plataforma para gestionar tus búsquedas laborales.",),
        "Ingresar a mi cuenta", COMPANY_HOME, E, EMP,
        "Si necesitás ayuda o tenés alguna consulta, escribinos por WhatsApp al {whatsapp}."),
    # E6. Su firma traía también "El talento de Bahía, más cerca.": queda la de empresas (P12).
    "company_onboarding_guide": MailCopy(
        "Publicá tu primera búsqueda", "",
        ("Tu empresa ya está verificada en BBJobs. Si estás buscando sumar personas a tu equipo, "
         "podés publicar tus ofertas laborales de forma gratuita y recibir postulaciones desde la "
         "plataforma.",
         "Ingresá a tu cuenta y completá la información del puesto, los requisitos y el lugar de "
         "trabajo. Una vez aprobada la publicación, estará disponible para quienes buscan empleo en "
         "Bahía Blanca y la zona."),
        "Publicar una búsqueda", COMPANY_PUBLISH, E, EMP,
        "Si necesitás ayuda para crear tu primer aviso, escribinos por WhatsApp al {whatsapp}.",
        confirmar=("P12",), subject_proposed=True),
    # E7. "Ver mi publicación" lleva a la ficha pública (`{enlace}`, ver admin.py).
    "job_approved": MailCopy(
        "Tu publicación fue aprobada", "",
        ("La publicación para el puesto de **{puesto}** fue aprobada y ya está visible en BBJobs. "
         "Las personas interesadas pueden conocer la propuesta y postularse desde la plataforma.",
         "Desde tu cuenta podés consultar las postulaciones recibidas, revisar los perfiles y "
         "gestionar el avance de los candidatos."),
        "Ver mi publicación", None, E, EMP,
        "Si necesitás ayuda, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
    # E8. Sin "Motivo" en el mail: se consulta en la cuenta (P11).
    "job_rejected": MailCopy(
        "Revisá tu publicación para continuar", "",
        ("Revisamos tu publicación para el puesto de **{puesto}** y necesitamos que realices algunos "
         "ajustes antes de aprobarla.",
         "Ingresá a tu cuenta para consultar el motivo, modificar la información indicada y enviar "
         "nuevamente el aviso para su revisión."),
        "Revisar mi publicación", COMPANY_MY_JOBS, E, EMP,
        "Si tenés alguna consulta o necesitás ayuda con los cambios, escribinos por WhatsApp al "
        "{whatsapp}.",
        confirmar=("P11",)),
    # E9. La ficha pública ya no existe: "Ver mi publicación" lleva a Mis búsquedas.
    "job_takedown": MailCopy(
        "Tu publicación fue dada de baja", "",
        ("Te informamos que la publicación para el puesto de **{puesto}** fue dada de baja por "
         "incumplimiento de las políticas de BBJobs. El aviso ya no está visible y no recibe nuevas "
         "postulaciones.",),
        "Ver mi publicación", COMPANY_MY_JOBS, E, EMP,
        "Para conocer el motivo de la baja y recibir orientación sobre los pasos a seguir, "
        "escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
    # E10
    "job_reopened": MailCopy(
        "Tu publicación volvió a estar activa", "",
        ("Te confirmamos que la publicación para el puesto de **{puesto}** fue reactivada. El aviso "
         "vuelve a estar visible en BBJobs y puede recibir nuevas postulaciones.",
         "Ingresá a tu cuenta para consultar los perfiles y continuar gestionando tu búsqueda."),
        "Ver mi publicación", None, E, EMP,
        "Si necesitás ayuda o tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
    # E11. En su texto el WhatsApp va antes del botón; acá va después, como en todos.
    "job_deleted": MailCopy(
        "Tu publicación fue eliminada", "",
        ("Te informamos que la publicación para el puesto de **{puesto}** fue eliminada por el "
         "equipo de BBJobs. El aviso ya no está disponible en la plataforma y no recibe nuevas "
         "postulaciones.",),
        "Ir a mi cuenta", COMPANY_HOME, E, EMP,
        "Para conocer el motivo o realizar una consulta, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
    # E12. "{dias}" en lugar de "3 días" fijo: si la búsqueda dura menos, el aviso llega antes (P8).
    "job_expiring_soon": MailCopy(
        "Tu publicación está por vencer", "",
        ("Te recordamos que la publicación para el puesto de **{puesto}** vencerá en {dias}, al "
         "cumplirse el plazo máximo de publicación.",
         "A partir de ese momento, el aviso dejará de estar visible y no recibirá nuevas "
         "postulaciones.",
         "Ingresá a tu cuenta para revisar las postulaciones recibidas y actualizar el estado de los "
         "candidatos."),
        "Gestionar mi búsqueda", COMPANY_APPS, E, EMP,
        "Si todavía necesitás cubrir el puesto, escribinos por WhatsApp al {whatsapp} para que "
        "podamos orientarte sobre cómo continuar.",
        confirmar=("P8",), subject_proposed=True),
    # E13. Su texto decía "30 días (o los días que dijimos)": va la duración real de la búsqueda,
    # que es de 20 días como máximo (schemas/job.py) y la empresa puede acortar (P8).
    "job_expired": MailCopy(
        "Finalizó el plazo de tu publicación en BBJobs", "",
        ("La publicación para el puesto de **{puesto}** cumplió el plazo máximo de {dias}. Por "
         "este motivo, el aviso dejó de estar visible en BBJobs y ya no recibe nuevas postulaciones.",
         "Ingresá a tu cuenta para revisar las postulaciones recibidas y actualizar el estado de los "
         "candidatos."),
        "Gestionar mi búsqueda", COMPANY_APPS, E, EMP,
        "Si todavía necesitás cubrir el puesto, escribinos por WhatsApp al {whatsapp} para que "
        "podamos orientarte sobre cómo continuar.",
        confirmar=("P8",)),
    # E14
    "job_no_applications": MailCopy(
        "Tu publicación todavía no recibió postulaciones", "",
        ("La publicación para el puesto de **{puesto}** lleva una semana en BBJobs y todavía no "
         "recibió postulaciones.",
         "Es un buen momento para revisar que el título describa claramente el puesto, que las "
         "tareas y condiciones estén detalladas y que los requisitos excluyentes sean únicamente los "
         "indispensables.",
         "Incluir información sobre la jornada, el lugar de trabajo y los beneficios también ayuda a "
         "que las personas evalúen la propuesta y decidan postularse."),
        "Revisar mi publicación", COMPANY_MY_JOBS, E, EMP,
        "Si necesitás orientación para ajustar el aviso, escribinos por WhatsApp al {whatsapp}."),
    # E15. Sólo cuando la empresa pagó. Si Talency lo destaca sin cargo sale `job_feature_granted`.
    # Si la búsqueda todavía espera aprobación, la variante `sin_aprobar` no dice "ya está activo".
    "job_feature_active": MailCopy(
        "Tu publicación ya está destacada", "",
        ("El servicio de aviso destacado que contrataste para el puesto de **{puesto}** ya está "
         "activo en BBJobs.",
         "Tu publicación contará con una ubicación destacada en el portal durante el período "
         "contratado, para darle mayor visibilidad a tu propuesta."),
        "Ver mi publicación", None, E, EMP,
        "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True,
        variants={"sin_aprobar": MailCopy(
            "Recibimos el pago para destacar tu publicación", "",
            ("Se acreditó el pago del servicio de aviso destacado que contrataste para el puesto de "
             "**{puesto}**.",
             "Tu publicación se va a mostrar destacada apenas la aprobemos y, mientras tanto, tiene "
             "prioridad de revisión. Desde ese momento contará con una ubicación destacada en el "
             "portal durante el período contratado."),
            "Ver mis búsquedas", COMPANY_MY_JOBS, "propuesto", EMP,
            "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.")}),
    # E16
    "job_feature_rejected": MailCopy(
        "El pago no se acreditó", "",
        ("El pago para destacar tu publicación del puesto de **{puesto}** fue rechazado o "
         "cancelado, por lo que el servicio de aviso destacado no se activó.",
         "Podés ingresar a tu cuenta y volver a intentar el pago para completar la contratación."),
        "Reintentar el pago", COMPANY_MY_JOBS, E, EMP,
        "Si necesitás ayuda o tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
    # E17. Sale cuando termina el destacado o cuando Talency lo saca a mano.
    "job_feature_expired": MailCopy(
        "El destacado de tu publicación fue desactivado", "",
        ("Te informamos que se desactivó el destacado de tu publicación para el puesto de "
         "**{puesto}**. El aviso ya no aparece en los espacios destacados del portal.",
         "Podés ingresar a tu cuenta para consultar el estado de la publicación y gestionar tu "
         "búsqueda."),
        "Ir a mi cuenta", COMPANY_HOME, E, EMP,
        "Si tenés alguna consulta sobre el servicio contratado, escribinos por WhatsApp al "
        "{whatsapp}.",
        subject_proposed=True),
    # E18. Sólo cuando la empresa pagó. Si Talency lo regala sale `talent_pack_granted`.
    "talent_pack_active": MailCopy(
        "Ya tenés acceso a la base de candidatos de BBJobs", "",
        ("Se acreditó tu pago y ya podés acceder a la base completa de candidatos de BBJobs para "
         "explorar perfiles e identificar personas que se ajusten a las necesidades de tu empresa.",
         "Tu compra incluye {cantidad_contactos} contactos, que podés utilizar para acceder a los "
         "datos de contacto de los candidatos que te interesen."),
        "Explorar la base de candidatos", COMPANY_TALENT, E, EMP,
        "Si necesitás ayuda para comenzar o tenés alguna consulta sobre tu compra, escribinos por "
        "WhatsApp al {whatsapp}."),
    # E19
    "talent_pack_rejected": MailCopy(
        "No se completó el pago para acceder a la base de candidatos", "",
        ("El pago de tu pack de contactos para la base de candidatos de BBJobs fue rechazado o "
         "cancelado, por lo que no se completó la compra.",
         "Podés ingresar a tu cuenta y volver a intentar el pago. Una vez acreditado, los contactos "
         "incluidos en el pack estarán disponibles para utilizar."),
        "Reintentar el pago", COMPANY_TALENT, E, EMP,
        "Si necesitás ayuda o tenés alguna consulta, escribinos por WhatsApp al {whatsapp}."),
    # E20. Su texto es por búsqueda. Sale uno por empresa por noche: con una búsqueda va su texto;
    # con un solo perfil o con varias búsquedas, las variantes propuestas (P10).
    "recommended_candidates_new": MailCopy(
        "Tenés nuevos perfiles recomendados para tu búsqueda", "",
        ("Identificamos {cantidad} nuevos perfiles que podrían ajustarse a los requisitos de tu "
         "búsqueda de **{puesto}**.",
         "Podés revisarlos en la sección Recomendados de tu cuenta y evaluar si se ajustan a lo que "
         "necesita tu empresa."),
        "Ver perfiles recomendados", COMPANY_RECOMMENDED, E, EMP,
        "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        confirmar=("P10",),
        variants={
            "uno": MailCopy(
                "Tenés un nuevo perfil recomendado para tu búsqueda", "",
                ("Identificamos un nuevo perfil que podría ajustarse a los requisitos de tu búsqueda "
                 "de **{puesto}**.",
                 "Podés revisarlo en la sección Recomendados de tu cuenta y evaluar si se ajusta a "
                 "lo que necesita tu empresa."),
                "Ver perfiles recomendados", COMPANY_RECOMMENDED, "propuesto", EMP,
                "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.", confirmar=("P10",)),
            "varias": MailCopy(
                "Tenés nuevos perfiles recomendados para tus búsquedas", "",
                ("Identificamos {cantidad} nuevos perfiles que podrían ajustarse a los requisitos de "
                 "tus búsquedas: **{puestos}**.",
                 "Podés revisarlos en la sección Recomendados de tu cuenta y evaluar si se ajustan a "
                 "lo que necesita tu empresa."),
                "Ver perfiles recomendados", COMPANY_RECOMMENDED, "propuesto", EMP,
                "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.", confirmar=("P10",)),
        }),

    # ══ Empresa — propuestos (P9 y P13) ════════════════════════════════════════════════
    # Destacado y pack que regala Talency: adaptados de E15 y E18, sin "contrataste" ni "pago".
    "job_feature_granted": MailCopy(
        "Tu publicación ya está destacada", "",
        ("El equipo de BBJobs destacó tu publicación para el puesto de **{puesto}**, sin costo para "
         "tu empresa.",
         "Tu publicación contará con una ubicación destacada en el portal mientras esté vigente, "
         "para darle mayor visibilidad a tu propuesta."),
        "Ver mi publicación", None, "propuesto", EMP,
        "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        confirmar=("P9",)),
    "talent_pack_granted": MailCopy(
        "Ya tenés acceso a la base de candidatos de BBJobs", "",
        ("El equipo de BBJobs te habilitó el acceso a la base completa de candidatos de BBJobs para "
         "explorar perfiles e identificar personas que se ajusten a las necesidades de tu empresa.",
         "Tenés {cantidad_contactos} contactos disponibles, que podés utilizar para acceder a los "
         "datos de contacto de los candidatos que te interesen."),
        "Explorar la base de candidatos", COMPANY_TALENT, "propuesto", EMP,
        "Si necesitás ayuda para comenzar o tenés alguna consulta, escribinos por WhatsApp al "
        "{whatsapp}.",
        confirmar=("P9",)),
    "talent_pack_low": MailCopy(
        "Te quedan pocos contactos en la base de candidatos", "",
        ("{mensaje}",
         "Cuando se terminen, podés sumar un pack nuevo desde tu cuenta."),
        "Ir a la base de candidatos", COMPANY_TALENT, "propuesto", EMP,
        "Si tenés alguna consulta, escribinos por WhatsApp al {whatsapp}.",
        confirmar=("P13",)),
}


@dataclass(frozen=True)
class DigestCopy:
    subject: str
    heading: str
    intro: str
    cta_label: str
    item_cta: str | None = None
    source: Source = "propuesto"
    voice: Voice = "candidato"
    # Párrafo que va después de la lista (E21).
    outro: str | None = None
    help_whatsapp: str | None = None
    confirmar: tuple[str, ...] = ()
    subject_proposed: bool = False


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
        "Ver todas las oportunidades", "Ver búsqueda", confirmar=("P13",)),
    # E21
    "digest_empresa": DigestCopy(
        "Tu resumen de postulaciones", "",
        "Estas son las nuevas postulaciones que recibieron tus búsquedas desde el último resumen:",
        "Ver postulaciones", None, E, EMP,
        outro=("Ingresá a tu cuenta para conocer los perfiles y actualizar el estado de cada "
               "candidato. Así, quienes se postularon también podrán recibir novedades sobre su "
               "participación en el proceso."),
        help_whatsapp="Si necesitás ayuda, escribinos por WhatsApp al {whatsapp}.",
        subject_proposed=True),
}


def copy_for(notification_type: str) -> MailCopy | None:
    return COPY.get(notification_type)
