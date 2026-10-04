# Pendientes BBJobs — mails, IA, Revisión de CV, prospección (al 04/10/2026)

Lista única de lo que falta, por quién. El detalle técnico de cada paso está en
`MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md` §10 ("Pasos que restan", A–F); acá va el estado real.
Todo vive en `feat/mails-ia`, detrás de `MODULOS_NUEVOS_ACTIVOS` (en producción no se ve nada).

## Ya hecho y verificado

- Suite completa contra Postgres local con pgvector: **341 tests OK**.
- Producción en `a7c3e9d2f514` (el fix del historial de estados corrió).
- IA con **Gemini real** (datos sintéticos): 6 de 6 candidatos evaluados, USD 0,0048 por búsqueda.
- **CVs reales** (sólo lectura, sin IA): 50 CVs, **cero fugas** de nombre, teléfono o mail después
  de corregir la redacción (acentos, "de los", referencias de terceros).
- **Paneles con sesión iniciada** en local (empresa, postulante, admin): 12 pantallas sin errores;
  recomendados funcionando con Gemini.
- **Centro**: módulo "Pasar a BBJobs" commiteado (`17acb47`) y `config.json` configurado
  (7.353 leads, 1.519 con mail).
- Mails con la marca de BBJobs (logo, BB celeste + JOBS oscuro, naranja pastel) y PDF para
  Eugenia: `AVISOS-AUTOMATICOS-EUGENIA.pdf`.

## Gael

1. **Mandarle a Eugenia** `AVISOS-AUTOMATICOS-EUGENIA.pdf`, `VIERON-TU-CV-Y-NOTAS-EUGENIA.pdf` y
   `NOVEDADES-BBJOBS-OCTUBRE-2026.pdf` (resumen informativo de lo hecho).
2. **Centro → push**: `main` está 2 commits adelante (tu Plenia + el módulo BBJobs).
3. **Railway (cuenta de BBJobs)**: la CLI está logueada con Plenia. Con la de BBJobs, desde `centro\`:
   `python -c "import json;print(json.load(open('config.json'))['bbjobs_sync_secret'])" | railway variable set LEADGEN_SYNC_SECRET --stdin --skip-deploys`
4. **Probar vos los paneles** (cuando quieras). Base local en el puerto 5544 (`bbjobs_e2e`):
   - Backend, desde `backend\` (PowerShell), pisando **las dos** URLs (alembic usa `MIGRATIONS_DATABASE_URL`, que en `.env` apunta a producción):
     ```powershell
     $env:DATABASE_URL="postgresql+asyncpg://postgres@127.0.0.1:5544/bbjobs_e2e"; $env:MIGRATIONS_DATABASE_URL=$env:DATABASE_URL
     $env:MODULOS_NUEVOS_ACTIVOS="true"; $env:EMAIL_MODE="simulate"; $env:GEMINI_API_KEY="<tu clave>"
     .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
     ```
   - Frontend, desde `frontend\`: `$env:NEXT_PUBLIC_API_URL="http://localhost:8000/api/v1"; $env:NEXT_PUBLIC_MODULOS_NUEVOS="true"; npm run dev`
   - Usuarios (clave `PruebaBBJobs-2026!`, código 424242 si lo pide):
     `bbjobs-prueba-empresa+clerk_test@example.com`, `bbjobs-prueba-candidata+clerk_test@example.com`,
     `bbjobs-prueba-admin+clerk_test@example.com`.
   - La base 5544 vive en el scratchpad de la sesión: si se borró, se rearma con
     `backend/scripts/probar_local_pgvector_y_fix.ps1` + `scripts/simulacro_local.py`.
5. **Falta probar a mano** (paso A.3): Revisión de CV con Mercado Pago sandbox y una sincronización
   real desde el centro contra un backend local.
6. **Legal** (D.12): términos y privacidad (IA orientativa, CV anonimizado, subprocesadores Resend y
   Google, Revisión de CV por fuera, bajas, consentimiento de novedades).
7. **Cuentas y DNS — lo último** (E.13–16): Resend avisos + **otra cuenta** para prospección,
   dominios `avisos.`, `novedades.`, `contacto.bbjobs.com.ar`, webhooks, Gemini con facturación y
   tope, variables en Railway.
8. **Lanzamiento** (F.17–20): merge a `main`, prender la compuerta en Railway y Vercel, prender
   módulos en orden desde "Mails e IA", calentamiento de envíos.

## Eugenia

1. Validar el PDF de avisos: cuáles van, horario (8–21), tope (2 por día), remitente, demora de
   "No avanzó" (24 h).
2. **Notas de la empresa**: que arranquen privadas; si Talency puede leer las privadas.
3. **Revisión de CV**: qué incluye, plazo y textos (precio ya definido: ARS 12.000).
4. **Etiquetar 3 búsquedas reales** (`scripts/evaluacion_rag.py exportar`): calibra el orden de los
   recomendados. Hoy, con datos de prueba, dos candidatos que cumplen un excluyente cada uno quedan
   separados por la parte semántica, que varía entre corridas.
5. Rubros y zonas a prospectar, servicios a ofrecer y textos de campañas.

## Claude — próxima sesión (prompt listo en `PROXIMA-SESION-PROMPT.md`)

1. **Construir "Vieron tu CV" y las notas privadas/visibles** — plan en
   `AVISOS-POR-ACCION-Y-NOTAS-PLAN.md`. Se puede arrancar con las propuestas y ajustar con lo que
   decida Eugenia.
2. Calibrar los pesos con el etiquetado de Eugenia.
3. Limpieza: borrar los 3 usuarios de prueba de Clerk (es la misma instancia de test que usa
   producción: podrían entrar a bbjobs.com.ar y caer en el alta de perfil) y apagar el Postgres
   local del puerto 5544.
