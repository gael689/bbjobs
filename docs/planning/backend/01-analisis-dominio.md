# Paso 1 — Análisis del dominio (BBJobs)

> Documento de planeamiento de la Fase 1 del backend de BBJobs.
> Producto: portal de empleo hiperlocal para Bahía Blanca y la región, operado por Talency.
> Stack ya definido: FastAPI + PostgreSQL + Next.js (App Router) + JWT propio + Railway (Hobby) + Mercado Pago.

---

## 1. Interpretación del dominio

### Qué es BBJobs
Portal de empleo *hiperlocal* (Bahía Blanca, Monte Hermoso, Punta Alta, Coronel Suárez y zona de influencia) operado por Talency. No compite con portales nacionales: compite con grupos de Facebook y WhatsApp locales y se posiciona como la opción profesional y verificada del mercado regional.

### Tres pilares diferenciales
1. **Localidad** — todo restringido geográficamente a la región.
2. **Verificación manual de empresas** — Talency aprueba una por una. Ninguna empresa opera sin verificación. Es el núcleo de confianza del producto.
3. **IA aplicada al matching** — Fase 2. En Fase 1 hay tests psicométricos sin interpretación IA y filtros simples para alertas.

### Modelo de negocio
- Freemium para empresas (Free / Pro / Premium), gratis siempre para candidatos.
- Ingresos vía Mercado Pago: planes recurrentes (suscripción mensual) + cobros únicos (destacar búsqueda).
- Premium incluye un servicio externo de Talency (no es software, es derivación humana).
- Fondos van directo a la cuenta de Talency.

### Asimetría de privacidad clave
Las empresas **no pueden navegar perfiles libremente**. Solo ven candidatos que se postularon voluntariamente a sus búsquedas. Requisito duro, no negociable. Condiciona todo el diseño de permisos y consultas.

### Roles
- **Admin (Talency)** — control total. Verifica empresas, modera contenido, gestiona planes y métricas. Grupo pequeño y fijo de usuarios internos. No se autoregistra: lo crea otro admin desde el panel.
- **Empresa** — un único usuario owner en Fase 1 (multi-usuario en Fase 2). Pasa por verificación manual antes de operar.
- **Candidato** — crea perfil único, carga CV, se postula con un click. Su perfil es privado: solo visible para empresas a las que se postula voluntariamente.

---

## 2. Ambigüedades resueltas

| # | Tema | Decisión |
|---|------|----------|
| 1 | Multi-usuario por empresa | Fase 1: un único usuario owner por empresa. Multi-usuario con roles internos en Fase 2. |
| 2 | Límites cuantitativos de planes | Configurables por el admin desde panel. Cada plan tiene atributos modificables (búsquedas máx/mes, postulaciones visibles, acceso a tests, etc.). No hardcodear. |
| 3 | Destacar búsqueda — modelo de cobro | Pago único vía MP, duración configurable por admin (default 7 días). Independiente del plan. Pro/Premium podrían tener X destacados incluidos/mes (a definir cuando Talency cierre planes). |
| 4 | Planes recurrentes — mecánica | Suscripción mensual con renovación automática vía MP. Si falla un cobro: período de gracia de 7 días en estado "pago pendiente" antes de degradar a Free. Downgrade inmediato al fin del ciclo si el usuario cancela. |
| 5 | Desbloqueo de postulaciones por pago | **Fuera de Fase 1**. Diseñar la estructura de datos para que se pueda agregar después, sin implementar el flujo. |
| 6 | Verificación de empresas — criterios | Fase 1: CUIT, razón social, datos de contacto del responsable. Empresa puede adjuntar opcionalmente constancia AFIP u otra documentación. Admin decide manualmente. Sin validación automática contra AFIP. |
| 7 | Estado "rechazada" de empresa | Puede volver a aplicar (no es baneo permanente). Admin puede dejar motivo de rechazo opcional → se notifica por mail. No queda visible en UI pública. |
| 8 | Tests psicométricos — origen | Admin (Talency) carga los tests desde el panel. Cada test tiene preguntas y opciones. En Fase 1 se guardan respuestas crudas + score básico calculado por fórmulas simples (sumatoria/promedio/escalas). Talency puede tener varios tests (general, técnico, personalidad). El candidato elige cuáles completar. |
| 9 | Reportes / moderación | Fase 1: admin da de baja búsquedas o suspende empresas manualmente. Sistema de "reportar" por parte de usuarios en Fase 2. |
| 10 | Observatorio Laboral | Vista pública resumida (libre): cantidad de búsquedas activas, top 5 rubros, rangos salariales promedio últimos 30 días. Vista detallada (Pro/Premium): filtros por rubro, zona, nivel educativo, períodos personalizables, comparaciones mes a mes. En Fase 1: vistas/queries agregadas en SQL directo, sin pipeline analítico separado. |
| 11 | Alertas por mail | Fase 1: candidato configura alertas por rubro + zona + modalidad (filtros simples). Mail cuando se publica una búsqueda que matchea. Matching con IA en Fase 2. |
| 12 | Idempotencia de postulación | Un candidato NO puede postularse dos veces a la misma búsqueda. Constraint único en DB sobre (candidato_id, búsqueda_id). |
| 13 | Soft delete vs hard delete | Soft delete por defecto en candidatos, empresas, búsquedas, postulaciones. Hard delete solo bajo solicitud explícita del usuario (Ley 25.326). Endpoint específico "eliminar todos mis datos" hace hard delete del candidato y sus postulaciones. Las búsquedas históricas se mantienen anonimizadas si la empresa se da de baja (para el Observatorio). |
| 14 | Notificaciones | Fase 1: solo mail. Centro de notificaciones in-app en Fase 2. |
| 15 | Carta de presentación opcional | Campo libre por postulación (no se guarda en el perfil). El candidato puede escribir un mensaje específico para cada vacante. |

---

## 3. Supuestos confirmados

| ID | Supuesto | Estado |
|----|----------|--------|
| S1 | Solo web responsive, mobile-first. Sin app nativa. | ✅ |
| S2 | Un único CV activo por candidato. | ✅ |
| S3 | Una empresa = un usuario en Fase 1. Multi-usuario en Fase 2. | ✅ |
| S4 | Planes son suscripciones; destacados son pagos puntuales. | ✅ |
| S5 | "Cerrada" es estado terminal de búsqueda, no se reabre. | ✅ |
| S6 | Comunicación empresa↔candidato fuera de la plataforma en Fase 1. Estados "contactado/descartado/en proceso" son marcas internas. | ✅ |
| S7 | CVs en PDF, único archivo activo. Tamaño máximo 5 MB. Nuevo CV reemplaza al anterior. | ✅ |
| S8 | Listado público solo muestra búsquedas activas, destacadas primero. | ✅ |
| S9 | Observatorio se calcula desde datos propios del sistema, sin pipeline externo. | ✅ |
| S10 | Admin de Talency es grupo pequeño, no se autoregistra. Lo crea otro admin. | ✅ |
| S11 | Producto mono-tenant. BBJobs es una sola instalación. | ✅ |

---

## 4. Stack tecnológico (referencia)

- **Backend:** FastAPI (Python)
- **Base de datos:** PostgreSQL
- **Frontend:** Next.js App Router (sesión separada)
- **Auth:** JWT propio en FastAPI (no Clerk, no Auth0)
- **Hosting:** Railway (Hobby plan)
- **Pagos:** Mercado Pago API
- **Almacenamiento de CVs:** a decidir en paso de decisiones técnicas

---

## 5. Decisiones que quedan pendientes para próximos pasos

- **Almacenamiento de CVs.** Filesystem de Railway vs S3/R2/Backblaze vs Supabase Storage. Implica costos, backup, presigned URLs. → Paso 6.
- **Modelo concreto de autorización.** Cómo expresar "una empresa solo ve postulaciones de sus propias búsquedas" en el backend. RBAC + reglas a nivel query. → Paso 6.
- **Manejo de webhooks de Mercado Pago.** Idempotencia, reintentos, verificación de firma. → Paso 4 / Paso 6.
- **Servicio de mail.** Resend / SendGrid / Mailgun / SMTP propio. → Paso 6.
- **Estructura final de planes y sus límites.** Talency tiene que definir números concretos. Mientras tanto: el modelo soporta atributos configurables. → Producto.
- **Catálogo concreto de tests psicométricos.** Quién diseña las preguntas y la fórmula de score por test. → Producto.
- **Rate limiting y protección anti-abuso.** Especialmente en endpoints públicos (registro, listado de búsquedas). → Paso 6.

---

*Documento generado en el Paso 1 del planeamiento del backend de BBJobs.*
*Validado por el usuario antes de avanzar al Paso 2.*
