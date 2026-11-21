# Checklist de pruebas manuales antes del lanzamiento

Lo que los tests automáticos (≈800) no pueden ver: pantallas reales, mails que llegan de verdad,
pagos, Clerk, celulares. Marcá cada casilla al probarla y anotá al lado lo que falle.

**Cómo usarlo**
- Probá cada rol con una cuenta **distinta** y en una ventana de incógnito distinta.
- Hacé cada bloque en celular (Chrome Android o Safari iPhone) **y** en computadora.
- Los bloques A–E se pueden probar ya en producción: es lo que está desplegado hoy, con la
  compuerta de módulos cerrada. Los bloques F–I son de los módulos nuevos: se prueban después del
  push, con `MODULOS_NUEVOS_ACTIVOS=true` (o en local).
- Si algo falla: captura de pantalla + URL + qué cuenta usabas.

---

## A. Antes de empezar

- [ ] Tres casillas de mail reales tuyas para las pruebas (postulante, empresa, admin). No uses
      las `+clerk_test`: en producción no reciben mails.
- [x] Clerk ya está en **modo producción** (claves `live` en Railway y en el sitio, DNS de Clerk
      en `www.bbjobs.com.ar` desde el 20/07/2026; verificado el 20/11).
- [ ] Una tarjeta para Mercado Pago (real, con montos chicos y después el reembolso, o la cuenta
      de prueba de MP si el entorno es sandbox).

## B. Sitio público (sin iniciar sesión)

- [ ] **Inicio** (`/`): carga rápido en el celular, se ven avisos reales y los botones llevan a
      donde dicen.
- [ ] **Buscar** (`/empleos`): escribir "vendedor", "chofer", "tecnico" (sin tilde): aparecen los
      avisos correctos.
- [ ] Filtros de rubro, zona, modalidad, contrato y rango de sueldo: cada uno cambia los resultados.
      "Limpiar filtros" deja todo como al principio.
- [ ] **Nuevo:** la casilla **"Sólo con sueldo publicado"** muestra únicamente avisos con sueldo
      visible.
- [ ] **Detalle de un aviso:** título, empresa, zona y sueldo (si lo tiene), y el cartel de
      vencimiento.
- [ ] **Nuevo:** el botón **"Compartir por WhatsApp"** abre WhatsApp con el puesto, la empresa y el
      link. Al abrir el link desde otro celular llega al mismo aviso.
- [ ] **Nuevo:** se ve el aviso "Postularte es gratis…" y su link a contacto funciona.
- [ ] Sin sesión, "Postularme" lleva a iniciar sesión y, al terminar, **vuelve al mismo aviso**.
- [ ] **Empresas** (`/empresas` y el perfil de una): se ven la ficha y sus búsquedas activas.
- [ ] Páginas por rubro y por zona: `/empleos-de/<rubro>`, `/trabajo-en/bahia-blanca`,
      `/trabajo-en/punta-alta`, `/seleccion-de-personal` y una de `/seleccion-de-personal/<rubro>`.
- [ ] `/planes`, `/planes/base-de-talento`, `/publicar-empleo`, `/nosotros`: textos y precios
      correctos.
- [ ] Legales: `/terminos`, `/privacidad`, `/cookies`, `/arrepentimiento`. El link a Defensa del
      Consumidor del pie anda.
- [ ] El cartel de cookies aparece una vez, y aceptar o rechazar se recuerda.
- [ ] **Contacto** (`/contacto`): mandar un mensaje. Llega al admin en *Mensajes*.
- [ ] Una URL inventada (`/empleos/no-existe`) muestra la página de "no encontrado", no un error.
- [ ] **Google:** pegar la URL de un aviso en
      [search.google.com/test/rich-results](https://search.google.com/test/rich-results). Tiene que
      detectar "Empleo" sin errores. Hacé lo mismo con una página de rubro: ahí **no** tiene que haber
      un "Empleo".

## C. Postulante

- [ ] **Registro** con mail y con Google. Llega el código de Clerk, y al terminar se completa el
      perfil (onboarding).
- [ ] **Perfil:** datos, experiencia, formación y habilidades. Guardar y recargar: no se pierde nada.
- [ ] **CV en PDF:** subir uno real de 1 a 3 páginas. Un archivo que no es PDF o es muy pesado se
      rechaza con un mensaje claro. Se puede ver y reemplazar.
- [ ] **Postularse** a un aviso: queda en *Mis postulaciones* con estado "Enviada". No deja
      postularse dos veces al mismo aviso.
- [ ] Cuando la empresa mira el CV, la postulación pasa a "Perfil revisado" ("Vieron tu CV").
- [ ] Cuando la empresa cambia el estado (contactado, en proceso, finalista, seleccionado, no
      avanzó), el postulante lo ve, con su notificación en la campanita.
- [ ] **No** se ve ninguna nota privada de la empresa.
- [ ] **Base de Talento:** prender y apagar "Quiero que me encuentren". Apagada, la empresa no lo
      ve en la Base.
- [ ] **Mi cuenta:** oponerse a la IA y al aviso de "otro proceso". Queda guardado.
- [ ] **Borrar la cuenta:** después no se puede entrar, y la empresa ya no ve sus datos en las
      postulaciones.

## D. Empresa

- [ ] **Registro y onboarding:** CUIT, rubro y responsable. Queda "pendiente de verificación"
      y **no puede publicar** hasta que Talency la verifique.
- [ ] El admin la verifica: le llega la notificación y ya puede publicar. Probá también con otra
      empresa rechazada y con una suspendida.
- [ ] **Publicar una búsqueda:** con y sin sueldo, con vencimiento, con habilidades. Queda "en
      revisión" hasta que la apruebe el admin.
- [ ] Escribir en el aviso "buena presencia, de 25 a 35 años": la publicación lo advierte
      (con el asistente de IA prendido, propone una alternativa).
- [ ] **Postulantes:** ver la lista, abrir un CV, cambiar estados, poner una estrella, dejar una
      nota privada. Filtros y orden del buscador de postulantes.
- [ ] **Acceso cruzado:** con la empresa B, pegar la URL de una búsqueda o de un postulante de la
      empresa A. Tiene que dar "no encontrado", **nunca** los datos.
- [ ] **Estadísticas** de la empresa: los números coinciden con lo que pasó en la prueba.
- [ ] **Pausar, cerrar, reabrir y borrar** una búsqueda: en el sitio público desaparece y vuelve
      según corresponda.
- [ ] **Destacar con Mercado Pago:** pagar. El aviso pasa a destacado **recién cuando MP confirma**
      (puede tardar segundos). Un pago rechazado no destaca nada.
- [ ] **Base de Talento con créditos:** comprar el paquete, ver perfiles y desbloquear uno
      (descuenta un crédito).

## E. Admin (Talency)

- [ ] **Empresas:** verificar, rechazar con motivo, suspender y reactivar.
- [ ] **Búsquedas:** aprobar, rechazar, dar de baja y destacar a mano (con nota).
- [ ] **Candidatos**, **Base de Talento**, **Mensajes**, **Pagos**: las listas cargan, y la
      búsqueda y los filtros andan.
- [ ] **Nuevo admin:** crear uno y entrar con él.
- [ ] **Estadísticas / Indicadores / Métricas del sitio:** cargan sin errores y con números
      razonables.

## F. Mails (después de cargar Resend y los DNS)

- [ ] Admin → **Mails → Salud de la cuenta**: los dominios `avisos.`, `novedades.`, `contacto.`,
      `r.` y `r.contacto.` aparecen **verificados**, y el modo no es "simulado".
- [ ] Hacer en la plataforma cada acción que dispara un mail (postulación enviada, cambio de
      estado, empresa verificada, búsqueda aprobada, pago aprobado) y revisar que llegue:
  - a la bandeja de entrada (no a spam), en Gmail y en Outlook o Hotmail;
  - con el logo, los colores y el remitente correctos;
  - con todos los links funcionando.
- [ ] El **"No avanzó"** llega recién a las 24 h, no en el momento.
- [ ] **Baja en un clic:** desde el pie de una novedad, darse de baja. No vuelve a llegar esa
      categoría, pero los de cuenta y postulaciones sí siguen llegando.
- [ ] **Responder** un mail de BBJobs desde tu casilla: aparece en Admin → **Mails → Respuestas**
      sin el adjunto. Probá con un PDF adjunto. "Marcar como atendida" la saca de la lista.
- [ ] Una **respuesta automática** (fuera de oficina) **no** aparece en Respuestas.
- [ ] **Enviados:** cada mail de la prueba figura con su estado (enviado → entregado).
- [ ] Resumen diario de la empresa y resumen semanal del postulante: llegan en su horario
      (8 a 21) y como mucho 2 por día por persona.

## G. Prospección y casillas

- [ ] Admin → Mails → **Casillas**: agregar `eugenia@contacto.bbjobs.com.ar` (tiene que quedar
      activa) e intentar `eugenia@bbjobs.com.ar` (tiene que rechazarla).
- [ ] Empresas a contactar: sincronizar desde el centro, armar una campaña de prospección y
      mandarla **primero a vos** (una empresa de prueba con tu mail).
- [ ] El mail llega en texto plano desde la casilla, con "Para no recibir más mails…" al pie.
- [ ] Contestar ese mail: aparece en Respuestas como "Empresa a contactar: …" y la empresa pasa
      a "respondió". Contestar "no me escriban más" la da de baja.
- [ ] El tope diario se respeta: con 2 casillas de 10, no salen más de 20 por día, y solo de lunes
      a viernes de 9 a 12.

## H. IA (la clave de Gemini, de un proyecto con facturación, ya está en Railway)

- [ ] Admin → Mails e IA: prender **"Candidatos recomendados con IA"** y dejar **apagado**
      "Mostrar los recomendados a las empresas" (modo observación).
- [ ] Centro de IA → **Panorama** y **Agentes:** el estado dice "Andando", aparece el gasto del
      día y los controles quedan en "Bien" o "Poca muestra".
- [ ] En una búsqueda real con varios postulantes, los recomendados del Centro de IA tienen sentido:
  - el que cumple lo excluyente queda arriba;
  - cada "cumple" trae una frase del CV que lo respalda;
  - no aparecen edad, género ni nombres.
- [ ] Con el modo observación, la **empresa no ve** recomendados en su panel ni en el mail diario.
- [ ] Prender "Mostrar a las empresas": ahora sí los ve, con el "Por qué".
- [ ] **Buscador inteligente:** escribir "algo de administración part time en Punta Alta". Propone
      filtros que tienen sentido.
- [ ] **Asistente de redacción:** con dos líneas de texto arma un aviso sin inventar sueldo ni
      beneficios.
- [ ] El gasto del día no pasa el tope (USD 1).

## I. Revisión de CV

- [ ] Como postulante, comprar una Revisión de CV. Después del pago, el admin la ve en
      *Revisiones de CV* y le llega el aviso.
- [ ] Un pago rechazado no crea la revisión. Marcar "en curso" y "entregada": al postulante le llega
      cada aviso.

## J. Celular, navegadores y velocidad

- [ ] iPhone (Safari) y Android (Chrome): registro, postulación, subir el CV desde el celular y
      publicar una búsqueda. Nada se corta ni queda fuera de la pantalla.
- [ ] Chrome, Firefox y Edge en computadora: inicio, búsqueda, detalle y paneles.
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) del inicio y de un aviso: en celular,
      sin rojos graves.

## K. Día del lanzamiento

- [ ] Backup de la base de Railway (el push trae 2 migraciones nuevas).
- [ ] Push de `main` y esperar el deploy de Railway y de Vercel. En los logs de Railway:
      `alembic upgrade` hasta `b2d4f6a8c0e3` sin errores.
- [ ] Repasar en 5 minutos lo básico: inicio, búsqueda, un aviso, iniciar sesión con cada rol,
      postularse y publicar.
- [ ] Variables en Railway: `MODULOS_NUEVOS_ACTIVOS=true` (`GEMINI_API_KEY` ya está cargada desde el
      20/11), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_REPLY_TO`, `PROSPECT_REPLY_DOMAIN`,
      `EMAIL_DAILY_CAP=150`, `LEGAL_V3_VIGENTE_DESDE`. En Vercel, `NEXT_PUBLIC_MODULOS_NUEVOS=true` y
      `NEXT_PUBLIC_LEGAL_V3_VIGENTE_DESDE`.
- [ ] Prender los módulos en este orden, de a uno:
  1. Revisión de CV.
  2. Mails, solo los transaccionales durante 1 o 2 semanas.
  3. IA en modo observación.
  4. Campañas.
  5. Prospección.
- [ ] Sentry: cargar `SENTRY_DSN` (el SDK ya está instalado) para enterarte de los errores sin
      tener que mirar los logs.
- [ ] Si los 3 usuarios de prueba (`bbjobs-prueba-*+clerk_test@example.com`) aparecen en la
      instancia **live** de Clerk, borrarlos (lo normal es que sólo estén en la de desarrollo).
