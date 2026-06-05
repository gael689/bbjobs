# Contexto del Sistema — BBJobs
## Portal de Empleos de Bahía Blanca y la Región

---

## Propósito del documento

Este documento describe **qué es BBJobs, para quién es, qué tiene que hacer y por qué**. No describe cómo implementarlo a nivel técnico (tecnologías, base de datos, frameworks, infraestructura). Está pensado para ser el punto de partida del planeamiento del sistema y para alimentar a herramientas asistentes de planeamiento y desarrollo con todo el contexto del negocio y los requerimientos funcionales.

---

## Identidad del producto

**Nombre:** BBJobs  
**Empresa madre:** Talency (consultora de selección de personal con presencia en Bahía Blanca y la región)  
**Ubicación:** Bahía Blanca, Argentina  
**Mercado objetivo:** Empresas y trabajadores de Bahía Blanca, Monte Hermoso, Punta Alta, Coronel Suárez, y toda la zona de influencia.

**Tagline principal:** *"El trabajo que buscás está en Bahía."*

**Propuesta de valor:**  
BBJobs es una plataforma de empleo local, verificada e inteligente. Conecta empresas reales de la región con los mejores perfiles profesionales locales. La diferencia con portales nacionales o redes informales (grupos de Facebook, WhatsApp) está en tres pilares: **localidad, verificación, e inteligencia artificial aplicada al matching**.

---

## Problema que resuelve

Hoy en Bahía Blanca y la región, el mercado laboral está disperso y poco profesionalizado:

- Los avisos laborales se publican en grupos de Facebook, clasificados de páginas web genéricas, o se comunican boca a boca.
- Los candidatos envían CVs a mails y WhatsApps de empresas sin saber si la búsqueda es real ni quién va a leer su información.
- Las empresas reciben postulaciones desorganizadas por múltiples canales y pierden buenos perfiles entre el ruido.
- No existe una plataforma local que profesionalice el proceso, garantice que las empresas sean reales, y ayude a encontrar el match correcto rápido.
- Las empresas locales miran a Buenos Aires para contratar profesionales calificados, cuando el talento ya está en la región pero no es visible.

BBJobs resuelve esto siendo **el lugar único, confiable y profesional** donde:
- Las empresas verificadas publican búsquedas.
- Los candidatos cargan su perfil una sola vez y postulan con un click.
- La inteligencia artificial conecta el talento correcto con la empresa correcta.
- Los datos quedan centralizados y seguros.

---

## Roles del sistema

El sistema contempla tres roles principales:

### Administrador (Talency)
La empresa madre (Eugenia y su equipo de Talency) tiene control total sobre la plataforma. Es quien verifica empresas, modera contenido, gestiona la operación, ve las métricas generales y administra los planes pagos.

### Empresa
Cualquier empresa, comercio, estudio o empleador de Bahía Blanca y la zona que quiera publicar búsquedas laborales. Debe pasar por un proceso de verificación manual antes de poder operar en la plataforma. Una vez verificada, puede publicar búsquedas, recibir postulaciones, ver perfiles de candidatos que se postulan, y acceder a funcionalidades pagas si tiene un plan superior.

### Candidato
Cualquier persona que busque trabajo y quiera postularse a las búsquedas publicadas. Crea un perfil, carga su CV y datos profesionales una sola vez, y se postula desde ahí con un click. Puede completar tests psicométricos opcionales que mejoran su visibilidad.

---

## Estructura de la web (interfaz pública)

### Home / Hero
Pantalla de entrada con el tagline principal *"El trabajo que buscás está en Bahía"*, una descripción breve de la propuesta de valor, y dos CTAs principales claramente diferenciados:
- Para empresas: "Publicar una búsqueda"
- Para candidatos: "Subir mi CV"

Incluye un dato de impacto dinámico tipo *"Bahía Blanca tiene hoy más de X búsquedas laborales activas"*.

### Sección para Empresas
Bloque dedicado a presentar los beneficios para empresas:
- Publicación de búsquedas en minutos
- Candidatos pre-filtrados por IA
- Acceso a resultados de tests psicométricos
- Información sobre sueldos promedio del mercado local
- Garantía de empresas verificadas
- CTA principal: "Publicar mi primera búsqueda — es gratis"
- CTA secundario: derivar a Talency para gestión completa de búsqueda

### Sección para Candidatos
Bloque dedicado a candidatos:
- CV online visible solo para empresas verificadas
- Postulación con un click
- Tests psicométricos opcionales para destacarse
- Información sobre rangos salariales de su perfil
- Alertas automáticas de búsquedas afines
- CTA: "Subir mi CV — en 5 minutos estás dentro"

### Sección IA y Match
Explicación del sistema inteligente: la plataforma analiza variables de cada perfil y cada búsqueda para identificar los cruces más relevantes.

### Sección Tests Psicométricos
Presenta el valor diferencial de las evaluaciones psicométricas integradas en la plataforma.

### Observatorio Laboral
Sección con datos agregados del mercado laboral bahiense: sueldos promedio por puesto, rubros que más contratan, nivel educativo más demandado. Funciona como contenido público que atrae tráfico y posiciona a BBJobs como referente local.

### Sección de Planes
Presentación de los planes disponibles:
- **Plan Free:** para empresas que quieren probar la plataforma
- **Plan Pro:** para empresas con búsquedas frecuentes
- **Plan Premium:** acceso total + servicio de Talency

### Banner Talency
Bloque que comunica que BBJobs es una herramienta de Talency, y ofrece la posibilidad de delegar todo el proceso de selección a la consultora.

### Quiénes Somos
Presentación de BBJobs como parte de Talency, con foco en el origen local y la misión de profesionalizar el empleo regional.

### Listado de Búsquedas Activas (acceso público)
Página donde cualquier persona (registrada o no) puede ver las búsquedas laborales publicadas con filtros (rubro, zona, modalidad, etc.). Para postularse, necesita estar registrada y tener perfil completo.

---

## Funcionalidades del sistema

### Flujo de la Empresa

**Registro y verificación:**
- La empresa se registra completando datos básicos (razón social, CUIT, rubro, datos de contacto, persona responsable).
- La cuenta queda en estado pendiente de verificación.
- El administrador (Talency) revisa la información manualmente y aprueba o rechaza.
- Una vez verificada, la empresa queda habilitada para operar sin repetir el proceso.

**Publicación de búsquedas:**
- Crear una nueva búsqueda con: título del puesto, descripción, requisitos, zona, modalidad (presencial / remoto / híbrido), tipo de contrato, rango salarial (opcional), nivel educativo requerido, experiencia mínima, beneficios.
- Las búsquedas tienen un estado: activa, pausada, cerrada.
- Posibilidad de destacar una búsqueda (funcionalidad paga vía Mercado Pago) para que aparezca primero en el listado, con etiqueta de "Destacada" o "Urgente".

**Gestión de postulaciones:**
- La empresa recibe todas las postulaciones dentro de la plataforma. No se publican mails ni teléfonos para que el contacto sea externo: todo queda centralizado.
- Acceso a cada perfil completo del candidato: CV, datos personales, experiencia, formación, resultados de tests psicométricos (si los hizo).
- Estados de cada postulación: nueva, vista, en proceso, descartada, contactada.
- Funcionalidad opcional (a definir según plan): ver solo las primeras 10 postulaciones gratuitamente, pagar para desbloquear el listado completo.

**Panel de empresa:**
- Vista general de búsquedas activas, postulaciones recibidas, métricas básicas.
- Gestión de usuarios internos de la empresa (si el plan lo permite).
- Gestión del perfil de empresa: logo, descripción, sitio web, redes sociales.

### Flujo del Candidato

**Registro y perfil:**
- El candidato se registra y crea su perfil personal.
- Carga: datos personales, foto opcional, experiencia laboral, formación, habilidades, idiomas, CV en archivo PDF, expectativas salariales (privadas), zona donde busca trababar, modalidades aceptadas.
- El perfil es **privado**: solo lo ven el propio candidato y las empresas verificadas a las que se postule. Nadie más accede a esa información.

**Búsqueda y postulación:**
- Buscador de vacantes con filtros (rubro, zona, modalidad, nivel, salario).
- Postulación con un solo click. No hay que volver a cargar CV ni datos. El sistema conecta automáticamente el perfil con la búsqueda.
- Posibilidad de agregar una breve carta de presentación opcional al postularse.
- Historial de postulaciones con estados (postulado, visto, en proceso, descartado, contactado).

**Tests psicométricos:**
- El candidato puede completar tests psicométricos opcionales dentro de la plataforma.
- Los resultados se adjuntan a su perfil y son visibles para las empresas a las que se postule.
- Sirven como diferencial frente a otros candidatos.

**Alertas:**
- Configuración de alertas por rubro, zona o tipo de puesto.
- Notificación por mail cuando aparece una búsqueda que hace match con el perfil.

**Observatorio personal:**
- El candidato puede ver datos comparativos: cuánto se paga en promedio en su rubro y nivel en la región, qué tan demandado es su perfil, qué habilidades están solicitando las empresas.

### Flujo del Administrador (Talency)

**Verificación de empresas:**
- Recibe notificaciones cuando una nueva empresa se registra y solicita verificación.
- Revisa los datos, accede a información de la empresa (CUIT, datos de contacto, etc.).
- Aprueba o rechaza la cuenta.
- Puede suspender o dar de baja una empresa verificada si detecta irregularidades.

**Moderación de contenido:**
- Puede revisar las búsquedas publicadas y dar de baja las que no cumplan condiciones de uso.
- Acceso a reportes generados por candidatos sobre búsquedas o empresas.

**Métricas y reportes:**
- Dashboard general: cantidad de empresas activas, candidatos registrados, búsquedas publicadas, postulaciones realizadas, ingresos por pagos, etc.
- Reportes detallados para análisis de negocio.

**Gestión de planes y pagos:**
- Visión de qué empresas tienen qué plan.
- Historial de cobros vía Mercado Pago.
- Gestión de cambios de plan.

**Banner Talency:**
- Cuando una empresa pide derivación a Talency desde la plataforma, el admin recibe la solicitud y la gestiona externamente.

---

## Sistema de planes y monetización

La plataforma arranca con **acceso gratuito** para candidatos siempre, y un esquema escalonado para empresas:

### Plan Free (Empresas)
- Publicación limitada de búsquedas (a definir cantidad mensual)
- Ver postulaciones recibidas con limitaciones (ej: primeras X postulaciones por búsqueda)
- Sin acceso a tests psicométricos de candidatos
- Sin acceso al observatorio laboral completo

### Plan Pro (Empresas)
- Publicación ilimitada de búsquedas
- Acceso completo a todas las postulaciones
- Acceso a resultados de tests psicométricos
- Acceso al observatorio laboral
- Posibilidad de destacar búsquedas (con costo adicional o incluido según se defina)
- Soporte prioritario

### Plan Premium (Empresas + Talency)
- Todo lo del Plan Pro
- Servicio integral de selección por parte del equipo de Talency
- Búsqueda gestionada de principio a fin
- Acompañamiento personalizado

### Cobros adicionales (cualquier plan)
- **Destacar búsqueda:** monto fijo vía Mercado Pago para que un aviso aparezca primero, con etiqueta de destacado o urgente.

### Integración con Mercado Pago
- Todos los cobros (planes recurrentes, destacados, desbloqueo de postulaciones) se procesan vía la API de Mercado Pago.
- Los fondos van directo a la cuenta de Talency.
- Sin intermediarios.

---

## Seguridad y privacidad de datos

La privacidad es un pilar central del sistema:

- Los datos personales del candidato (CV, contacto, experiencia, salarios esperados) son visibles **únicamente** para el propio candidato y para las empresas verificadas a las que se postule voluntariamente.
- Ninguna empresa puede "navegar" perfiles de candidatos libremente. Solo accede a la información de quienes se postulan a sus búsquedas.
- Las empresas deben estar verificadas para poder operar. Sin verificación no pueden publicar ni recibir postulaciones.
- El administrador puede revocar verificación o suspender cuentas en cualquier momento.
- El candidato tiene control sobre dónde aparece su información: se postula voluntariamente y sabe a qué empresas le compartió sus datos.
- Encriptación de contraseñas y manejo seguro de archivos (CVs).
- Cumplimiento con normativa argentina de protección de datos personales.

---

## Observatorio Laboral

Sección distintiva de BBJobs que la diferencia de cualquier otro portal local. Genera tráfico orgánico y posiciona a BBJobs como referente del mercado laboral regional.

**Funcionamiento:**
- Se alimenta automáticamente de los datos generados por la plataforma (búsquedas publicadas, rangos salariales, rubros, etc.).
- Los datos se presentan de forma agregada y anónima, sin exponer información de empresas o candidatos individuales.

**Contenido:**
- Rango salarial promedio por puesto y rubro
- Rubros con más búsquedas activas
- Nivel educativo más demandado
- Tendencias mes a mes
- Zonas con mayor actividad laboral

**Acceso:**
- Vista resumida pública (para SEO y atracción de tráfico).
- Vista detallada como funcionalidad incluida en planes pagos.

---

## Funcionalidades de IA (resumen documentado para fase 2)

> Las funcionalidades de IA se documentan acá como parte del contexto general del producto, pero **no forman parte del alcance inicial** (cotización 1). Cada una se desarrollará como módulo independiente en fases posteriores, con cotización propia.

### 1. Agente IA para análisis y mejora de CV en tiempo real
El candidato puede pedirle al agente que analice su CV cargado en la plataforma y reciba sugerencias de mejora orientadas a un rubro, nicho o vacante específica. El agente evalúa contenido, redacción, estructura, y propone ajustes concretos. Se conecta vía API a un modelo de IA externo (Gemini Flash o similar).

### 2. Recomendación automática de candidatos para empresas (IA)
Cuando una empresa publica una búsqueda, el sistema analiza los perfiles de los candidatos registrados y sugiere los más compatibles en base a experiencia, habilidades, rubro y ubicación. Devuelve un score de compatibilidad por candidato.

### 3. Match automático perfil-vacante para candidatos (IA)
El reverso del anterior. Cuando un candidato entra a la plataforma, el sistema le muestra búsquedas recomendadas según su perfil y preferencias.

### 4. Evaluaciones psicométricas con IA
Cuestionarios psicométricos completados por el candidato dentro de la plataforma. La IA procesa las respuestas y genera un perfil resumido que se adjunta al perfil del candidato. **Importante:** los tests psicométricos como funcionalidad están dentro del producto desde el inicio, pero la **interpretación automática con IA** es un módulo a desarrollar en fase 2. En la fase inicial, los tests pueden almacenar respuestas y mostrar resultados básicos sin interpretación profunda.

### 5. Notificaciones automáticas inteligentes
Alertas para candidatos cuando aparecen búsquedas que hacen match con su perfil (en fase 1 con filtros simples, en fase 2 con scoring por IA).

### 6. Mensajería interna empresa-candidato
Chat dentro de la plataforma para que la empresa pueda comunicarse con candidatos sin intercambiar datos personales externos.

### 7. Análisis y enriquecimiento del Observatorio Laboral con IA
Generación automática de resúmenes en lenguaje natural sobre tendencias del mercado laboral, alimentado por los datos de la plataforma.

> Las funcionalidades 1, 2, 3 y 7 requieren conexión a una API de IA (Gemini Flash es la candidata por costo y funcionalidad). Costos operativos estimados: USD 5–30 mensuales según volumen de uso.

---

## Alcance de la Fase 1 (cotización inicial)

Lo que debe entregar el sistema en la primera versión:

**Para empresas:**
- Registro y solicitud de verificación
- Panel propio para gestionar búsquedas y postulaciones
- Publicación de búsquedas con todos los campos definidos
- Recepción centralizada de postulaciones con perfil completo del candidato
- Opción de destacar búsquedas (pago vía Mercado Pago)
- Acceso a tests psicométricos completados por candidatos (sin interpretación IA, solo respuestas y resultados básicos)

**Para candidatos:**
- Registro y creación de perfil completo
- Carga de CV
- Postulación rápida con un click
- Panel personal con historial de postulaciones
- Tests psicométricos completables dentro de la plataforma
- Perfil privado visible solo para empresas a las que se postula

**Para administrador (Talency):**
- Panel de control general
- Verificación y gestión de empresas
- Moderación de contenido
- Métricas básicas del sistema
- Gestión de planes y pagos

**Generales:**
- Home con todas las secciones descritas (hero, empresas, candidatos, IA, tests, observatorio, planes, banner Talency, quiénes somos)
- Listado público de búsquedas con filtros
- Buscador con filtros (zona, rubro, modalidad, nivel, salario)
- Observatorio Laboral con datos básicos generados automáticamente
- Sistema de planes (Free, Pro, Premium) implementado en estructura
- Integración con Mercado Pago para destacados y planes
- Páginas institucionales (términos, privacidad, contacto)
- Responsive (mobile, tablet, desktop)
- SEO y GEO (posicionamiento en buscadores tradicionales y de IA)
- Alta y optimización del perfil en Google Business y Google Maps

---

## Fuera del alcance de la Fase 1

Estos módulos quedan documentados pero **no se desarrollan** en la primera versión. Se cotizarán por separado cuando Talency decida incorporarlos:

- Agente IA para análisis y mejora de CV en tiempo real
- Recomendación automática de candidatos con IA (matching avanzado)
- Match automático perfil-vacante con IA para candidatos
- Interpretación automática de tests psicométricos con IA
- Mensajería interna empresa-candidato
- Notificaciones inteligentes con scoring por IA
- Resúmenes automáticos del Observatorio Laboral con IA

---

## Consideraciones de diseño

- **Estética visual:** moderna, profesional, con identidad propia. No genérica. Debe transmitir seriedad (es un portal de empleo, no un marketplace de objetos) y a la vez cercanía local (es de Bahía, para Bahía).
- **Experiencia de usuario:** simple, rápida, intuitiva. Tanto empresas como candidatos deben poder completar sus acciones principales (publicar búsqueda, postularse) en menos de 5 minutos desde el registro.
- **Mobile-first:** muchos candidatos van a usar la plataforma desde el celular.
- **Performance:** velocidad de carga rápida (importante para SEO y para experiencia de usuario).
- **Identidad gráfica:** a definir, pero el nombre BBJobs sugiere un sistema de colores asociado a Bahía Blanca y a la profesionalidad de Talency.

---

## Criterios de éxito de la Fase 1

El sistema se considera exitoso si:

- Una empresa puede registrarse, ser verificada, publicar una búsqueda y recibir postulaciones de forma completa sin salir de la plataforma.
- Un candidato puede registrarse, cargar su perfil una sola vez y postularse a múltiples búsquedas con un click.
- El cobro por destacar búsquedas funciona de punta a punta con Mercado Pago.
- Los datos de los candidatos están efectivamente protegidos y solo accesibles bajo las condiciones definidas.
- Talency tiene control real sobre qué empresas operan y puede gestionar la plataforma de forma autónoma.
- El sitio aparece en Google y en buscadores de IA cuando se busca empleo en Bahía Blanca y la zona.

---

## Próximos pasos de planeamiento

Sobre la base de este contexto, el planeamiento del sistema debería continuar con:

1. **Diagrama de entidades del dominio** (empresa, candidato, búsqueda, postulación, plan, pago, etc.)
2. **Mapa de flujos principales** (registro, verificación, publicación, postulación, cobro)
3. **Definición de los estados de cada entidad** (búsqueda activa/pausada/cerrada, postulación nueva/vista/en proceso/etc.)
4. **Estructura del backend y los endpoints necesarios** (sin decisión de stack todavía)
5. **Plan de fases del proyecto** con prioridades dentro de la Fase 1
6. **Identificación de riesgos y dependencias** (Mercado Pago, mailing, almacenamiento de archivos, etc.)
7. **Definición de la identidad visual** y wireframes iniciales

---

*Documento de contexto — BBJobs*  
*Versión 1 · Mayo 2025*
