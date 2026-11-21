# Paso 7 — Riesgos y dependencias

> Mapa de riesgos técnicos, operacionales y legales del proyecto.
> Para cada ítem: descripción, probabilidad (A/M/B), impacto (A/M/B), mitigación.

---

## 1. Dependencias externas críticas

### 1.1. Mercado Pago ⚠️ Crítica

**Rol:** único procesador de pagos en F1 (destacar búsqueda, suscripciones en F2).

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Cambios de API sin aviso suficiente | M | A | Versionar el endpoint de MP usado (`/v1/payments`). Tener tests de integración contra sandbox que corran en CI. |
| Diferencias sandbox vs producción | A | M | Validar flujo completo en producción con un pago real de $1 antes de lanzar. |
| Cuenta suspendida por incumplimiento | B | A | Leer términos de MP para marketplaces/plataformas. No almacenar datos de tarjetas (MP los maneja). |
| Webhook no llega o llega con delay | M | M | Job de reproceso para eventos `processed_at IS NULL`. Reconciliación periódica: comparar `Payment.status` con el estado en MP vía `GET /v1/payments/{id}`. |
| MP devuelve `approved` pero luego hace chargeback | B | M | Guardar `mp_payment_id` en `Payment`. Política de negocio: no reembolsar automáticamente, admin gestiona manualmente. |
| Inestabilidad del servicio (outage de MP) | B | A | No hay fallback de procesador en F1. Mostrar mensaje de error claro al usuario. Documentar como riesgo aceptado. |

**Notas importantes:**
- La firma del webhook (`x-signature`) es la primera validación — sin esto cualquiera puede triggerear un destacado gratis.
- MP puede cambiar los códigos de `status_detail` sin cambiar `status`. Solo procesar sobre `status` (`approved`, `rejected`, `pending`).
- En Argentina, el procesamiento de pagos en ARS puede fallar por restricciones cambiarias. No hay nada que hacer del lado técnico.

---

### 1.2. Resend — Mail transaccional

**Rol:** único canal de mail en F1 (verificación, reset de password, notificaciones).

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Free tier limitado (100/día) | M | M | 100/día es ~3.000/mes. Si hay pico de registros (ej. campaña de lanzamiento), se puede superar. Monitorear con Sentry. Upgradar el plan de Resend (~$20/mes) si se proyecta superar. |
| Mails que caen en spam | M | A | Configurar SPF, DKIM y DMARC correctamente en el DNS del dominio. Resend lo guía en el onboarding. Verificar con mail-tester.com antes de lanzar. |
| Servicio de Resend caído | B | M | Si los mails de verificación no llegan, el usuario no puede registrarse. Implementar reintento: si el mail falla, no fallar el request, sino encolar un reintento en el job programado. |
| Cuenta suspendida por spam reports | B | A | No enviar mails no solicitados. Implementar unsubscribe en las alertas de empleo (obligatorio). |

---

### 1.3. Cloudflare R2 — Storage de archivos

**Rol:** almacenamiento de CVs, logos de empresa, documentos de verificación.

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Cuenta suspendida o datos inaccesibles | B | A | R2 no tiene SLA en el free tier. Evaluar backup periódico de archivos críticos a otro storage si el negocio crece. |
| Fallo parcial en upload (DB actualizada, R2 no) | M | M | Orden de operaciones: primero subir a R2, luego actualizar DB. Si R2 falla, la DB no se actualiza y se le muestra error al usuario. Si la DB falla después de R2, el job de limpieza de archivos huérfanos recupera el espacio. |
| Jurisdicción de datos (Cloudflare = empresa USA) | M | M | Los CVs contienen datos personales. Ley 25.326 no prohíbe almacenamiento en el exterior, pero requiere que se garantice un nivel adecuado de protección. Cloudflare cumple estándares internacionales. Documentar en política de privacidad. |
| Presigned URL usada más de una vez o filtrada | B | B | Ventana de expiración de 15 min limita el daño. No hay datos bancarios, el riesgo es exposición del CV a terceros. Aceptable. |

---

### 1.4. Railway — Backend + Postgres

**Rol:** hosting del backend FastAPI y la base de datos Postgres.

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| **Cold starts en Hobby** | A | M | En Hobby, el servicio duerme después de inactivo. El primer request puede tardar 10-30s. Opciones: (a) aceptarlo en F1 mientras el tráfico sea bajo, (b) usar un servicio de "keep-alive" (ping cada 5 min desde GitHub Actions o similar), (c) upgradar a Pro cuando el tráfico lo justifique. |
| Sin backup automático de Postgres en Hobby | A | A | Railway Hobby no incluye backups automáticos de DB. **Acción requerida:** configurar `pg_dump` periódico a R2 o similar desde el primer día. |
| Costo supera los $5 incluidos | M | B | Estimación conservadora: backend ~$4 + Postgres ~$6 = ~$10/mes. Se paga el excedente. No es un riesgo grave, solo preverlo. |
| Outage de Railway | B | A | No hay SLA en Hobby. Documentar como riesgo aceptado para F1. Si el uptime se vuelve crítico: upgradar a Pro o evaluar fly.io. |
| Deploy falla y migración Alembic queda a mitad | B | A | Siempre hacer migrations con transacciones. Alembic usa transacciones por defecto. Tener procedimiento de rollback (`alembic downgrade -1`) documentado. |

---

### 1.5. Vercel — Frontend Next.js

**Rol:** hosting del frontend.

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Límites del Hobby gratuito | B | B | 100 GB bandwidth/mes, deploys ilimitados. Muy difícil superar en F1. |
| Build falla en deploy | M | M | CI en GitHub Actions que corre `npm run build` antes del push a main. |

---

### 1.6. NIC.ar — Dominio

**Rol:** titular del dominio `bbjobs.com.ar`.

| Riesgo | Prob | Impacto | Mitigación |
|--------|------|---------|-----------|
| Dominio vence y no se renueva | B | A | Activar renovación automática. Poner recordatorio en calendario. |
| Dominio `bbjobs.com.ar` ya registrado | M | A | **Verificar disponibilidad en NIC.ar antes de continuar.** Si está tomado, decidir alternativa (`talency.com.ar`, `bbjobs.ar`, etc.) a tiempo. |

---

## 2. Riesgos técnicos de arquitectura

### 2.1. APScheduler + Railway cold starts

**Riesgo:** si Railway "duerme" el proceso y lo reinicia por un request, APScheduler reinicia con él. Los jobs programados para esa ventana se saltan.

**Prob:** M (en Hobby con tráfico bajo) | **Impacto:** M

**Mitigación:**
- Jobs deben ser idempotentes y orientados a "catch-up": si el job de vencimiento de `JobFeature` no corrió a las 00:00, cuando corra a las 00:15 por el primer request del día tiene que procesar igual todo lo vencido.
- Diseñar todos los jobs como: "¿qué debería haber pasado hasta ahora que no pasó?" en vez de "ejecutar acción puntual".

---

### 2.2. RLS + usuario de app no aislado

**Riesgo:** si el usuario de conexión de la app tiene `SUPERUSER` o `BYPASSRLS`, las políticas RLS no tienen efecto.

**Prob:** B (error de configuración inicial) | **Impacto:** A (toda la lógica de aislamiento multi-tenant falla silenciosamente)

**Mitigación:**
- Crear el usuario de la app (`app_user`) sin privilegios de superuser desde el primer día.
- Test explícito en CI: conectarse como `app_user` sin setear el contexto de sesión y verificar que las queries devuelven vacío.

---

### 2.3. Refresh token rotation + falla de red

**Riesgo:** el cliente hace refresh, el servidor rota el token y responde, pero la respuesta no llega al cliente. El cliente reintenta con el token viejo, que ya fue invalidado → sesión cerrada sin acción del usuario.

**Prob:** B | **Impacto:** M (mala UX, usuario pierde la sesión)

**Mitigación:**
- Ventana de gracia: al rotar, marcar el token viejo como `superseded_at = now()` en vez de borrarlo inmediatamente. Aceptar el token viejo durante 30 segundos solo si el nuevo existe y fue emitido en ese intervalo. Después de la ventana, borrar definitivamente.

---

### 2.4. Migraciones en producción con tabla grande

**Riesgo:** agregar una columna con `NOT NULL` sin default, crear un índice, o alterar una columna en una tabla con muchas filas puede lockear la tabla y dejar el backend caído durante el deploy.

**Prob:** B en F1 (pocos datos) | **Impacto:** A en F2+ (cuando haya volumen)

**Mitigación:**
- Desde el día 1: hábito de migrations sin locking: usar `ADD COLUMN ... DEFAULT NULL` primero, luego backfill, luego agregar constraint.
- Para índices: usar `CREATE INDEX CONCURRENTLY`.
- Documentar esto en el README de contribución.

---

### 2.5. Webhook MP procesado dos veces por race condition

**Riesgo:** MP envía el mismo evento dos veces con pocos segundos de diferencia. Dos instancias (o dos tareas concurrentes) empiezan a procesar antes de que el `INSERT` en `MercadoPagoWebhookEvent` complete.

**Prob:** B | **Impacto:** M (doble activación de destacado)

**Mitigación:**
- El constraint UNIQUE en `mp_event_id` maneja el caso si los dos requests llegan con algo de delta.
- Para el caso de concurrencia pura: usar `SELECT ... FOR UPDATE SKIP LOCKED` al procesar, o un `advisory lock` de Postgres con el `mp_event_id` como key.

---

## 3. Riesgos legales y de compliance

### 3.1. Ley 25.326 — Protección de datos personales

**Riesgo:** BBJobs procesa datos personales sensibles (CVs, documentos de identidad de empresas). Incumplir puede generar sanciones.

**Prob:** B (si se implementa correctamente) | **Impacto:** A

**Checklist de compliance mínimo para F1:**
- [ ] Política de privacidad publicada en el sitio.
- [ ] Endpoint `GET /me/candidate/export` — exportar todos los datos del candidato.
- [ ] Endpoint `GET /me/company/export` — exportar todos los datos de la empresa.
- [ ] Hard delete con anonización correcta (ya definido en Paso 2a).
- [ ] Opción de unsubscribe en emails de alertas de empleo.
- [ ] No compartir datos de candidatos con empresas más allá de lo necesario para el proceso de selección (asimetría de privacidad ya definida en Paso 1).
- [ ] Los CVs en R2 almacenados bajo paths no adivinables (UUID, no nombre del archivo original).

---

### 3.2. Términos de servicio de Mercado Pago

**Riesgo:** MP tiene restricciones sobre el tipo de negocios que pueden usar su plataforma. Una plataforma de empleos con pagos por destacado puede caer en categoría "marketplace" con requisitos adicionales.

**Prob:** B | **Impacto:** A

**Mitigación:** Leer los ToS de MP para el caso de uso específico. Consultar con soporte de MP si el modelo de negocio requiere una integración de tipo "marketplace" (con split de pagos) o basta con el flujo estándar.

---

## 4. Riesgos operacionales

### 4.1. Sin CI/CD definido todavía

**Riesgo:** deploys manuales, sin tests automáticos antes de pushear.

**Prob:** A (no está definido aún) | **Impacto:** M

**Mitigación:** Definir pipeline básico de GitHub Actions antes del primer deploy a producción:
- `lint` + `typecheck` (mypy) + `pytest` al abrir PR.
- `alembic upgrade head` en el entrypoint del contenedor de Railway.
- Branch `main` = producción. Branch `develop` = staging (si se quiere).

---

### 4.2. Sin backup de base de datos

**Riesgo:** Railway Hobby no hace backups automáticos de Postgres. Un drop accidental o corrupción de datos = pérdida total.

**Prob:** B (pero el impacto es irreversible) | **Impacto:** A

**Mitigación — acción requerida antes del primer deploy productivo:**
- Job diario que corre `pg_dump` y sube el dump a R2.
- Retener los últimos 7 dumps.
- Probar al menos una restauración antes de lanzar.

---

### 4.3. Un único desarrollador

**Riesgo:** si el desarrollador no puede trabajar (enfermedad, etc.), no hay quien haga on-call o deployar hotfixes.

**Prob:** M | **Impacto:** M

**Mitigación:** Documentar los procedimientos críticos (cómo hacer rollback, cómo conectarse a la DB en producción, cómo revocar el access secret de MP) en un runbook interno. El `00-estado-planeamiento.md` ya cumple parte de ese rol.

---

## 5. Matriz de riesgos consolidada

| Riesgo | Prob | Impacto | Acción |
|--------|------|---------|--------|
| Sin backup de Postgres | A | A | **Resolver antes del primer deploy productivo** |
| Cold starts Railway Hobby | A | M | Aceptar en F1, jobs orientados a catch-up |
| Dominio `bbjobs.com.ar` tomado | M | A | **Verificar en NIC.ar hoy** |
| Free tier Resend superado (100/día) | M | M | Monitorear, upgradar plan si corresponde |
| MP webhook sin firma verificada | — | A | **Implementar desde el día 1, no negociable** |
| Fallo parcial de upload a R2 | M | M | Subir a R2 primero, luego actualizar DB |
| Rotación de refresh + red cortada | B | M | Ventana de gracia de 30s en token viejo |
| RLS no activo por usuario superuser | B | A | Test explícito en CI desde el día 1 |
| Race condition en webhook MP | B | M | Advisory lock o SELECT FOR UPDATE SKIP LOCKED |
| Migraciones lockeantes en producción | B | A | Hábitos desde el día 1, `CREATE INDEX CONCURRENTLY` |
| Sin CI/CD definido | A | M | Definir antes de primer deploy |
| Ley 25.326 incumplida | B | A | Checklist de compliance en F1 |

---

## 6. Acciones requeridas antes del primer deploy productivo

Lista priorizada de lo que **no puede obviarse**:

1. **Verificar disponibilidad de `bbjobs.com.ar`** en NIC.ar.
2. **Configurar backup diario de Postgres** a R2 (pg_dump + upload).
3. **Implementar verificación de firma de webhook MP** (`x-signature`).
4. **CI básico en GitHub Actions** (lint + tests + build antes de merge a main).
5. **Test de RLS**: conectarse como `app_user` sin contexto y verificar que queries no devuelven datos.
6. **Verificar SPF + DKIM + DMARC** del dominio en Resend antes de enviar mails masivos.
7. **Hacer un pago real de prueba** en MP producción (pago de $1) antes de abrir al público.
8. **Publicar política de privacidad** con mención a Ley 25.326.
9. **Documentar runbook básico** (rollback de deploy, rollback de migración, acceso de emergencia a DB).

---

*Paso 7 cerrado. Planeamiento funcional del backend completo.*
*Próximo paso: estructura de carpetas, scaffold inicial, modelos SQLAlchemy concretos.*
