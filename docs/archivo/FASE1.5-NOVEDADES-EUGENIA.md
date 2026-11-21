# Novedades desde la última reunión — Fase 1.5

> Complementa (no reemplaza) los documentos de la reunión anterior, que quedaron archivados en
> `reunion-eugenia-fase1-inicial/` tal cual estaban. Este documento cubre **sólo lo que se agregó
> después** de esa reunión, a partir de los pedidos de más filtros y datos para empresas, admin
> y candidatos. Sin lenguaje técnico, mismo criterio que los anteriores.

---

## Decisiones tomadas en esta etapa

**Moderación de todas las búsquedas — no sólo de empresas nuevas**
Antes, una vez que una empresa estaba verificada, sus búsquedas se publicaban solas. Ahora
**toda búsqueda nueva** (de cualquier empresa) queda pendiente de revisión de Talency antes de
aparecer en el portal. Es un control de calidad extra, pero implica que alguien del equipo tiene
que revisar esa cola con cierta frecuencia — es un tema para conversar con Eugenia (cada cuánto
se va a revisar).

**Las búsquedas ya no quedan publicadas para siempre**
Cada búsqueda tiene un plazo máximo de 20 días. La empresa puede acortarlo si quiere cerrarla
antes. Pasado el plazo, se da de baja sola y se le avisa a la empresa (con un aviso previo
cuando faltan 3 días).

**Sin sugerencia libre de habilidades**
Se había armado un circuito para que un usuario sugiriera una habilidad nueva y un admin la
aprobara, pero nunca se conectó a ninguna pantalla — en la práctica no se usaba. Se decidió no
completarlo: si una habilidad no está en el catálogo, el candidato la menciona en su CV o en su
descripción personal. La pantalla de "Skills pendientes" del panel admin se sacó de la
navegación por esta razón.

---

## ✅ Qué se agregó y ya está funcionando

**Perfil del candidato — más datos, opcionales**
- Nuevos datos opcionales: fecha de nacimiento, sexo, movilidad propia (sí/no), disponibilidad
  (full-time/part-time), disponibilidad inmediata.
- Descripción personal corta (hasta 300 caracteres) que la empresa ve al revisar una postulación.
- Selector de habilidades desde el catálogo existente.
- Foto de perfil: el candidato puede subir su foto, y cuenta para el % de "perfil completo".

**Indicador de "perfil completo"**
- Un círculo con el porcentaje de perfil completo, visible tanto para el candidato como para la
  empresa que revisa una postulación. Cambia de color según qué tan completo está (rojo → ámbar
  → celeste → verde al 100%).
- Al candidato se le avisa (dentro de la plataforma) cuando le falta completar datos, con el
  mensaje explícito de que las empresas ven ese porcentaje — pensado para incentivar a completar
  el perfil sin ser invasivo (el aviso no se repite todos los días).

**Panel de empresa — filtros y estadísticas de postulantes**
- Al revisar quién se postuló a una búsqueda, la empresa ahora puede filtrar por edad, sexo,
  movilidad y disponibilidad.
- Nueva sección de estadísticas por búsqueda (y un resumen general): edad promedio, años de
  experiencia promedio, título más común entre los postulantes, y cuántos tienen movilidad
  propia.
- Al publicar una búsqueda, ahora se puede elegir qué habilidades se buscan (antes ese campo no
  se usaba realmente).

**Panel de administrador — más control**
- Nueva pantalla para aprobar o rechazar cada búsqueda nueva (con motivo, igual que el rechazo
  de una empresa), con aviso cuando hay búsquedas esperando revisión.
- Filtros de candidatos: por edad, sexo, movilidad, disponibilidad, zona, si tiene CV cargado,
  y título alcanzado.
- Desde la lista de empresas, ahora se puede desplegar cada una para ver sus búsquedas, y desde
  cada búsqueda ver quién se postuló — todo sin salir de esa pantalla.
- Al revisar el perfil de un candidato, se ve también un historial de su actividad reciente
  (cuándo actualizó su perfil, cuándo se postuló, etc.).

**Candidato — seguimiento más detallado**
- En "Mis postulaciones", cada postulación se puede desplegar para ver la línea de tiempo de
  cambios de estado (cuándo la vieron, cuándo pasó a "en proceso", etc.), no sólo el estado
  actual.

---

## ✅ Rediseño de los tres paneles y nuevas funciones (última tanda de cambios)

Esto es lo que se agregó en la etapa más reciente, por fuera de lo anterior. Es más que nada
de experiencia de uso — la plataforma sigue haciendo lo mismo, pero ahora es más rápida de
usar y guía más a cada tipo de usuario.

**Un "Inicio" en cada panel**
Antes, al entrar a cualquiera de los tres paneles (admin, empresa, candidato) se caía directo
en una subpantalla cualquiera. Ahora cada uno tiene una pantalla de Inicio con tarjetas grandes
y claras — cuántas búsquedas hay activas, cuántas postulaciones nuevas, si falta verificar algo,
etc. — para que la persona sepa de un vistazo qué tiene pendiente antes de entrar a buscarlo.

**Búsquedas — un solo lugar para gestionarlas, en admin y en empresa**
Antes esto estaba repartido: para ver las postulaciones de una búsqueda había que entrar a la
empresa y desplegarla. Ahora hay una pantalla "Búsquedas" dedicada (lista a la izquierda, detalle
a la derecha) donde se puede, sin cambiar de pantalla:
- Ver todos los datos de la búsqueda y sus postulantes (con su perfil completo a un clic).
- Pausarla, reactivarla o cerrarla.
- Editarla.
- Destacarla (pagar para darle prioridad) directamente desde ahí.
Esto ya existía parcialmente para admin; ahora la empresa tiene el mismo tipo de pantalla para
sus propias búsquedas — antes tenía que ir a "Estadísticas" para algunas cosas y a
"Publicar" para otras.

**Publicar una búsqueda y completar el perfil, ahora paso a paso**
Dos de los formularios más largos de la plataforma (publicar una búsqueda, como empresa; y
completar el perfil, como candidato) se convirtieron en un asistente de pasos, con flechas para
avanzar y retroceder, en vez de un formulario largo de una sola vez. La idea es que se sienta
como "ir completando de a poco" en vez de "llenar un montón de campos antes de poder guardar" —
en el caso del candidato, además arranca directamente en la sección que le falta completar, y
cada sección ya completa se marca con un tilde verde.

**Ver el perfil de un candidato o de una empresa, en grande**
Antes esa ventana se abría pegada al costado de la pantalla, chica. Ahora se abre centrada, más
ancha, y muestra toda la información bien organizada (experiencia, educación, habilidades,
idiomas, CV) sin tener que scrollear tanto.

**Notificaciones — ahora con historial, no sólo la campanita**
Se agregó "Notificaciones" como una sección más del menú (en los tres paneles), con un número
al lado si hay pendientes. Ahí se puede ver el historial completo — qué está pendiente, qué ya
se leyó, todo junto — no sólo las últimas que aparecen al tocar la campana.

**Recordatorio automático semanal para completar el perfil**
Antes, el aviso de "te falta completar el perfil" sólo le llegaba a un candidato si se
postulaba a algo. Ahora, además, el sistema revisa todas las semanas quién tiene el perfil
incompleto y le manda el aviso aunque no haya hecho nada en la plataforma esa semana — para
traer de vuelta a los que se registraron y no volvieron.

---

## ✅ Marca e imagen del portal

**Imagen al compartir el link**
Cuando alguien comparte el link de BBJobs por WhatsApp, redes sociales o mail, ahora aparece una
imagen de marca (logo, nombre y frase del portal) en la vista previa, en vez de un link pelado
o sin imagen. Un aviso o el perfil de una empresa que tiene su propio logo sigue mostrando ese
logo puntual al compartirse; el resto usa la imagen general del portal.

**Búsquedas destacadas, más visibles**
La tarjeta de una búsqueda destacada (la que la empresa paga para darle prioridad) ahora se
distingue de un vistazo en toda la lista: fondo y borde en rojo, y una cinta con la palabra
"Destacado" en la esquina — antes era sólo una etiqueta chica del mismo color que el resto de
la tarjeta, fácil de pasar por alto.

---

## ⚠️ Cosas para tener en cuenta

- **La moderación de búsquedas es manual** — hay que definir con Eugenia cada cuánto alguien de
  Talency va a revisar la cola de búsquedas pendientes, para que no se acumulen sin aprobar.
- Todos los datos nuevos del candidato (edad, sexo, movilidad, disponibilidad) son **opcionales**
  — nadie está obligado a cargarlos, se incentiva mostrando el % de perfil completo.
- El plazo de 20 días por búsqueda es una decisión de producto ya tomada, no algo a validar —
  se avisó acá por si surge en la conversación.
- El recordatorio semanal es automático y corre solo — no requiere que nadie de Talency haga
  nada, pero vale la pena que Eugenia sepa que existe por si un candidato pregunta por qué le
  llegó un aviso sin haber hecho nada esa semana.

---

## 🚀 Estado del lanzamiento — puesta en producción real

El sitio ya está mudado de la computadora de desarrollo a internet, con dominio propio, y esto
es el estado actual:

**Ya funcionando en el dominio real (`bbjobs.com.ar` / `www.bbjobs.com.ar`)**
- El sistema de login/registro corre en modo de producción real — ya no hay avisos de "modo
  desarrollo" en las pantallas de login, y todas las pantallas (login, registro, recuperar
  contraseña) están en español.
- Iniciar sesión con Google ya está habilitado en producción, además de email/contraseña.
- El sitio tiene certificado de seguridad (candadito verde), tanto en la parte que ven los
  usuarios como en la conexión con la base de datos.
- La base se limpió de todas las cuentas y datos de prueba que se usaron para testear — el
  único acceso que queda es el de administrador de Talency, para arrancar en limpio.
- Cada vez que se sube una mejora al código, ahora se publica sola en el sitio en vivo en
  cuestión de minutos, sin pasos manuales — antes esto podía trabarse y requerir intervención.

**Pendiente**
- Los cobros reales de Mercado Pago (destacar una búsqueda pagando) todavía están en modo de
  prueba — falta la cuenta de negocio real de Talency para pasar a cobrar de verdad.

Este es el único pendiente antes de anunciar la plataforma como 100% en vivo — no bloquea
mostrarla ni usarla hoy para gestionar candidatos y búsquedas.

---

## 🎬 Qué sumar al recorrido de demo (además de lo ya mostrado)

1. Al publicar una búsqueda, mostrar que queda "pendiente de revisión" — no aparece todavía en
   el portal.
2. Como admin, aprobarla desde la nueva pantalla y recién ahí mostrar que ya es pública.
3. Completar algunos de los datos nuevos del perfil de un candidato y mostrar cómo sube el
   círculo de "perfil completo".
4. Como empresa, filtrar los postulantes de una búsqueda por edad o movilidad, y mostrar el
   panel de estadísticas.
5. Como admin, desplegar una empresa para ver sus búsquedas y postulantes sin salir de la
   pantalla de "Empresas".
6. Mostrar el Inicio de cada panel apenas se entra, antes de ir a cualquier otra pantalla.
7. Publicar una búsqueda nueva usando el asistente paso a paso, y completar el perfil de un
   candidato de la misma forma.
8. Abrir el perfil completo de un candidato desde la pantalla de Búsquedas, no sólo desde
   Candidatos.
9. Mostrar la sección de Notificaciones y su historial, y destacar que el recordatorio semanal
   de perfil incompleto ya está funcionando solo.
10. Compartir el link de un aviso destacado por WhatsApp y mostrar la vista previa con imagen de
    marca, y en el portal mostrar cómo se distingue esa misma búsqueda destacada en la lista.
