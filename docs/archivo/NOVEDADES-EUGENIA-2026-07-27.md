# Novedades — correcciones de la landing, indicadores y Base de Talento

> Cubre **sólo lo que se hizo después** de `FASE1.5-NOVEDADES-EUGENIA.md`, a partir del documento
> de correcciones que pasó Eugenia (`bbjobs.pdf`). Mismo criterio que los anteriores: sin lenguaje
> técnico.

---

## ✅ Correcciones de la página principal

Se aplicaron **todas** las correcciones de texto del documento. Repaso de lo que cambió:

**Los botones quedaron unificados en todo el sitio**
Donde antes decía "Buscar empleos", "Subir mi CV" y "Publicar búsqueda", ahora dice **"Ver
empleos"**, **"Cargar mi cv"** y **"Publicar un empleo"** — no sólo en la portada, también en el
menú de arriba y en la versión de celular, para que en ningún lado quede el nombre viejo.

**Se sacó el énfasis en la inteligencia artificial**
El cartel de arriba de todo ahora dice *"Próximamente: oportunidades recomendadas según tu
perfil"*. El recuadro lateral quedó como *"Oportunidades para vos — BBJobs te recomendará
búsquedas acordes con tu experiencia, formación e intereses laborales"*.

**Sección de empresas**
Nuevo título *"Encontrá el talento que tu empresa necesita"*, con la aclaración de que Talency
revisa cada cuenta empresarial antes de habilitar sus publicaciones. Los cinco puntos quedaron
tal cual los escribió Eugenia, con el "— Próximamente" en los dos que todavía no están
disponibles. El botón dice **"Publicar tu búsqueda"** y al lado está **"Ver planes"**.

**Sección de candidatos**
Nuevo texto explicando que la información está protegida y que cada uno decide quién puede verla.
Las cinco etiquetas quedaron como las pidió (Perfil protegido · Vos decidís tu visibilidad ·
Postulaciones simples · Alertas de empleos · Datos del mercado laboral), el texto pasó a la
izquierda y a la derecha se agregó la imagen de una persona mirando el panel de BBJobs.

**Cierre de Talency**
Ahora dice **"SELECCIÓN DE PERSONAL POR TALENCY"**, con el título *"¿Preferís que nos encarguemos
de la selección?"*, el detalle de todo el acompañamiento del equipo, y el botón **"Consultar por
el servicio de selección"**.

**Tarjeta de postulaciones**
Quedó como *"Postulaciones simples y completas — Los candidatos se postulan utilizando la
información de su perfil, sin volver a cargar sus datos en cada búsqueda"*.

---

## ✅ Los indicadores ahora se calculan solos

Esto era el pedido de *"si se puede que se muestren los indicadores sería un golazo"*. Se hizo, y
un poco más.

**Los números son reales y se actualizan solos.** Los cuatro indicadores que pidió — empleos
activos, empresas verificadas, candidatos registrados y postulaciones realizadas — se cuentan
directamente de la plataforma cada vez que alguien entra a la página. Nadie tiene que actualizarlos
a mano nunca.

**Se pueden prender y apagar de a uno.** Desde el panel de administrador (sección *Configuración →
Indicadores de la landing*) se activa o desactiva cada indicador con un clic.

**Los que dan cero se ocultan solos.** Tal como pidió: si todavía no hay ninguna empresa
verificada, ese indicador no se muestra en vez de mostrar un "0". Es automático, pero se puede
desactivar por indicador si en algún momento se prefiere mostrar el cero.

**Se pueden agregar indicadores propios, incluso de texto fijo.** Además de los cuatro
automáticos, se pueden crear otros. Pueden ser de dos tipos:
- **Automáticos**, que se calculan solos como los anteriores.
- **De texto fijo**, para poner algo que no es un número — por ejemplo *"Bahía Blanca y la zona"*.

**Se elige el icono de una galería.** Hay nueve iconos para elegir haciendo clic, y el orden en el
que aparecen se cambia con flechitas para arriba y para abajo.

**Hay una vista previa.** Arriba de todo, el panel muestra exactamente cómo se está viendo la barra
de indicadores en la página real en este momento, así no hace falta salir a la web para comprobar
cómo quedó.

> **Nota:** hoy la plataforma está recién arrancando, así que sólo se ve el indicador de candidatos
> registrados — los otros tres están en cero y por eso se ocultan solos. A medida que entren
> empresas y búsquedas van a ir apareciendo automáticamente.

---

## ✅ Base de Talento — consentimiento de los candidatos

Se preparó toda la parte del candidato para el plan que se va a cobrar a las empresas (acceso a
perfiles y CVs de gente que no se postuló a esa búsqueda).

**Se le pregunta a cada candidato en su panel.** Al entrar, el candidato ve un aviso que le explica
con claridad qué significa: que las empresas verificadas van a poder encontrar su perfil y su CV y
contactarlo por oportunidades, aunque no se haya postulado a esa búsqueda. Puede responder **"Sí,
quiero aparecer"**, **"No, gracias"** o **"Decidir después"**. Una vez que responde, el aviso no
vuelve a aparecer.

**Es opcional y reversible.** Viene desactivado por defecto. Puede cambiarlo cuando quiera desde su
perfil, y el cambio se guarda al instante.

**Queda constancia de cuándo aceptó.** Como sobre esta autorización se va a cobrar un plan, el
sistema guarda la fecha en que se le preguntó y la fecha en que respondió, y lo registra en su
historial de actividad. Si alguna vez hay que demostrar que un candidato dio su permiso, está
documentado.

**Se corrigió un problema que venía de antes.** La casilla que aparecía al registrarse no estaba
guardando la respuesta: quien la tildaba al crear su cuenta igual quedaba fuera de la Base de
Talento. Ya está arreglado y ahora sí se guarda.

### Cómo va a funcionar el plan (definido, todavía no construido)

- Sólo entran a la Base de Talento los candidatos que **dieron su autorización expresa**.
- La empresa que pague el plan **ve el perfil completo y el CV**, sin pasos intermedios — es
  exactamente lo que está pagando.
- Falta definir el precio y armar la pantalla de búsqueda para las empresas. Eso queda a la espera
  del archivo de planes.

Mientras tanto, **conviene que los candidatos empiecen a dar su autorización desde ya**, así cuando
el plan se lance la base ya tiene volumen y valor para ofrecer.

---

## ✅ Mejoras en los paneles

**Panel del candidato — mucho más completo**
Antes al entrar sólo se veía el porcentaje de perfil y dos botones. Ahora muestra, de un vistazo:
cuántas postulaciones envió, cuántas fueron vistas por la empresa, cuántas siguen en curso y si
tiene el CV cargado. Además lista sus últimas postulaciones con el estado de cada una, y las
últimas búsquedas publicadas en el portal por si quiere postularse.

**Panel de administrador — menú ordenado por temas**
El menú tenía diez opciones sueltas, todas al mismo nivel. Ahora están agrupadas por para qué
sirven: **Moderación** (empresas, candidatos, búsquedas), **Comunicación** (mensajes,
notificaciones), **Negocio** (pagos, estadísticas) y **Configuración** (indicadores, nuevo admin).
Lo que se revisa todos los días queda arriba; lo que se toca una vez cada tanto, abajo.

**Pantallas que aprovechan mejor el espacio**
Las pantallas de inicio de administrador y de candidato usaban menos ancho del disponible y
quedaban con mucho espacio vacío. Se ampliaron y se sumó contenido útil en vez de dejar el hueco.

**Se arregló el acceso al panel desde el celular**
Estando con la sesión iniciada desde un celular, el menú no ofrecía ninguna forma de entrar al
panel propio: la única opción era cerrar sesión. Ahora aparece el botón **"Mi Panel"** bien
visible, igual que en la computadora.

**Cerrar sesión, más claro en todos lados**
Antes era un iconito suelto sin texto, difícil de identificar. Ahora dice **"Cerrar sesión"** con
todas las letras — tanto en el menú de arriba del sitio como dentro de los tres paneles, en
computadora y en celular.

---

## ⚠️ Cosas para tener en cuenta

- **Falta el archivo de planes.** La pantalla "Ver planes" del sitio hoy dice "Próximamente".
  Apenas llegue el archivo se arma con los planes y precios reales.
- **Falta definir el precio del plan de Base de Talento**, además del precio de destacar una
  búsqueda (hoy configurado en $5.000).
- **La parte de empresas de la Base de Talento todavía no está construida** — se está juntando la
  autorización de los candidatos, que es lo que había que arrancar ya, pero la pantalla donde la
  empresa busca y paga queda pendiente del archivo de planes.

---

## 🔴 Lo único que bloquea los cobros: la cuenta de Mercado Pago

El sistema de cobro está **completamente construido y probado**. Falta únicamente que Talency abra
la cuenta. Concretamente, hace falta:

1. **Una cuenta de Mercado Pago de negocio a nombre de Talency** — es la cuenta donde va a entrar
   la plata de los destacados.
2. Desde el panel de desarrolladores de Mercado Pago, crear una aplicación y pasar las **dos claves
   de prueba** que genera (para probar todo el circuito sin mover dinero real).
3. **Dar de alta el aviso de pagos** ("webhook") dentro de esa misma aplicación, con la dirección
   que le vamos a pasar, seleccionando el evento **"Pagos"**. Al guardarlo, Mercado Pago genera una
   **clave secreta** que también hay que pasarnos — es la que faltaba.
4. **Confirmar el precio de destacar una búsqueda** (hoy está configurado en $5.000).

Con eso se hace una compra de prueba de punta a punta y, si sale todo bien, se cambia a las claves
reales y queda cobrando de verdad.

---

## 🎬 Qué sumar al recorrido de demo

1. Mostrar la página principal con los textos nuevos y los botones unificados.
2. Entrar al panel de administrador → *Configuración → Indicadores de la landing*: apagar y prender
   un indicador y mostrar cómo cambia la vista previa al instante.
3. Crear un indicador de texto fijo (por ejemplo *"Bahía Blanca y la zona"*) y mostrarlo apareciendo
   en la página real.
4. Entrar como candidato nuevo y mostrar el aviso de la Base de Talento, con las tres opciones.
5. Mostrar en el perfil del candidato que esa decisión se puede cambiar cuando quiera.
6. Mostrar el panel de inicio del candidato con sus números y sus últimas postulaciones.
7. Mostrar el menú de administrador agrupado por temas.
