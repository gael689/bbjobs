# Paso 4 — Flujos principales

> Mapa de los flujos críticos del backend en Fase 1.
> Cada flujo lista actores, pasos secuenciales, efectos colaterales y caminos alternativos / de error.
>
> **Alcance de planes en F1.** Los planes (Free / Pro / Premium) **no tienen beneficios ni precios definidos** todavía. La realidad de F1 es: **casi todo es gratis**. El sistema arranca abierto para generar adopción.
> El **único flujo de pago real en F1 es destacar una búsqueda** (pago único vía Mercado Pago).
> Suscripciones, upgrades, downgrades, preapproval recurrente, períodos de gracia y degradación automática **no se implementan en F1** — quedan al final del documento como diseño documentado para fases futuras.

---

## Flujos activos en Fase 1

### Flujo 1 — Registro y verificación de empresa

**Actores:** empresa (visitante), admin (Talency), servicio de mail.

**Precondiciones:** ninguna.

#### Pasos

1. **Registro.**
   - La empresa completa: email, password, razón social, CUIT, rubro, datos del responsable (nombre, teléfono, email), opcionalmente website / descripción / logo.
   - Opcionalmente sube documentación de respaldo (constancia AFIP u otra) → `CompanyVerificationDocument`.
2. **Creación de entidades.**
   - `User(role=company, email_verified_at=null)`.
   - `CompanyProfile(verification_status=pending, is_anonymized=false)`.
   - `Subscription(plan=free, status=active)` — invariante de "siempre una Subscription activa". En F1 todas las empresas quedan acá de por vida.
   - Se emite `EmailVerificationToken` y se envía mail de verificación.
3. **Verificación de email.**
   - La empresa clickea el link → `User.email_verified_at = now()`, el token se invalida.
   - Aún no puede operar (verificación de cuenta sigue pendiente).
4. **Notificación al admin.**
   - El admin recibe mail con link al panel de revisión.
5. **Revisión manual.**
   - El admin revisa datos y documentación. Aprueba o rechaza (con `verification_notes` opcional).
6a. **Aprobación.**
   - `verification_status=verified`, `verified_at`, `verified_by_admin_id`.
   - Mail a la empresa: "Tu cuenta fue verificada".
   - Entrada en `AuditLog`.
6b. **Rechazo.**
   - `verification_status=rejected`, `verification_notes`.
   - Mail a la empresa con el motivo.
   - La empresa puede editar y reaplicar (vuelve a `pending`).

#### Errores y bordes
- CUIT ya registrado → 409.
- Email ya registrado → 409.
- Token expirado → endpoint para reenviar mail.

---

### Flujo 2 — Publicación de búsqueda

**Actores:** empresa.

**Precondiciones:**
- `CompanyProfile.verification_status = verified`.

> **Nota F1.** No se aplican límites de plan: en F1 publicar es gratis e ilimitado para toda empresa verificada. Los campos `Plan.max_active_job_postings` existen en el modelo pero el backend no los chequea aún. Cuando Talency defina planes y precios, se activa la validación en un paso de cierre de alcance, sin migrar datos.

#### Pasos

1. **Creación del draft.**
   - La empresa completa: título, descripción, requisitos, industria, zona, modalidad, tipo de contrato, experiencia mínima, nivel educativo mínimo, beneficios, rango salarial (opcional + flag de visibilidad), skills requeridas.
   - `JobPosting(status=draft, company_id, company_legal_name_snapshot=company.legal_name)`.
   - Skills se vinculan vía `JobPostingSkill`. Si la empresa quiere usar una skill que no existe en el catálogo: puede sugerirla → entra a `Skill(status=pending)` (decisión 5).
2. **Publicación.**
   - Apreta "Publicar". Backend valida que la empresa sigue `verified`.
   - `JobPosting.status=active`, `published_at=now()`.
3. **Indexación.**
   - Visible en el listado público (`GET /jobs`).
   - Si tiene `JobFeature` activo (flujo 4), aparece en el tope con badge "Destacada".

#### Transiciones posteriores
- Pausar: `active → paused`.
- Reanudar: `paused → active`.
- Cerrar: `active|paused → closed` (terminal).

#### Errores y bordes
- Empresa no verificada → 403.
- Datos inválidos (zona inexistente, skill `merged`/`rejected`, salario min > max) → 422.

---

### Flujo 3 — Postulación de candidato

**Actores:** candidato.

**Precondiciones:**
- `User.role=candidate`, `email_verified_at != null`.
- `CandidateProfile` con campos mínimos completos (nombre, apellido, CV subido).
- La búsqueda está en `status=active`.

#### Pasos

1. **Descubrimiento.**
   - El candidato navega el listado público o llega desde un mail de alerta.
   - Abre el detalle de la búsqueda.
2. **Validación previa.**
   - ¿Ya tiene `Application` para esta búsqueda? → "Ya te postulaste", bloqueo del botón.
3. **Postulación con un click.**
   - Opcionalmente escribe una `cover_letter` (campo libre por postulación, no se guarda en el perfil).
   - `Application(status=new, candidate_id, job_posting_id, cover_letter)`.
   - Constraint único `(candidate_id, job_posting_id)` protege contra dobles postulaciones.
4. **Notificación a la empresa.**
   - Mail a la empresa: "Recibiste una nueva postulación en [título]".
5. **Confirmación al candidato.**
   - Mensaje en pantalla. La postulación aparece en su panel con estado `new`.

#### Bordes
- CV no cargado → redirección a "Completá tu perfil".
- Empresa suspendida entre el listado y el click → búsqueda ya está `paused`, error 409.

---

### Flujo 4 — Destacar búsqueda (único pago real en F1)

**Actores:** empresa, Mercado Pago, backend (incluye worker de webhook).

**Precondiciones:**
- `CompanyProfile.verification_status = verified`.
- La búsqueda está en `active` o `paused` (no `closed`).
- Mercado Pago configurado (access token, webhook URL).

#### Pasos

1. **Solicitud.**
   - La empresa apreta "Destacar esta búsqueda".
   - Backend crea `JobFeature(job_posting_id, status=pending_payment)`.
   - Backend crea `Payment(type=job_feature, mp_status=pending, related_job_feature_id, company_id)`.
   - Backend crea una **preferencia de pago** en MP (no preapproval — es pago único): monto (configurable por admin), descripción, `back_urls`, `notification_url`.
   - Backend devuelve la URL de checkout de MP al frontend.
2. **Pago en Mercado Pago.**
   - El usuario completa el pago en el checkout de MP.
   - MP redirige al `back_url` (success / failure / pending) → solo informativo, no activa nada.
3. **Webhook (única fuente de verdad).**
   - MP envía un webhook al backend confirmando el pago.
   - Backend valida la firma del webhook.
   - Persiste `MercadoPagoWebhookEvent(mp_event_id único, topic, raw_payload, received_at)` antes de procesar — idempotencia.
   - Procesa el evento:
     - **`payment.status = approved`:**
       - `Payment.mp_status = approved`, `paid_at = now()`.
       - `JobFeature.status = active`, `starts_at = now()`, `ends_at = now() + duración_configurada` (default 7 días, configurable por admin).
       - `JobPosting.is_featured = true`, `featured_until = JobFeature.ends_at`.
       - Mail a la empresa: "Tu búsqueda está destacada hasta [fecha]".
     - **`payment.status = rejected`:**
       - `Payment.mp_status = rejected`.
       - `JobFeature.status = canceled`.
       - Mail a la empresa: "El pago no se procesó".
4. **Vencimiento (job programado).**
   - Job diario detecta `JobFeature.status=active` con `ends_at < now()`.
   - `JobFeature.status = expired`.
   - Si la `JobPosting` no tiene otro `JobFeature` activo: `is_featured=false`, `featured_until=null`.

#### Idempotencia y reintentos
- Webhook puede reenviarse varias veces → `mp_event_id` único descarta duplicados.
- Si el procesamiento falla, se registra en `MercadoPagoWebhookEvent.processing_error` para reintento manual o por worker.
- Frontend NO confía en `back_url` para activar nada: solo el webhook lo activa. Si el usuario vuelve antes que llegue el webhook, el frontend hace polling sobre el estado del `JobFeature`.

#### Bordes
- Pago expirado en MP (no se completó dentro de la ventana de la preferencia) → `Payment.mp_status=cancelled`, `JobFeature.status=canceled`.
- Empresa apreta "Destacar" sobre una búsqueda que ya tiene un `JobFeature` activo → bloqueo en backend (un destacado activo por búsqueda).

---

### Flujo 5 — Tests psicométricos del candidato

**Actores:** candidato, admin (carga el catálogo).

**Precondiciones:**
- El admin tiene al menos un `PsychometricTest(is_active=true)` cargado con sus `TestQuestion` y `TestQuestionOption`.

#### Pasos

1. **Inicio del intento.**
   - El candidato abre la sección de tests, ve el catálogo (`is_active=true`) y elige uno.
   - Backend valida cooldown: el último `TestSubmission(test_id=X, candidate_id=Y, status=completed)` debe ser > 30 días atrás (decisión Paso 3). Si no, error 409.
   - `TestSubmission(status=in_progress, started_at=now())`.
2. **Respuestas.**
   - El candidato responde pregunta por pregunta. Cada respuesta crea/actualiza un `TestAnswer(submission_id, question_id, selected_option_id)`.
3. **Cierre.**
   - Al enviar la última respuesta, backend calcula `score` según `PsychometricTest.scoring_method` (sum / average / scale).
   - `TestSubmission.status=completed`, `completed_at=now()`, `score=...`.
4. **Visibilidad.**
   - **Candidato:** ve su historial completo (todas las submissions con su score), para visualizar su evolución.
   - **Empresa:** cuando ve un perfil de candidato postulado, ve **solo el último `completed`** por test (sin historial, sin respuestas crudas en F1, solo score y tal vez resumen básico).

#### Bordes
- Test desactivado (`is_active=false`) entre el inicio y el cierre → la submission `in_progress` puede completarse igual (ya está empezada); solo bloquea nuevos starts.
- `in_progress` sin actividad por N días: job de limpieza la cierra/descarta (política a definir en Paso 6).

---

### Flujo 6 — Alertas de empleo por mail (transversal)

**Actores:** candidato, sistema (job programado), servicio de mail.

#### Pasos

1. **Configuración.**
   - El candidato crea `JobAlert(industry_id?, zone_id?, modality?, is_active=true)`.
2. **Disparo (job programado).**
   - Cada N horas, un job recorre las `JobPosting` recientes en `active`.
   - Para cada `JobAlert` activa busca búsquedas que matcheen los filtros y NO estén en `JobAlertNotification` para esa alerta.
3. **Envío.**
   - Mail al candidato con las nuevas búsquedas.
   - Cada match se registra en `JobAlertNotification(alert_id, job_posting_id, sent_at)` — constraint único evita duplicados.
   - `JobAlert.last_sent_at = now()`.

---

### Flujo 7 — Hard delete por Ley 25.326 (transversal)

**Actores:** candidato o empresa, admin (puede ejecutarlo a pedido).

#### Pasos

1. El usuario solicita "Eliminar todos mis datos" desde su panel.
2. Endpoint dedicado, con validación adicional (re-ingreso de contraseña / confirmación).
3. **Candidato:**
   - Se elimina el archivo de CV del storage.
   - Se borran `CandidateSkill`, `Experience`, `Education`, `Language`, `JobAlert`, `JobAlertNotification`, `TestSubmission` y sus `TestAnswer`.
   - Las `Application` se **anonimizan** (no se borran): campos sensibles → placeholders. La empresa ve "Candidato eliminado".
   - `CandidateProfile` y `User` se borran físicamente.
4. **Empresa:**
   - Se eliminan logo y documentación adjunta del storage.
   - `CompanyProfile.is_anonymized=true`; campos identificatorios → placeholders (decisión 6).
   - El `User` puede borrarse físicamente.
   - `Payment` se preserva intacto con `company_id` apuntando al row anonimizado (decisión 6, inmutabilidad).
   - `JobPosting` históricas se mantienen para el Observatorio Laboral con `company_legal_name_snapshot` mostrando "Empresa no disponible" en UI pública.

---

## Flujos administrativos (Talency)

### Flujo 8 — Gestión administrativa

**Actores:** admin.

#### Acciones disponibles en F1

- **Verificar empresas:** ver lista de `pending`, abrir detalle, aprobar / rechazar (con `verification_notes`).
- **Suspender / reactivar empresa:** transición de `verified` ↔ `suspended`. Suspender pausa las búsquedas activas automáticamente; reactivar **no** las republica.
- **Bajar búsquedas:** transición a `closed` por incumplimiento de condiciones de uso (takedown).
- **Gestionar catálogos:**
  - `Industry`, `Zone`, `ContractType`: CRUD.
  - `Skill`: ver pendientes, aprobar / rechazar / fusionar (con migración interna de pivots).
  - `PsychometricTest`: crear, editar, activar/desactivar (catálogo de tests con preguntas y opciones).
- **Configurar parámetros:** precio del destacado, duración del destacado, atributos de cada `Plan` (todo el panel queda preparado aunque los planes no estén en uso en F1).
- **Métricas básicas:** dashboard con cantidad de empresas activas / verificadas / pendientes, candidatos registrados, búsquedas activas, postulaciones por mes, pagos recibidos por destacados.
- **Crear otros admins:** desde el panel, alta de `User(role=admin)`.

Todas las acciones que modifican estado de otras entidades quedan registradas en `AuditLog`.

---

## Diseño documentado para fases futuras (no se implementa en F1)

Las siguientes mecánicas existen en el modelo de datos pero **no tienen flujos activos** en Fase 1. Quedan acá como referencia para cuando Talency decida activar la monetización.

### Cambio de plan (upgrade / downgrade)

Cuando Talency defina:
- Beneficios concretos de cada plan.
- Precios.
- Si la cobranza es por suscripción recurrente, manual mensual, o pago anual.

…se diseña en detalle el flujo de cambio de plan, contemplando:
- Cómo el usuario inicia el upgrade.
- Cómo persiste el cambio en la `Subscription`.
- Si se actualiza la `Subscription` existente o se crea una nueva manteniendo histórico.
- Política de downgrade (al fin del período, sin prorrateo, sugerido para simplicidad).
- Qué pasa con búsquedas activas que excedan el límite del nuevo plan.

### Renovación automática y manejo de fallos

Si la cobranza es recurrente:
- Modelo de preapproval en MP.
- Webhook de renovación.
- `Subscription.status = past_due` con período de gracia (decisión Paso 1: 7 días).
- Job de degradación a Free transcurridos los 7 días.
- Cancelación voluntaria con `cancel_at_period_end=true`.

### Refund / chargeback de destacado

En F1 no se contempla flujo de reembolso automático para destacados. Si hay un caso excepcional, el admin lo gestiona externamente vía MP y registra el ajuste manualmente.

### Desbloqueo de postulaciones por pago

Mencionado en el contexto original como funcionalidad potencial. Excluida de F1. Modelo de datos preparado (`Plan.max_visible_applications_per_posting`). Cuando se active: tabla nueva `ApplicationUnlockPurchase` + endpoint de compra.

---

*Documento de flujos principales — Paso 4 (ajustado al alcance real de F1).*
*Validado por el usuario antes del Paso 5.*
