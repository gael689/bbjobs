# IA por agentes — plan (15/11/2026)

Pedido de Gael: «crear los agentes para la IA que usamos ahora, para que funcione mejor y sea más
barata, y que Eugenia los pueda VER en el admin». Seguimos con Gemini. La prospección queda para
después.

La idea viene del centro-nuevo de Solven (`Desktop\centro-nuevo`): **un agente por tarea**, el
código antes y después de la IA, las instrucciones en un archivo cuyo hash es la versión, y una
pantalla donde se ve qué hace cada uno y cuánto gasta. **No** se trae el modo «sesión con token»
ni Claude: la política de privacidad declara a Google (Gemini) como único proveedor de IA.

## 1. Los agentes

Lo que ya existía se ordena como agentes con nombre. Lo único que cambia de comportamiento es el
rerank, que se parte en dos (§2).

| Agente | Qué hace | Modelo | Interruptor |
|---|---|---|---|
| Lector de CV | Extrae el texto del CV, lo anonimiza y lo pasa a vectores. Sin IA que escriba | embeddings | `ia_recomendaciones_activas` |
| Requisitos | Saca los requisitos del texto de la búsqueda, una vez por búsqueda | lite | ídem |
| **Evaluador** | Por requisito y por candidato: sí / parcial / no / sin datos, y en qué fragmento lo vio. Nada más | lite | ídem |
| **Revisor** (nuevo) | Segunda opinión, con un modelo mejor, solo para los candidatos que quedaron cerca del corte de 70 (60–79) | flash | ídem |
| Resumidor | Las 3 líneas del perfil para la empresa (de noche, los mejores) | lite | ídem |
| Moderador | Avisos duplicados y sector probablemente equivocado. Solo vectores | embeddings | ídem |
| Redactor de búsquedas | Propone el aviso a partir de unas líneas de la empresa | lite | `asistente_ia_activo` |
| Habilidades | Sugiere habilidades del catálogo que el CV demuestra | lite | `asistente_ia_activo` |
| Buscador | Traduce «algo de administración part time» a filtros | lite | `busqueda_ia_activa` |
| Redactor de campañas | Borrador de campaña (asuntos, cuerpo, botón) que Talency aprueba | lite | — |
| Audiencias | Traduce «empresas de Punta Alta» a una audiencia de la lista | lite | — |

Y entre ellos, **código** (sin IA, gratis): el puntaje híbrido, la validación de cada respuesta,
las citas y los motivos, y la regla de quién recibe el aviso (≥ 70, uno por día).

## 2. El rerank, partido

Antes, una llamada por candidato hacía tres cosas: decidir cada requisito, copiar una cita literal
y escribir los motivos. Lo segundo y lo tercero es lo que el modelo barato hacía peor (citas con el
fragmento equivocado, citas irrelevantes, motivos que afirmaban algo sin evidencia) y es salida,
que cuesta 8 veces más que la entrada.

- **Evaluador** devuelve solo `{id, cumple, fragmento}` por requisito.
- **El código** saca la cita: del fragmento elegido (o de cualquiera del mismo candidato), la frase
  con más palabras en común con el requisito. Las mismas reglas de siempre: al menos 12
  caracteres, que tenga que ver con el requisito, sin autoevaluaciones, sin contacto, sin nombres
  de empleadores o instituciones en perfiles ciegos. Si no hay frase válida, el requisito pasa a
  `sin_datos`.
- **Los motivos** los arma el código desde lo validado (`reasons_from_evals`).
- **Revisor**: si el puntaje final queda entre 60 y 79, una segunda llamada igual pero con
  `GEMINI_REVIEW_MODEL` (por defecto `gemini-3.8-flash`). Si valida, reemplaza la del Evaluador.

Costo estimado por candidato (precios de `pipeline.PRICES`, 04/10/2026): antes ~USD 0,0019,
ahora ~USD 0,0008; el Revisor ~USD 0,0016 pero solo para los de la franja. **A medir** con
`scripts/evaluacion_rag.py` cuando Eugenia etiquete.

## 3. Flex: descartado

Se pensó pasar los resúmenes nocturnos a `service_tier="flex"` (mitad de precio). No se hizo: en
flex cada llamada puede tardar de 1 a 15 minutos y el barrido nocturno las hace de a una, así que
con 50 resúmenes la noche podía estirarse horas por un ahorro de centavos. Se puede retomar si
algún día el barrido se paraleliza o se usa la Batch API.

## Estado (15/11/2026)

Hecho en `feat/mails-ia`: §1, §2, §4 y §5. Tests unitarios verdes; los de base
(`test_ai_pipeline_db.py`, `test_admin_ai_db.py`, que suman tres tests nuevos) se corren con
`scripts/probar_local_mails.ps1`. Falta medir con el etiquetado de Eugenia
(`scripts/evaluacion_rag.py`) antes de dar por buena la franja del Revisor.

## 4. Instrucciones en archivos

`backend/app/agentes/<agente>.md`: el texto exacto que recibe Gemini. La versión es
`<agente>@<8 del sha256>`; si alguien cambia una coma, la versión cambia sola y lo cacheado con la
versión vieja se recalcula (antes había que acordarse de tocar `PROMPT_VERSION`).

## 5. Lo que ve Eugenia: pestaña «Agentes» en el Centro de IA

Solo lectura. Por agente: nombre, qué hace en una frase, qué recibe, qué devuelve, qué nunca hace,
modelo, si está andando (o por qué no: módulo apagado, interruptor, sin cuenta de Gemini, tope de
gasto del día), llamadas y gasto de hoy y de los últimos 30 días, costo promedio por llamada,
última vez que trabajó, y las instrucciones completas (desplegables). Arriba, el recorrido de las
recomendaciones: Lector de CV → Requisitos → puntaje (código) → Evaluador → Revisor → Resumidor →
aviso (regla).

`GET /admin/ai/agents` (admin, detrás de la compuerta de módulos nuevos).

## 7. Auditoría (15/11/2026, segunda vuelta)

Pedido de Gael: «que Eugenia tenga una vista de los agentes, optimizado en precios, agentes, y
cuándo conviene usar código». La prospección queda como está.

### Precios, verificados hoy en la página oficial (USD por millón, entrada / salida)

| Modelo | Estándar | Lote/Flex | Baja |
|---|---|---|---|
| `gemini-3.5-flash-lite` (el que usamos) | 0,30 / 2,50 | 0,15 / 1,25 | sin fecha |
| `gemini-3.1-flash-lite` | 0,25 / 1,50 | 0,125 / 0,75 | **7/5/2027** |
| `gemini-2.5-flash-lite` | 0,10 / 0,40 | 0,05 / 0,20 | sin fecha |
| `gemini-3.8-flash` (Revisor) | 0,75 / 3,75 **hasta el 31/12/2026**; **1,50 / 7,50 desde el 1/1/2027** | la mitad | — |
| `gemini-embedding-001` | 0,15 | 0,075 | — |

Conclusiones:
- **3.1 Flash-Lite** es más barato pero Google lo da de baja el 7/5/2027: migrar a algo que dura
  seis meses no conviene.
- **2.5 Flash-Lite** sale 6 veces menos en salida, pero es una generación anterior y el cliente
  está escrito para la familia 3 (`thinking_level`). Solo tendría sentido para el Evaluador, que
  ahora hace una tarea chica (veredicto + id), y **solo después de medir** con el etiquetado de
  Eugenia. Queda anotado como prueba, no se cambia.
- **El Revisor duplica su precio el 1/1/2027.** Sigue valiendo (son pocos por búsqueda), pero el
  cálculo de costo tiene que saberlo: `pipeline.PRICES` tenía un solo precio por modelo.

### Agente por agente: ¿IA o código?

| Agente | Veredicto | Cambio |
|---|---|---|
| Lector de CV, Moderador | Ya son código + vectores (sin IA que escriba) | — |
| Requisitos | IA justificada (una vez por búsqueda, cacheada) | — |
| Evaluador | IA justificada, ya achicada | Citas con siglas (SAP, PHP, B1) no se encontraban: el código solo miraba palabras de 4+ letras. Se corrige |
| Revisor | IA justificada en la franja 60–79 | Cuenta para el tope de llamadas por corrida (antes no) |
| Resumidor | IA justificada (de noche, 5 por búsqueda, cacheado por hash) | — |
| Buscador | El único público. Ya tiene filtro en código (solo frases naturales de 4+ palabras), caché, límite por IP y tope diario | El «Entendimos…» lo escribía la IA: lo arma el código con los filtros. Menos salida y nada libre en la pantalla pública |
| Habilidades, Redactor de búsquedas | IA justificada, a pedido y cacheada | — |
| Redactor de campañas, Audiencias | IA justificada, volumen mínimo (solo Talency) | — |

### Revisión del código de la primera vuelta

- Bien: validación, reutilización por versión, tope de gasto también antes del Revisor.
- Corregido: siglas en las citas; el Revisor fuera del tope por corrida; precio del Revisor en 2027.

### Lo que ve Eugenia

- **Admin → Centro de IA → Agentes** (cuando se abra la compuerta): ahora suma por agente el
  **costo estimado por uso** y **lo que hace el sistema sin IA** a su alrededor.
- **Vista previa** (`/vista-previa/<clave>`, lo que puede ver hoy): una tercera pestaña,
  «Agentes de IA», con lo mismo y el **costo estimado por búsqueda y por mes**, generada sin base
  ni Gemini por `scripts/generar_vista_agentes.py` → `vista-previa/datos/agentes.json`. El texto
  de la pestaña de recomendaciones se actualiza (la cita ahora la elige el sistema).

### Estado de la segunda vuelta (15/11/2026)

Hecho: precios en `services/ai/precios.py` (con el tramo de 2027), siglas en las citas, Revisor
dentro del tope por corrida, «Buscás: …» armado en código, costo estimado y «lo que hace el
sistema» por agente (admin y vista previa), pestaña «Agentes de IA» en la vista previa
(`scripts/generar_vista_agentes.py`). **Verificado:** los 731 tests, incluidos los de base, contra
un Postgres 18 + pgvector descartable, migrado a head; la pestaña de la vista previa en escritorio y
teléfono, sin scroll horizontal ni errores de consola. Ojo: el `next dev` local con Turbopack falla
al cargar Plus Jakarta Sans (`app/layout.tsx`, no es de este cambio); con `next dev --webpack` anda.

**Lo que queda del lado de Gael:** la cuenta de Gemini (con `GEMINI_API_KEY` se puede regenerar la
muestra de la pestaña de recomendaciones: `scripts/generar_muestra_ia.py`), el Resend pago y
medir la franja del Revisor con el etiquetado de Eugenia (`scripts/evaluacion_rag.py`).

Para publicar la pestaña a Eugenia van a `main`: `frontend/src/vista-previa/**` **y**
`frontend/src/app/vista-previa/[clave]/page.tsx` (ahora importa `agentes.json`).

## 6. Después (no en esta tanda)

- Que Eugenia pueda corregir un veredicto del Evaluador («esto sí cumple») y que esas correcciones
  vuelvan como ejemplos (el `aprendizaje.py` del centro). **Nunca** aprender de los descartes de las
  empresas: ahí puede colarse un sesgo que la IA tiene prohibido.
- Prospección con el método del centro (plantillas por rubro, investigador «¿está buscando gente?»).
