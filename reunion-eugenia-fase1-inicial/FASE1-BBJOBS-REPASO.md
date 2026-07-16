# BBJobs — Repaso del sistema, Fase 1

> Documento para revisar en conjunto durante la reunión: qué se construyó, cómo funciona cada parte, qué decisiones se tomaron y qué queda por delante.

---

## 1. Decisiones tomadas hasta ahora

**Autenticación de usuarios — Clerk**
El sistema originalmente tenía su propio mecanismo de login (usuario y contraseña administrados internamente). Se reemplazó por **Clerk**, un servicio externo especializado exclusivamente en identidad y autenticación. Razones:
- El sistema propio tenía fallas de sesión (se desloguéaba solo en algunos casos) y los emails de verificación de cuenta / recupero de contraseña nunca llegaron a funcionar por no tener un proveedor de correo conectado.
- Login con Google integrado de fábrica, sin desarrollo adicional.
- Es la opción estándar de la industria para este tipo de producto; reduce riesgo de seguridad al no manejar contraseñas nosotros mismos.
- Sin costo en el rango de usuarios que maneja la plataforma hoy.

**Almacenamiento de archivos — Cloudinary**
Los CV (PDF) y los logos de empresa se almacenan en Cloudinary, un servicio externo especializado en archivos e imágenes, en lugar de en nuestro propio servidor. Plan gratuito de 25 GB, más que suficiente para esta etapa.

**Modelo comercial inicial**
Tanto empresas como candidatos usan la plataforma gratis. La monetización prevista (destacar avisos vía Mercado Pago) todavía no está activada — se dejó para una vez que haya volumen de uso real.

---

## 2. Roles del sistema

- **Candidato**: busca trabajo, arma su perfil, se postula.
- **Empresa**: publica búsquedas, gestiona postulaciones. Requiere verificación manual antes de poder operar.
- **Administrador** (equipo Talency): aprueba empresas, modera contenido, tiene visibilidad general del sistema.

---

## 3. Páginas y secciones construidas

**Público (sin necesidad de cuenta)**
- Home — hero con buscador, vista previa de últimos avisos, secciones para empresas y para candidatos.
- `/empleos` — listado completo de búsquedas activas, con filtros.
- Vista previa de un aviso — se abre en la misma página (sin navegar a otra URL) al elegir un aviso desde el listado, con toda la info y botón para postularse ahí mismo.
- Detalle completo de un aviso — página propia por cada búsqueda, con la misma información ampliada.
- `/empresas` — página institucional pensada para atraer nuevas empresas: por qué elegir la plataforma, por qué confiar, y una vitrina de empresas ya verificadas.
- Perfil público de cada empresa — accesible desde sus avisos o desde la vitrina: qué hace la empresa, rubro, ubicación, sitio web, y sus búsquedas activas.
- `/contacto` — vías de contacto (WhatsApp, teléfono) y formulario de contacto general.
- `/nosotros`, `/terminos`, `/privacidad` — páginas institucionales.

**Cuenta / acceso**
- Registro (candidato o empresa) y login — con email/contraseña o Google.
- Onboarding — paso obligatorio después de crear la cuenta, donde se completan los datos según el rol elegido (candidato o empresa).

**Panel de candidato**
- Mi perfil — datos personales, experiencia laboral, educación, habilidades (con nivel), idiomas, carga de CV en PDF.
- Explorar empleos — listado y postulación.
- Mis postulaciones — seguimiento del estado de cada una.

**Panel de empresa**
- Mi perfil — datos de la empresa, logo, estado de verificación, y un formulario para completar la descripción pública y el sitio web (lo que se ve en el perfil público).
- Publicar búsqueda — formulario de alta de una vacante.
- Postulaciones — revisión de postulantes por búsqueda, con acceso al perfil completo de cada candidato.
- Estadísticas — métricas propias (postulaciones por búsqueda, por estado, etc.).

**Panel de administrador**
- Empresas — aprobar, rechazar, suspender, reactivar.
- Candidatos — listado general.
- Búsquedas — listado general, con opción de dar de baja avisos que incumplan las condiciones de uso.
- Skills pendientes — aprobar o rechazar habilidades sugeridas por los usuarios que no estaban en el catálogo.
- Mensajes — consultas recibidas desde los formularios de contacto.
- Nuevo admin — alta de otros administradores.
- Estadísticas — métricas generales de toda la plataforma.

---

## 4. Buscador: filtros y categorías

**Filtros disponibles en `/empleos`**
- Texto libre (busca en título y descripción del aviso).
- Rubro / industria.
- Zona.
- Modalidad: presencial, remoto, híbrido.
- Tipo de contrato.
- Rango de salario (mínimo y máximo).

**Categorías cargadas hoy**
- Rubros: Tecnología, Comercio, Salud, Educación, Construcción, Gastronomía, Administración, Marketing, Recursos Humanos, Logística (más la opción "Otro" con campo libre en el alta de empresa).
- Zonas: Bahía Blanca, Monte Hermoso, Punta Alta, Coronel Suárez, Zona Norte, Zona Sur.
- Tipos de contrato: Relación de dependencia, Freelance, Pasantía, Temporal.

Estas listas se pueden ampliar sin desarrollo adicional (son datos de configuración, no código).

---

## 5. Perfil de candidato

- Datos personales: nombre, apellido, teléfono.
- Experiencia laboral (empresa, puesto, fechas, descripción).
- Educación (institución, título, nivel, fechas).
- Habilidades, cada una con nivel.
- Idiomas, cada uno con nivel.
- CV en formato PDF, reemplazable en cualquier momento.
- El perfil es privado: sólo lo ve la propia persona y las empresas a las que se postuló.

## 6. Perfil de empresa

- Datos de alta: razón social, CUIT, rubro, provincia, localidad, cantidad de empleados, datos del responsable.
- Logo.
- Descripción pública ("qué hace la empresa") y sitio web — se completan desde el panel y se muestran en el perfil público.
- Estado de verificación visible en todo momento (pendiente / verificada / rechazada / suspendida).
- El perfil público de la empresa muestra sus búsquedas activas — pensado para que un candidato investigue antes de postularse.

## 7. Publicación de búsquedas y postulaciones

- La empresa completa: título, descripción, requisitos, rubro, zona, modalidad, tipo de contrato, y opcionalmente el rango salarial (con opción de no mostrarlo públicamente aunque sí sirva para el buscador).
- El aviso queda pendiente de revisión de Talency y recién aparece en el portal público cuando un admin lo aprueba (moderación de todas las búsquedas nuevas, no sólo de las empresas).
- Toda búsqueda tiene un plazo máximo de 20 días (la empresa puede acortarlo); pasado ese plazo se da de baja sola.
- Las postulaciones llegan centralizadas al panel de la empresa — no se exponen mails ni teléfonos para contacto externo.
- Por cada postulación, la empresa ve el perfil completo del candidato (CV, experiencia, formación, habilidades) y puede cambiar el estado (nueva, vista, en proceso, contactada, descartada).
- El candidato ve ese mismo estado reflejado en "Mis postulaciones".

## 8. Verificación y moderación (panel de administrador)

- Toda empresa nueva queda pendiente hasta revisión manual.
- El administrador puede aprobar, rechazar (con nota) o suspender una empresa en cualquier momento.
- Suspender una empresa pausa automáticamente todas sus búsquedas activas.
- **Toda búsqueda nueva (no sólo de empresas nuevas) queda pendiente de revisión** — el administrador la aprueba o rechaza (con nota) antes de que aparezca en el portal público.
- El administrador puede dar de baja un aviso puntual ya publicado que no cumpla las condiciones de uso.

## 9. Notificaciones

Sistema de notificaciones dentro de la plataforma (campanita visible en todos los paneles): avisa sobre nueva empresa pendiente de revisión, nueva búsqueda pendiente de revisión, nueva postulación recibida, cambios de estado en una postulación, aprobación/rechazo de una empresa o de una búsqueda, vencimiento de una búsqueda, entre otros eventos.

## 10. Contacto

- Formulario de contacto general (`/contacto`).
- Formulario de contacto orientado a empresas interesadas (`/empresas`), con campo de nombre de empresa.
- Ambos llegan al panel de administrador y generan una notificación.

---

## 11. Qué falta para completar la Fase 1 cotizada

1. **Integración de pagos con Mercado Pago** — cobro por destacar un aviso (prioridad en el listado / etiqueta de destacado). Es el desarrollo más grande pendiente.
2. **Posicionamiento en buscadores (SEO) y en respuestas de IA (GEO)** — hoy el sitio no tiene optimización para aparecer en Google ni ser citado por asistentes de IA. No iniciado.
3. **Alta en Google Business Profile / Google Maps** — presencia como negocio local de Bahía Blanca.
4. **Publicación en internet (deploy)** — el sistema corre hoy en un ambiente de desarrollo local; falta publicarlo en los servidores definitivos y activar el dominio propio.
5. **Paso de Clerk a una instancia de producción** — hoy se usa el modo de prueba del proveedor de autenticación, sin costo pero con límites de uso pensados para testing, no para operación real.

## 12. Fuera del alcance de esta fase (decisión ya tomada, no pendiente)

- Matching automático de candidatos con Inteligencia Artificial.
- Tests psicométricos con resultados interpretados (el sistema ya guarda las respuestas internamente; falta la pantalla para tomarlos y la lógica de interpretación).
- Mensajería interna entre empresa y candidato dentro de la plataforma.
- Observatorio Laboral (estadísticas públicas del mercado de trabajo de Bahía Blanca).

---

## 13. Recorrido sugerido para la demo

1. Portal público sin cuenta: buscar un empleo, aplicar filtros, abrir la vista previa de un aviso.
2. Alta de candidato: crear cuenta, completar el perfil, cargar un CV, postularse.
3. Alta de empresa: crear cuenta, completar los datos, ver el estado "pendiente de verificación".
4. Panel de administrador: revisar la empresa pendiente, aprobarla, revisar notificaciones.
5. Publicar una búsqueda desde el panel de empresa ya aprobada — queda pendiente de revisión.
6. Panel de administrador: aprobar la búsqueda pendiente y recién ahí verla aparecer en el portal público.
7. Gestionar postulaciones: ver un postulante, abrir su perfil completo, cambiar el estado.
8. Perfil público de la empresa: recorrerlo desde la mirada de un candidato.

---

## 14. Puntos a tener presentes durante la reunión

- El ambiente de la demo es de prueba: todo lo que se cargue durante la reunión se puede borrar sin ningún impacto.
- El sistema de pagos todavía no cobra nada — toda la plataforma es gratuita en este momento.
- El sistema no está publicado en internet todavía; hoy sólo es accesible en este ambiente de demostración.
- Para pasar a producción real va a hacer falta una casilla de correo real de Talency para la cuenta de administrador definitiva.
