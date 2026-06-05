# Estado del planeamiento del backend de BBJobs

> Documento de handoff entre sesiones. Resume qué se hizo, dónde está cada cosa y qué falta decidir/hacer.
> Última actualización: cierre de sesión por límite de tokens.

---

## Stack confirmado

- **Backend:** FastAPI (Python)
- **Base de datos:** PostgreSQL
- **Frontend:** Next.js (App Router) — se planea en sesión separada
- **Auth:** JWT propio (access + refresh tokens)
- **Hosting:** Railway (Hobby plan)
- **Pagos:** Mercado Pago API
- **Almacenamiento de CVs:** a decidir (ver Paso 6, decisión #4)

---

## Pasos completados

| Paso | Archivo | Estado |
|------|---------|--------|
| 1. Análisis del dominio | `01-analisis-dominio.md` | ✅ Cerrado |
| 2. Diagrama de entidades | `02-entidades.md` | ✅ Cerrado |
| 2a. Decisiones críticas del modelo de datos | `02a-decisiones-criticas.md` | ✅ Cerrado |
| 3. Estados y transiciones | `03-estados-transiciones.md` | ✅ Cerrado |
| 4. Flujos principales | `04-flujos-principales.md` | ✅ Cerrado (con alcance ajustado: solo destacar búsqueda es flujo de pago real en F1) |
| 5. Endpoints del backend | `05-endpoints.md` | ✅ Cerrado |
| 6. Decisiones técnicas pendientes | `06-decisiones-tecnicas.md` | ✅ Cerrado |
| 7. Riesgos y dependencias | `07-riesgos-dependencias.md` | ✅ Cerrado |

---

## Decisiones cerradas hasta acá (resumen rápido)

### Del Paso 1 (análisis del dominio)
- Producto mono-tenant, web responsive, mobile-first.
- 3 roles: admin (Talency), empresa (1 user en F1, multi-user en F2), candidato.
- Empresa verificada manualmente por Talency es el núcleo de confianza.
- Asimetría de privacidad: empresas solo ven candidatos que se postularon a sus búsquedas.
- IA = Fase 2.

### Del Paso 2a (decisiones críticas del modelo)
1. **CV vivo**, no snapshot por postulación. UX muestra "actualizado hace N días" + aviso al candidato al actualizar.
2. **`company_legal_name_snapshot` en JobPosting** para preservar Observatorio si la empresa se da de baja.
3. **Subscription Free implícita al crear empresa.** Toda empresa siempre tiene una Subscription activa.
4. **Planes configurables por admin** (columnas tipadas + `features_json` JSONB).
5. **Skills: catálogo curado** por Talency + sugerencias del candidato → estado `pending`.
6. **Payments inmutables.** Hard delete excepcional anonimiza la empresa pero conserva Payments.

### Del Paso 3 (estados)
- Suspensión de empresa pausa búsquedas activas; reactivación NO las republica.
- JobPosting `closed` es terminal.
- Revertir `discarded` de Application: lo puede hacer la empresa (con AuditLog).
- Period de gracia de Subscription past_due: 7 días → degradación a Free.
- Invariante: empresa siempre tiene una Subscription activa (job de degradación crea Free al transicionar a canceled/expired).
- Tests psicométricos: cooldown 30 días entre intentos completados del mismo test; empresa ve solo el último; candidato ve historial completo.

### Del Paso 4 (flujos)
- **Único flujo de pago real en F1: destacar búsqueda** (pago único MP).
- Suscripciones, upgrades, downgrades, preapproval recurrente, prorrateos → **fuera de F1**, solo documentados.
- Webhook MP = única fuente de verdad. Frontend no activa nada.
- Duración del destacado configurable por admin, default 7 días.

### Del Paso 5 (endpoints)
- Login con access token (JSON) + refresh token (cookie httpOnly secure).
- Observatorio detallado abierto en F1 para empresas verificadas + admin (sin gateo de plan).
- `PATCH /applications/{id}/status` único, validación de transiciones en backend.
- `GET /me/company/applications/{id}` marca `seen_at` automáticamente solo para rol empresa (admin auditando no dispara).
- Endpoints de exportación de datos (`GET /me/candidate/export`, `GET /me/company/export`) previos al hard delete por Ley 25.326.
- `POST /me/candidate/skills/suggest` separado del agregar skill normal. Al aprobarse la sugerencia, auto-vincula al perfil del candidato.

---

## Decisiones del Paso 6 — CERRADAS

Ver detalle completo en `06-decisiones-tecnicas.md`. Resumen:

1. **Access token:** HS256 + TTL 30 min.
2. **Refresh token:** tabla `RefreshToken` en DB, revocación inmediata.
3. **Rotación del refresh:** rotación en cada refresh.
4. **Storage de archivos:** Cloudflare R2.
5. **Subida de archivos:** multipart al backend en F1.
6. **Servido de archivos:** presigned URLs cortas (5-15 min).
7. **Autorización:** dependencias FastAPI + helpers reusables.
8. **Scoping de queries:** en repositorios (primaria) + RLS en Postgres (defensa en profundidad).
9. **Rate limiting:** SlowAPI in-memory (sin Redis en F1).
10. **Mail:** Resend + templates Jinja2 en el repo.
11. **Webhook MP:** FastAPI BackgroundTasks + job de reproceso.
12. **Jobs programados:** APScheduler in-process.
13. **Migraciones:** Alembic.
14. **ORM:** SQLAlchemy 2.x puro + Pydantic v2 schemas separados.
15. **Logging:** structlog → stdout + Sentry free tier.
16. **CORS:** `allow_origins` por env var `ALLOWED_ORIGINS`, `allow_credentials=True`, cookie restringida a `/api/v1/auth/refresh`.
17. **Secretos:** Railway env vars + pydantic-settings.
18. **Borrado de archivos:** inmediato para CVs, diferido para logos/docs no sensibles.
19. **Hosting:** backend + DB en Railway (Hobby), frontend en Vercel (Hobby).
20. **Dominio:** `bbjobs.com.ar` (a comprar en NIC.ar), `api.bbjobs.com.ar` para backend.

---

## Pasos por delante

- **Plan de implementación por fases.** ✅ Creado en `docs/planning/implementacion/00-plan-fases.md` (20 fases con gates al usuario).
- **Sistema visual (paleta + logo + tipografía).** ✅ Creado en `docs/planning/implementacion/sistema-visual.md`.
- **Próxima sesión: arrancar por FASE 0 — Bootstrap del proyecto** (consultar decisiones previas + crear repo + estructura de carpetas).

---

## Reglas de trabajo en esta sesión (para mantener en la próxima)

- Cada paso del planeamiento se cierra en un `.md` versionable bajo `docs/planning/backend/`.
- En la terminal: conversación + resumen breve + path del archivo. **No volcar el detalle de cada paso a la terminal**.
- No avanzar al siguiente paso sin confirmación explícita del usuario.
- Para decisiones, presentar opciones con pros/contras; no decidir unilateralmente.
- Si una decisión tiene impacto en otra entidad/flujo, marcarlo.
- Si algo del contexto no está claro o falta definir, preguntar; no inventar.

---

## Archivos del planeamiento (estado actual)

```
docs/planning/
├── backend/
│   ├── 00-estado-planeamiento.md     ← este documento (handoff)
│   ├── 01-analisis-dominio.md
│   ├── 02-entidades.md
│   ├── 02a-decisiones-criticas.md
│   ├── 03-estados-transiciones.md
│   ├── 04-flujos-principales.md
│   ├── 05-endpoints.md
│   ├── 06-decisiones-tecnicas.md
│   └── 07-riesgos-dependencias.md
└── implementacion/
    ├── 00-plan-fases.md
    └── sistema-visual.md
```

---

*Última actualización: Pasos 6 y 7 cerrados + plan de implementación por fases creado. La próxima sesión arranca por FASE 0 del plan de implementación (`docs/planning/implementacion/00-plan-fases.md`).*
