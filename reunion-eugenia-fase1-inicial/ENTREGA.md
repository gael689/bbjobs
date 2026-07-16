# BBJobs — Resumen de estado y entrega
**Preparado por:** Gael González · [gaelgonzalez.com.ar](https://gaelgonzalez.com.ar)  
**Para:** Eugenia — Talency  
**Fecha:** Junio 2025

---

## ¿Qué es BBJobs?

Portal de empleos local para Bahía Blanca y la región, desarrollado para Talency. Conecta empresas verificadas con candidatos a través de una plataforma centralizada: sin publicar mails, sin WhatsApp, todo dentro del sistema.

Tres roles: **Administrador** (equipo Talency), **Empresa** y **Candidato**.

---

## ✅ Listo y funcionando

### Registro y acceso

- Registro de candidatos con nombre, apellido, teléfono, email y contraseña.
- Registro de empresas con razón social, CUIT, industria, **provincia, localidad, cantidad de empleados**, y datos del responsable (nombre, apellido y cargo).
- Login seguro con cierre de sesión automático por inactividad.
- Recuperación de contraseña (código listo, falta activar el proveedor de emails).

---

### Panel del candidato

- Subida de CV en PDF (se almacena en la nube).
- Carga de perfil completo: experiencia laboral, formación académica, habilidades e idiomas.
- Explorar empleos activos con búsqueda por texto y filtro de modalidad.
- Postulación con un clic, con opción de agregar carta de presentación.
- Historial de postulaciones con estado actualizado en tiempo real (Enviada / En revisión / Preseleccionada / Rechazada).

---

### Panel de la empresa

- Subida de logo de empresa.
- Solicitud de verificación a Talency (desde el mismo panel).
- Publicación de búsquedas laborales con: título, descripción, requisitos, industria, zona, modalidad (presencial / remoto / híbrido), tipo de contrato y rango salarial opcional.
- Listado de búsquedas propias con posibilidad de pausar, reactivar o cerrar cada una.
- Vista de postulantes por búsqueda: nombre, fecha de postulación y carta de presentación.
- **Perfil completo del candidato postulado:** al hacer clic en "Ver perfil" la empresa accede a todos los datos del candidato — experiencia laboral, formación, habilidades, idiomas y descarga directa del CV. Solo puede verse si el candidato se postuló voluntariamente a esa búsqueda.
- Cambio de estado de cada postulación (Nueva → En revisión → Preseleccionada → Rechazada).

---

### Panel del administrador (Talency)

- Métricas generales: empresas totales, empresas pendientes de verificación, empresas verificadas, candidatos registrados, búsquedas publicadas y postulaciones realizadas.
- Gestión de empresas:
  - Ver todas las empresas registradas con su estado.
  - **Verificar** (aprobar) o **rechazar** una empresa, con posibilidad de agregar una nota explicativa.
  - **Suspender** una empresa (sus búsquedas activas se pausan automáticamente).
  - **Reactivar** una empresa suspendida.
- Gestión de búsquedas: ver todas las búsquedas activas y **dar de baja** cualquiera que incumpla las condiciones de uso.
- Gestión de candidatos: lista completa con datos de contacto y CV.
- Gestión de habilidades: aprobar o rechazar habilidades sugeridas por usuarios antes de que aparezcan en el sistema.
- Creación de nuevos usuarios administradores.

---

### Búsqueda pública de empleos

- Página `/empleos` con listado completo de búsquedas activas.
- Filtros: búsqueda por texto, industria, zona geográfica y modalidad.
- Página de detalle de cada empleo con descripción, requisitos, beneficios y botón de postulación.
- Disponible sin necesidad de iniciar sesión para navegar; el registro se solicita al postularse.

---

### Páginas institucionales

- **Quiénes somos** (`/nosotros`): misión de la plataforma, rol de Talency como verificadora, cómo funciona el sistema y crédito de desarrollo.
- **Términos y condiciones** (`/terminos`): 10 secciones completas con referencia a la legislación argentina (Ley 25.326). Talency figura como responsable legal.
- **Política de privacidad** (`/privacidad`): detalle de qué datos se recopilan, quién puede acceder a cada tipo de dato, proveedores de infraestructura, derechos del titular y contacto para ejercerlos.

---

### Seguridad y privacidad

- El perfil de un candidato es **privado por defecto**: solo lo puede ver el equipo de Talency y las empresas verificadas a las que el candidato decidió postularse.
- Las empresas no pueden ver datos de candidatos que no se hayan postulado a sus búsquedas.
- No se publican mails ni teléfonos de contacto en ninguna parte pública de la plataforma.
- Eliminación de cuenta disponible para candidatos y empresas, con borrado real de datos personales (cumplimiento Ley 25.326).

---

## 🔜 Pendiente para completar la Fase 1

### 1. Módulo de notificaciones (in-app)

El sistema ya genera notificaciones internamente cuando ocurren eventos importantes (verificación aprobada o rechazada, empresa suspendida, búsqueda dada de baja). Lo que falta es mostrarlas en la interfaz:

- Ícono de campana en el panel con contador de no leídas.
- Lista de notificaciones con fecha y estado (leída / no leída).
- Marcar como leída individual o todas a la vez.
- Aplica a los tres roles: empresa, candidato y administrador.

---

### 2. Integración con emails (Resend)

Para que la plataforma envíe correos automáticos en los momentos clave:

- **Verificación de cuenta**: al registrarse, el usuario recibe un email con un link para confirmar su dirección.
- **Recuperación de contraseña**: link seguro por email para restablecer la contraseña.
- **Empresa verificada**: notificación por email cuando Talency aprueba la cuenta de la empresa.
- **Empresa rechazada**: notificación por email con la nota del administrador.
- **Nueva postulación**: la empresa recibe un aviso cuando alguien se postula a una de sus búsquedas.

> El proveedor seleccionado es **Resend**, y toda la lógica de los correos ya está programada. Solo falta configurar las credenciales y activar el servicio.

---

### 3. Integración con Mercado Pago — Vacantes destacadas

Posibilidad de que una empresa **destaque una vacante** para que aparezca primero en el listado y con una etiqueta visual ("Destacada" / "Urgente").

- Precio: **$10.000 ARS** por vacante destacada.
- La empresa paga directamente desde su panel via Mercado Pago.
- La duración del destaque es de **7 días** desde la aprobación del pago.
- El webhook de Mercado Pago es la única fuente de verdad: el destaque se activa solo cuando el pago es confirmado por MP, no antes.
- Los fondos van centralizados a la cuenta de Mercado Pago de Talency.
- La plataforma ya tiene los modelos de datos y la integración base con la API de MP preparados.

---

## Resumen visual

| Área | Estado |
|---|---|
| Registro de empresas y candidatos | ✅ Completo |
| Panel del candidato (perfil + postulaciones) | ✅ Completo |
| Panel de empresa (búsquedas + postulantes) | ✅ Completo |
| Perfil completo del candidato para la empresa | ✅ Completo |
| Panel del administrador (Talency) | ✅ Completo |
| Búsqueda pública de empleos con filtros | ✅ Completo |
| Subida de CVs y logos a la nube (Cloudinary) | ✅ Completo |
| Páginas institucionales (nosotros, términos, privacidad) | ✅ Completo |
| Módulo de notificaciones in-app | 🔜 Pendiente Fase 1 |
| Integración de emails (Resend) | 🔜 Pendiente Fase 1 |
| Mercado Pago — vacantes destacadas ($10.000) | 🔜 Pendiente Fase 1 |
| Tests psicométricos con IA (UI) | ⏸ Fase 2 |
| Matching con IA | ⏸ Fase 2 |
| Demas funciones con IA cotizadas en funcionalidades extra | Fase 2 |
| Observatorio Laboral | ⏸ Fase 2 |

---

## Infraestructura

| Componente | Servicio |
|---|---|
| Frontend (interfaz web) | Vercel |
| Backend (servidor) | Railway |
| Base de datos | PostgreSQL en Railway |
| Almacenamiento de archivos (CVs, logos) | Cloudinary |
| Emails transaccionales | Resend *(pendiente activación)* |
| Pagos | Mercado Pago *(pendiente integración)* |
| Dominio | bbjobs.com.ar / api.bbjobs.com.ar |

---

*BBJobs fue desarrollado por [Gael González](https://gaelgonzalez.com.ar) para Talency.*
