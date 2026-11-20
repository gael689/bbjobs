"""Los agentes de IA del portal: quién es cada uno, qué hace y con qué instrucciones (IA-AGENTES-PLAN.md).

Idea tomada del centro-nuevo de Solven: **un agente por tarea**, el código antes y después de la
IA, y las instrucciones en un archivo (`app/agentes/<clave>.md`) cuyo hash es la versión. Si
alguien cambia una coma de las instrucciones, la versión cambia sola y lo cacheado con la versión
vieja se recalcula: ya no hay que acordarse de tocar un `PROMPT_VERSION` a mano.

Este módulo no importa a ningún otro de `services/ai` (los demás lo importan a él). Lo que acá se
describe es lo que ve Talency en Centro de IA → Agentes: en castellano llano y sin jerga.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

CARPETA = Path(__file__).resolve().parents[2] / "agentes"

Equipo = Literal["recomendaciones", "asistentes", "talency"]
Tipo = Literal["ia", "vectores"]
Modelo = Literal["generacion", "revision", "embeddings"]


@lru_cache(maxsize=None)
def instrucciones(clave: str) -> str:
    """El texto exacto que recibe Gemini como instrucciones del sistema."""
    return (CARPETA / f"{clave}.md").read_text(encoding="utf-8").rstrip("\n")


@lru_cache(maxsize=None)
def version(clave: str) -> str:
    """`<clave>@<8 del sha256 de las instrucciones>`: cambia sola cuando cambia el texto."""
    return f"{clave}@{hashlib.sha256(instrucciones(clave).encode('utf-8')).hexdigest()[:8]}"


@dataclass(frozen=True)
class Agente:
    clave: str
    nombre: str
    equipo: Equipo
    tipo: Tipo
    modelo: Modelo
    que_hace: str
    recibe: str
    devuelve: str
    nunca: str
    # Las `feature` con que se anota su gasto en `ai_usage_log` (la primera es la actual; las
    # demás, nombres viejos que se siguen sumando para no perder la historia).
    features: tuple[str, ...]
    # `SettingKey` que lo prende y apaga (lo maneja Talency en Configuración), si tiene.
    interruptor: str | None = None
    # Para los de tipo "ia": tienen archivo de instrucciones.
    con_instrucciones: bool = True


AGENTES: tuple[Agente, ...] = (
    Agente(
        clave="lector_cv", nombre="Lector de CV", equipo="recomendaciones", tipo="vectores", modelo="embeddings",
        que_hace="Lee el CV que sube cada candidato, le saca los datos personales y lo guarda en partes "
                 "que la IA puede comparar con las búsquedas.",
        recibe="El PDF del CV (nunca sale del servidor).",
        devuelve="El texto sin nombre, teléfono, mail, DNI, edad ni estado civil, partido en fragmentos.",
        nunca="Mandar el CV completo ni datos personales a Google. Leer el CV de quien se opuso a la IA.",
        features=("embeddings",), interruptor="ia_recomendaciones_activas", con_instrucciones=False,
    ),
    Agente(
        clave="requisitos", nombre="Requisitos", equipo="recomendaciones", tipo="ia", modelo="generacion",
        que_hace="Lee el texto de cada búsqueda y saca la lista de requisitos (experiencia, habilidades, "
                 "licencias, horarios…). Una sola vez por búsqueda.",
        recibe="El título, la descripción y las habilidades cargadas de la búsqueda.",
        devuelve="Hasta 12 requisitos, cada uno marcado como excluyente o deseable.",
        nunca="Usar requisitos de edad, género o «buena presencia»: si el aviso los pide, se descartan "
              "y se avisa.",
        features=("requisitos",), interruptor="ia_recomendaciones_activas",
    ),
    Agente(
        clave="evaluador", nombre="Evaluador", equipo="recomendaciones", tipo="ia", modelo="generacion",
        que_hace="Para los 30 mejores candidatos de cada búsqueda, mira requisito por requisito si el "
                 "perfil lo cumple y en qué parte del CV lo vio. De a un candidato por vez.",
        recibe="Los requisitos y unos pocos fragmentos anonimizados del perfil.",
        devuelve="Por requisito: cumple, cumple en parte, no cumple o no dice nada, y el fragmento. La cita "
                 "y los motivos los arma el sistema con eso, sin IA.",
        nunca="Descartar a nadie, cambiar el estado de una postulación ni mandar mails.",
        features=("evaluador", "rerank"), interruptor="ia_recomendaciones_activas",
    ),
    Agente(
        clave="revisor", nombre="Revisor", equipo="recomendaciones", tipo="ia", modelo="revision",
        que_hace="Segunda opinión, con un modelo mejor, solo para los candidatos que quedaron cerca del "
                 "corte que decide si se les avisa de la búsqueda (puntaje entre 60 y 79).",
        recibe="Lo mismo que el Evaluador.",
        devuelve="Lo mismo que el Evaluador. Si su respuesta es válida, reemplaza a la del Evaluador.",
        nunca="Lo mismo que el Evaluador. Tampoco revisa a todos: solo a los de la franja dudosa.",
        features=("revisor",), interruptor="ia_recomendaciones_activas",
    ),
    Agente(
        clave="resumidor", nombre="Resumidor", equipo="recomendaciones", tipo="ia", modelo="generacion",
        que_hace="Escribe el resumen de 3 líneas de cada recomendado, para que la empresa lo lea rápido. "
                 "Trabaja de noche con los mejores de cada búsqueda.",
        recibe="Los fragmentos anonimizados del perfil y lo que ya validó el Evaluador.",
        devuelve="Hasta 3 líneas, cada una respaldada por una frase del CV.",
        nunca="Hablar de edad, género, estado civil, hijos, nacionalidad, salud, religión o apariencia. "
              "Ir por mail: solo se ve en pantalla.",
        features=("resumen",), interruptor="ia_recomendaciones_activas",
    ),
    Agente(
        clave="moderador", nombre="Moderador", equipo="talency", tipo="vectores", modelo="embeddings",
        que_hace="Cuando llega una búsqueda para aprobar, avisa si se parece mucho a otra (posible "
                 "duplicado) o si el rubro elegido parece equivocado.",
        recibe="El título y la descripción de la búsqueda.",
        devuelve="Señales para que Talency mire. Con pocos datos, no dice nada.",
        nunca="Rechazar ni cambiar una búsqueda: la decisión es siempre de Talency.",
        features=("moderacion",), interruptor="ia_recomendaciones_activas", con_instrucciones=False,
    ),
    Agente(
        clave="redactor_busquedas", nombre="Redactor de búsquedas", equipo="asistentes", tipo="ia",
        modelo="generacion",
        que_hace="La empresa escribe unas líneas y este agente le propone el aviso completo: título, "
                 "descripción, requisitos, rubro y habilidades.",
        recibe="Lo que escribió la empresa y el catálogo de rubros y habilidades.",
        devuelve="Una propuesta que la empresa edita. Avisa si el texto pide algo discriminatorio.",
        nunca="Inventar sueldos ni beneficios. Publicar nada: Talency modera igual.",
        features=("redaccion",), interruptor="asistente_ia_activo",
    ),
    Agente(
        clave="habilidades", nombre="Habilidades", equipo="asistentes", tipo="ia", modelo="generacion",
        que_hace="Le sugiere al candidato habilidades del catálogo que su CV demuestra y todavía no marcó.",
        recibe="El texto anonimizado del CV y el catálogo de habilidades.",
        devuelve="Hasta 10 habilidades, cada una con la frase del CV que la respalda.",
        nunca="Guardar nada por su cuenta: el candidato decide con un clic. Mandar mails.",
        features=("habilidades",), interruptor="asistente_ia_activo",
    ),
    Agente(
        clave="buscador", nombre="Buscador", equipo="asistentes", tipo="ia", modelo="generacion",
        que_hace="Traduce lo que alguien escribe en el buscador de empleos («algo de administración part "
                 "time cerca de Punta Alta») a filtros.",
        recibe="La frase escrita y las listas de zonas, rubros y modalidades.",
        devuelve="Filtros de esas listas y unas pocas palabras clave. La persona decide si los aplica.",
        nunca="Filtrar por edad o género. Inventar zonas o rubros que no existen.",
        features=("busqueda",), interruptor="busqueda_ia_activa",
    ),
    Agente(
        clave="redactor_campanas", nombre="Redactor de campañas", equipo="talency", tipo="ia",
        modelo="generacion",
        que_hace="Talency describe la idea de una campaña de mail y este agente propone asuntos, texto y botón.",
        recibe="La idea de la campaña y a quién va.",
        devuelve="Un borrador que Talency edita y aprueba.",
        nunca="Mandar nada: la campaña sale solo cuando Talency la aprueba. Prometer resultados ni "
              "inventar cifras.",
        features=("campana_borrador",),
    ),
    Agente(
        clave="audiencias", nombre="Audiencias", equipo="talency", tipo="ia", modelo="generacion",
        que_hace="Traduce «empresas de Punta Alta» o «candidatos de logística» a una de las audiencias "
                 "predefinidas.",
        recibe="El pedido escrito y la lista de audiencias posibles.",
        devuelve="Una audiencia de la lista, y zona o rubro si se nombraron.",
        nunca="Armar consultas a la base: elige de una lista cerrada.",
        features=("campana_audiencia",),
    ),
)

POR_CLAVE = {a.clave: a for a in AGENTES}

# El recorrido de las recomendaciones, con los pasos de código en el medio (lo muestra la pantalla).
RECORRIDO: tuple[tuple[str, str], ...] = (
    ("agente", "lector_cv"),
    ("agente", "requisitos"),
    ("codigo", "Puntaje de todos los candidatos (habilidades, experiencia, estudios, zona, parecido del CV)"),
    ("agente", "evaluador"),
    ("agente", "revisor"),
    ("codigo", "Citas y motivos armados desde lo validado"),
    ("agente", "resumidor"),
    ("codigo", "Aviso al candidato: puntaje 70 o más, un mail por día como mucho"),
)


# ── Lo que hace el código alrededor de cada agente (IA-AGENTES-PLAN.md §7) ─────────────────
# La regla: la IA solo para lo que el código no puede resolver. Esto es lo que resuelve el código.
CODIGO: dict[str, str] = {
    "lector_cv": "Todo es código: extrae el texto del PDF, saca los datos personales con reglas fijas y verifica "
                 "que no quede ninguno antes de mandar nada. Un CV que no cambió no se vuelve a leer.",
    "requisitos": "Descarta los requisitos discriminatorios aunque la IA los devuelva. Una búsqueda que no "
                  "cambió no se vuelve a leer.",
    "evaluador": "Antes: el puntaje de todos los candidatos, sin IA. La IA solo ve a los 30 mejores. Después: "
                 "elige la frase del CV que respalda cada respuesta y escribe los motivos. Si no hay frase, "
                 "el «cumple» se descarta. Un perfil y una búsqueda que no cambiaron no se vuelven a evaluar.",
    "revisor": "Solo se llama si el puntaje quedó en la franja dudosa y queda presupuesto en el día. Su "
               "respuesta pasa por los mismos controles que la del Evaluador.",
    "resumidor": "Cada línea tiene que estar respaldada por una frase del CV, o se descarta. Lo que no cambió "
                 "no se vuelve a resumir.",
    "moderador": "Todo es código: compara el aviso con los demás por parecido de texto. No escribe nada.",
    "redactor_busquedas": "Borra cualquier sueldo o beneficio que la empresa no haya mencionado, y valida rubro "
                          "y habilidades contra el catálogo.",
    "habilidades": "Solo acepta habilidades que estén en el catálogo y cuya frase aparezca en el CV. El mismo CV "
                   "no se vuelve a analizar.",
    "buscador": "Solo llama a la IA si la frase parece escrita como se habla («busco algo de…»): una búsqueda "
                "de pocas palabras va directo, sin IA. La misma frase no se paga dos veces en el día. El "
                "«Buscás: …» que ve la persona lo arma el sistema con los filtros.",
    "redactor_campanas": "Nada sale sin que Talency lo apruebe. El texto se muestra como texto plano.",
    "audiencias": "Si la IA elige una audiencia que no existe, se descarta. Zona y rubro se buscan en el "
                  "catálogo.",
}

# Tokens típicos de un uso (entrada, salida), para estimar el costo antes de tener datos reales.
# Estimados por el tamaño de cada pedido (instrucciones + datos + respuesta esperada); el Centro de IA
# muestra además el promedio real cuando hay datos.
TOKENS_TIPICOS: dict[str, tuple[int, int]] = {
    "lector_cv": (1500, 0),
    "requisitos": (800, 250),
    "evaluador": (1400, 150),
    "revisor": (1400, 150),
    "resumidor": (1200, 250),
    "moderador": (600, 0),
    "redactor_busquedas": (1500, 700),
    "habilidades": (2500, 400),
    "buscador": (1000, 80),
    "redactor_campanas": (400, 500),
    "audiencias": (300, 40),
}

# Una búsqueda típica (mediana medida el 04/10/2026: 62 postulantes, ~20 búsquedas por mes).
POR_BUSQUEDA: dict[str, float] = {
    "requisitos": 1, "evaluador": 30, "revisor": 6, "resumidor": 5,
}
BUSQUEDAS_POR_MES = 20


def modelo_de(a: Agente) -> str:
    from app.core.config import settings
    return {"generacion": settings.GEMINI_GENERATION_MODEL, "revision": settings.GEMINI_REVIEW_MODEL,
            "embeddings": settings.GEMINI_EMBEDDING_MODEL}[a.modelo]


def costo_estimado(clave: str, cuando=None) -> float:
    """USD de un uso típico de este agente, con los precios vigentes en `cuando` (hoy si no se da)."""
    from app.services.ai import precios
    entrada, salida = TOKENS_TIPICOS[clave]
    return float(precios.costo(modelo_de(POR_CLAVE[clave]), entrada, salida, cuando=cuando))


def costo_por_busqueda(cuando=None) -> float:
    """USD de las recomendaciones de una búsqueda típica (sin los CV, que se leen una sola vez)."""
    return round(sum(n * costo_estimado(k, cuando) for k, n in POR_BUSQUEDA.items()), 6)
