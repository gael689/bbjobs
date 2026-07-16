# BBJobs — Estado del Sistema
*Actualizado: junio 2026*

---

## Lo que está construido

### Frontend (Next.js 16, Tailwind v4)

- **Homepage** — Hero con NeuralCanvas animado, secciones de empresas/candidatos
- **Navbar** — Floating pill glassmorphism, auth-aware, logo BBJOBS en itálica/extrabold, cursor pointer global en botones
- **Register** — `/register?type=candidate` y `/register?type=company`
  - Candidato: nombre, apellido, teléfono
  - Empresa: razón social, CUIT, industria (con "Otro" + campo libre), **provincia** (select 24 provincias AR), **localidad**, **cantidad de empleados** (4 rangos), responsable con **nombre separado + apellido + cargo**, teléfono y email
- **Login** — `/login`, redirige según rol, padding correcto respecto al navbar fijo
- **Panel Empresa** — `/dashboard/company`
  - Banner de verificación/suspensión
  - Subida de logo (Cloudinary)
  - Modal de creación de búsqueda (selects de catálogos)
  - Lista de búsquedas con botones Pausar / Reactivar / Cerrar
  - Panel de postulaciones por búsqueda (expandible): candidato, estado, carta de presentación
  - **Botón "Ver perfil"** en cada postulante → modal con perfil completo del candidato: datos personales, resumen, experiencia, educación, habilidades con nivel, idiomas y descarga de CV
- **Panel Candidato** — `/dashboard/candidate`
  - CV upload (PDF → Cloudinary)
  - Explorar empleos activos, postularse con carta de presentación opcional
  - Mis postulaciones con estados
  - Tab "Mi perfil": Experiencia laboral, Educación, Idiomas (CRUD completo)
- **Panel Admin** — `/dashboard/admin`
  - Métricas, alerta de pendientes
  - Tab Empresas: Verificar, Rechazar (con notas), Suspender, Reactivar
  - Tab Candidatos: lista con CV
  - Tab Búsquedas: lista con "Dar de baja" por incumplimiento
  - Tab Skills pendientes: Aprobar / Rechazar
  - Tab Crear admin: formulario
- **Listado público de empleos** — `/empleos`
  - Búsqueda por texto, filtro industria, zona, modalidad
  - Cards con empresa, salario (si visible), fecha
- **Detalle de empleo** — `/empleos/[id]`
  - Descripción, requisitos, beneficios
  - Botón postularse (requiere login y rol candidato)
  - Modal con carta de presentación opcional
- **Páginas institucionales**
  - `/nosotros` — Misión, rol de Talency, cómo funciona, crédito de desarrollo (Gael González)
  - `/terminos` — Términos y condiciones completos, 10 secciones, Ley 25.326
  - `/privacidad` — Política de privacidad completa, derechos ARSO, terceros listados

---

### Backend (FastAPI, PostgreSQL Railway)

#### Auth (`/api/v1/auth/`)
- `POST /register/candidate` — registro candidato
- `POST /register/company` — registro empresa con province, city, employee_count, responsible_position
- `POST /login` — devuelve access_token en body + refresh token cookie httpOnly
- `POST /refresh` — rota tokens con período de gracia de 30 seg contra reuse
- `POST /logout` — invalida refresh token
- `GET /me` — perfil del usuario autenticado
- `POST /verify-email/{token}` — confirmación de email (sin proveedor de mail activo aún)
- `POST /forgot-password` + `POST /reset-password/{token}`

#### Empresa
- `GET /me/company/profile` — perfil
- `PATCH /me/company/profile` — editar (incluye province, city, employee_count, responsible_position)
- `POST /me/company/logo` — subir logo (Cloudinary ✅ configurado)
- `POST /me/company/verification/request` — solicitar verificación
- `POST /me/company/verification/documents` — subir documentos (Cloudinary)

#### Empleos
- `POST /me/company/jobs` — crear búsqueda
- `GET /me/company/jobs` — listar mis búsquedas
- `PATCH /me/company/jobs/{id}` — editar + transiciones de estado (draft→active→paused→closed)
- `GET /me/company/jobs/{id}/applications` — ver postulaciones enriquecidas con datos del candidato
- `PATCH /me/company/applications/{app_id}/status` — cambiar estado de postulación
- `GET /jobs` — listado público (filtros: q, industry_id, zone_id, modality)
- `GET /jobs/{id}` — detalle público

#### Candidato
- `GET /me/candidate/profile` — perfil
- `PATCH /me/candidate/profile` — editar
- `POST /me/candidate/cv` — subir CV PDF (Cloudinary ✅ configurado)
- `POST /jobs/{id}/apply` — postularse (con cover_letter opcional)
- `GET /me/candidate/applications` — mis postulaciones
- **Experiencia**: `GET/POST /me/candidate/experience`, `DELETE /me/candidate/experience/{id}`
- **Educación**: `GET/POST /me/candidate/education`, `DELETE /me/candidate/education/{id}`
- **Skills**: `POST /me/candidate/skills`, `DELETE /me/candidate/skills/{skill_id}`
- **Idiomas**: `GET/POST /me/candidate/languages`, `DELETE /me/candidate/languages/{id}`

#### Perfil completo del candidato (para empresa)
- `GET /me/company/candidates/{candidate_id}` — devuelve perfil completo (datos personales, resumen, experiencia, educación, skills con nombre, idiomas, CV) **solo si el candidato se postuló a alguna búsqueda de esa empresa** (403 si no hay postulación)

#### Admin
- `GET /admin/dashboard` — métricas
- `GET /admin/companies?status=` — lista empresas
- `PATCH /admin/companies/{id}/verify` — aprobar/rechazar con nota + notificación in-app
- `PATCH /admin/companies/{id}/suspend` — suspender (pausa búsquedas activas) + notificación
- `PATCH /admin/companies/{id}/reactivate` — reactivar empresa + notificación
- `GET /admin/candidates` — lista candidatos
- `GET /admin/jobs?status=` — lista búsquedas
- `PATCH /admin/jobs/{id}/takedown` — dar de baja + notificación a la empresa
- `GET /admin/skills/pending` — skills pendientes
- `PATCH /admin/skills/{id}` — aprobar/rechazar skill
- `POST /admin/users` — crear admin

#### Notificaciones (backend listo, UI pendiente)
- `GET /me/notifications` — mis notificaciones
- `PATCH /me/notifications/{id}/read` — marcar leída
- `POST /me/notifications/read-all` — marcar todas leídas
- Se generan automáticamente en: verificación de empresa, rechazo, suspensión, reactivación, takedown de búsqueda

#### Tests Psicométricos (backend listo, UI pendiente)
- `GET /tests` — listar tests disponibles
- `GET /tests/{id}` — detalle con preguntas y opciones
- `POST /tests/{id}/start` — iniciar sesión de test
- `POST /tests/submissions/{id}/complete` — completar con respuestas
- `GET /me/candidate/tests` — historial de tests del candidato

#### Catálogos (públicos)
- `GET /catalogs/industries` — industrias
- `GET /catalogs/zones` — zonas de Bahía Blanca
- `GET /catalogs/contract-types` — tipos de contrato

#### Skills
- `GET /skills` — listar skills activos
- `POST /skills` — sugerir nueva skill (queda en `pending`)

#### Cuenta
- `DELETE /me/account` — eliminar cuenta propia (requiere password)
  - Candidato: borra todo, anonimiza postulaciones
  - Empresa: anonimiza datos (búsquedas históricas se mantienen)
  - Admin: 403

---

## Migraciones aplicadas en DB

| Revisión | Descripción |
|---|---|
| `e3d551f98668` | Schema inicial completo |
| `dd19f874f2f7` | Notificaciones |
| `c40ee9c5dca9` | No-op (verification_status como varchar, no enum PG) |
| `f4a2b8c3d1e9` | Nuevos campos empresa: province, city, employee_count, responsible_position |

---

## Decisiones técnicas

| Decisión | Elección | Motivo |
|---|---|---|
| ORM | SQLAlchemy 2.x async | Performance + type safety |
| DB Driver | asyncpg | Driver async nativo para PG |
| Auth | JWT HS256 (30 min) + refresh token opaco en DB | Sin estado, rotación segura con período de gracia |
| Refresh token | httpOnly cookie | No accesible por JS |
| Password hash | bcrypt directo | Compatibilidad con versiones |
| Enums en DB | VARCHAR (no PG enum) | Más flexibles para agregar valores sin migraciones complejas |
| Storage | Cloudinary ✅ | Más simple que R2 para MVP, 25 GB free |
| Mail | Resend o Brevo (pendiente API key) | No bloqueante para desarrollo |
| Pagos | MercadoPago — pendiente Fase 1 | $10.000 ARS por vacante destacada, 7 días |
| Hosting | Railway (backend + DB) + Vercel (frontend) | Plan acordado |

---

## Pendientes Fase 1

### 1. Módulo de notificaciones (UI)
- Backend completo y funcionando (genera notificaciones en todos los eventos clave)
- Falta: campana en navbar con badge de no leídas, panel de notificaciones, marcar como leída

### 2. Integración de emails
- Proveedor elegido: **Resend** o **Brevo** (Brevo tiene free tier más generoso: 300/día sin límite mensual)
- Código preparado, falta configurar API key
- Emails a implementar: verificación de cuenta, recupero de contraseña, empresa verificada/rechazada, nueva postulación

### 3. Mercado Pago — vacantes destacadas
- Precio: **$10.000 ARS** por vacante, duración **7 días**
- Modelos en DB ya creados (Plan, Subscription, Payment, FeaturedJob)
- Falta: UI de pago en panel empresa, webhook handler, lógica de activación del destaque, visualización en listado público con etiqueta "Destacada"

---

## Lo que NO se implementa en Fase 1

- Tests psicométricos (UI) — backend completo, se activa en Fase 2
- Matching con IA (Gemini) — Fase 2
- Observatorio Laboral — Fase 2
- Mensajería interna entre empresa y candidato — Fase 2

---

## Comandos para desarrollo local

```bash
# Backend (desde /backend)
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend (desde /frontend)
npm run dev

# Migraciones
.venv\Scripts\python.exe -m alembic upgrade head

# Seed inicial (una vez)
.venv\Scripts\python.exe seed.py

# Admin por defecto
# email: admin@bbjobs.com.ar
# password: Admin1234!
```

---

## Variables de entorno necesarias (.env backend)

```env
SECRET_KEY=...
DATABASE_URL=postgresql+asyncpg://...
CLOUDINARY_CLOUD_NAME=dbvu6oplq       ✅ configurado
CLOUDINARY_API_KEY=...                ✅ configurado
CLOUDINARY_API_SECRET=...             ✅ configurado
RESEND_API_KEY=                       ⏳ pendiente
MP_ACCESS_TOKEN=                      ⏳ pendiente
MP_PUBLIC_KEY=                        ⏳ pendiente
MP_WEBHOOK_SECRET=                    ⏳ pendiente
```
