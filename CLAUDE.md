# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BBJobs is a local job portal for Bahía Blanca, Argentina, built for Talency (a local recruitment consultancy). It connects verified local companies with job seekers. Three roles: **admin** (Talency team), **empresa** (verified company), **candidato** (job seeker).

Both the FastAPI backend (`backend/`) and the Next.js frontend (`frontend/`) are implemented and functional. The backend is not "planned" — it's a working API with Alembic migrations, Clerk-based auth, and ~18 route modules. Phase 1 is close to done; see "Current status" below before trusting older planning docs.

## Commands

**Frontend** (from `frontend/`):
```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint
```

**Backend** (from `backend/`):
```bash
uvicorn app.main:app --reload --port 8000   # Dev server
alembic upgrade head                         # Apply migrations
alembic revision --autogenerate -m "..."     # New migration (models import via app.models in alembic/env.py)
python seed.py                               # Seed catalogs/demo data
```
There's no `requirements.txt` — `pyproject.toml` is the sole dependency source (`pip install .`; Python ≥ 3.12).

**Tests** (~800, `backend/tests/`): pure ones run anywhere; the `*_db.py` ones need `TEST_DATABASE_URL` pointing at a **throwaway local** Postgres 18 with pgvector (`tests/conftest.py` aborts if the host isn't local, and empties the catalog tables at session start). Example on macOS:
```bash
initdb -D /tmp/pg -U postgres --auth=trust && pg_ctl -D /tmp/pg -o "-p 5544" start
createdb -h 127.0.0.1 -p 5544 -U postgres bbjobs_e2e && psql -h 127.0.0.1 -p 5544 -U postgres -d bbjobs_e2e -c "CREATE EXTENSION vector"
export DATABASE_URL=postgresql+asyncpg://postgres@127.0.0.1:5544/bbjobs_e2e MIGRATIONS_DATABASE_URL=$DATABASE_URL TEST_DATABASE_URL=$DATABASE_URL SECRET_KEY=x
alembic upgrade head && pytest -q
```
Override **both** `DATABASE_URL` and `MIGRATIONS_DATABASE_URL` (alembic reads the latter). Read pytest's own summary line — piping it through `tail`/`uniq` inside an `&&` chain has hidden failures before. `scripts/simulacro_local.py` runs the whole AI + mail flow on synthetic data (refuses non-local DBs; with `GEMINI_API_KEY` it calls real Gemini).

**Full stack via Docker**: root `docker-compose.yml` runs `backend` + `postgres:16-alpine`. The frontend is not containerized — run it separately with `npm run dev`.

The frontend expects a backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

## Important: Next.js version

Read `frontend/AGENTS.md` before writing any Next.js code. This is **Next.js 16** with breaking changes from prior versions — APIs and conventions differ from training data. Check `node_modules/next/dist/docs/` for the actual current API.

## Backend architecture

- **Auth is entirely Clerk-based** — there is no local login/JWT-issuing router. `app/api/deps.py` verifies the Clerk session JWT (`clerk-backend-api`, cached JWKS) via `HTTPBearer`, then looks up the local `User` row by `clerk_user_id`. A request for a Clerk-authenticated user with no local `User` yet gets `403 onboarding_required` — the frontend then calls `POST /me/onboarding/candidate` or `/me/onboarding/company` to JIT-provision the row. `POST /webhooks/clerk` (svix-verified) only handles `user.deleted`/`user.updated` reconciliation, not provisioning.
- **No Postgres RLS is actually enforced** — `app/db/rls.py` sets `SET LOCAL app.current_user_id` / `app.user_role` per request, but no migration ever runs `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` (verified by grepping `backend/alembic/`), so those session variables are read by nothing. Data isolation today is 100% application-layer: every query in every endpoint filters explicitly by `company_id`/`candidate_id`. The app also connects to Postgres as a superuser (`postgres`), which would bypass RLS anyway even if policies existed — see `docs/referencia/SEGURIDAD-PLAN.md` bloque E/F for the plan to fix both (a least-privilege DB role, then real RLS policies on top of it). Don't assume DB-level isolation exists; if you add a new query, the app-layer filter is the only thing protecting it.
- **Routers** (`app/api/v1/`, all mounted at `/api/v1` with no further prefix — each file hardcodes its own paths): `health`, `companies`, `candidates`, `skills`, `jobs`, `applications`, `tests`, `plans`, `subscriptions`, `payments`, `webhooks`, `catalogs`, `admin`, `notifications`, `account`, `me`, `onboarding`, `contact`.
- **Integrations** (`app/integrations/`): `clerk_client.py` (auth + backend-API user management), `cloudinary_client.py` (CV PDFs and company logos — replaced an earlier Cloudflare R2 plan), `mercado_pago.py` (featured-job payment preferences; webhook is the sole source of truth for payment state, frontend never sets it directly).
- **New modules gate (`app/core/features.py`):** everything below about email, AI, CV review, prospects and campaigns lives behind the env var `MODULOS_NUEVOS_ACTIVOS` (false in production → their routes 404, their switches are hidden from `/admin/settings`, no scheduler jobs). Never use a `site_settings` switch as the gate (Eugenia toggles those). Frontend: admin shows them with an "En desarrollo" badge; candidate/company nav only when `NEXT_PUBLIC_MODULOS_NUEVOS=true`. Bugfixes ship normally. Status table in `docs/referencia/MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md` §10; launch status in `LANZAMIENTO-PLAN.md`. Integration tests need a throwaway local Postgres with pgvector: `backend/scripts/probar_local_mails.ps1` (sets `TEST_DATABASE_URL`; never point tests at `backend/.env`, which is production).
- **Email (Resend) and AI (Gemini) — built, merged in `main`, gated, not launched.** Code: outbox + policy + dispatcher + digests + campaigns + inbound replies (`services/email/inbox.py`, Resend `email.received`, no attachments stored) + prospecting mailboxes with per-mailbox brakes (`services/email/mailboxes.py`) in `services/email/`; RAG and agents in `services/ai/`; prospects in `services/prospects.py`; admin screens under `/dashboard/admin/mails` (API `app/api/v1/admin_mail.py`). Rules source: `docs/referencia/MODULOS-MAILS-IA-PLAN.md` + v4. One Resend Pro account for everything, prospecting included (user decision 2026-11-20, despite Resend's cold-email policy — don't re-raise it); the account health brake (`digests.email_health`, Resend's 4 % / 0.08 %) pauses novedades, recordatorios and prospecting; only hard bounces suppress. The Gemini client (`integrations/gemini_client.py`) is on `google-genai` + Interactions API with `store=False`, **pinned to `api_version="v1beta"`** (newer SDKs default to the stable API and reject `labels` with 400 on every text call) and the Revisor model uses `GEMINI_REVIEW_THINKING_LEVEL` (`gemini-3.8-flash` rejects `minimal`). Free text that isn't a CV (job ads, search phrases) goes through `redact.scrub_contacto` before Gemini. Shadow mode: `ia_recomendaciones_visibles` (off = AI computes, only admins see it; companies get no recs, counts or notices). Load the `gemini-api-dev` skill before touching Gemini code and `resend` / `email-best-practices` before mail code.
- **AI agents (15/11/2026, `docs/referencia/IA-AGENTES-PLAN.md`):** every Gemini task is a named agent registered in `app/services/ai/agentes.py` (what it does, model, switch, `ai_usage_log` features), shown read-only in admin → Centro de IA → Agentes (`GET /admin/ai/agents`). Each agent's system prompt lives in `backend/app/agentes/<clave>.md` and its version is `<clave>@<sha8>`: edit the `.md`, never a `SYSTEM` string in code — a changed text invalidates that agent's cache by itself. The old rerank is split: **Evaluador** (flash-lite) returns only verdict + fragment id; the code picks the quote (`rerank.pick_evidence`) and builds the reasons; **Revisor** (`GEMINI_REVIEW_MODEL`, flash) re-evaluates only scores in `pipeline.REVIEW_MIN..REVIEW_MAX` (60–79). Prices live in `app/services/ai/precios.py` (dated tiers: `gemini-3.8-flash` doubles on 1/1/2027); each agent's code-side work and estimated cost are in `agentes.CODIGO`/`TOKENS_TIPICOS`. Eugenia's preview tab «Agentes de IA» is generated by `scripts/generar_vista_agentes.py` — re-run it when an agent or price changes. Stays on Gemini (the privacy policy names Google as the only AI processor).
- `app/repositories/`, `app/tasks/`, `app/deps/` exist as empty scaffolding — unused, don't build on them without checking first.

## Frontend architecture

```
frontend/src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout: fonts, Header, Footer, ClerkProvider
│   ├── page.tsx                  # Homepage (job listing, hero, sections)
│   ├── login/[[...rest]]/        # Clerk catch-all sign-in route
│   ├── register/[[...rest]]/     # Clerk catch-all sign-up route
│   ├── onboarding/                # Post-signup profile completion (candidate/company)
│   ├── empleos/, empleos/[id]/   # Public job search + detail
│   ├── empresas/, empresas/[id]/ # Public company showcase + profile
│   ├── contacto/                  # Public contact form
│   └── dashboard/
│       ├── candidate/            # perfil, empleos, postulaciones
│       ├── company/              # perfil, publicar, postulaciones, estadisticas
│       └── admin/                # empresas, candidatos, busquedas, skills, mensajes, estadisticas, nuevo-admin
├── components/                    # auth/, contact/, dashboard/, jobs/, layout/, notifications/, ui/
└── lib/api.ts                     # Axios instance, Clerk-token-driven
```

**API client** (`src/lib/api.ts`): plain axios instance (`baseURL` = `NEXT_PUBLIC_API_URL`). No cookie-based refresh flow — it exposes `setTokenGetter(fn)`, wired by a `ClerkTokenSync` component to Clerk's `getToken()`, and a request interceptor attaches `Authorization: Bearer <token>` per call. Session/refresh is entirely Clerk's responsibility client-side.

**Auth state**: no Zustand auth store — `src/store/` doesn't exist. Use Clerk's own hooks (`useAuth`, `useUser`) directly. `zustand` is still in `package.json` but is otherwise unused; don't add new state there without checking it's actually needed.

## Design system

Fonts: **Plus Jakarta Sans** (`font-display`) for headings, **DM Sans** (`font-sans`) for body. Defined in `app/layout.tsx` and as CSS variables in `globals.css`.

Color palette (use these hex values inline with Tailwind — the project uses Tailwind v4 `@theme` rather than HSL CSS vars):

| Token | Hex | Use |
|-------|-----|-----|
| Primary (teal) | `#1E8EA3` | CTAs, links, logo, active states |
| Primary hover | `#187B8E` | Hover on primary elements |
| Primary light | `#E6F4F7` | Accent backgrounds, hover fills |
| Primary mid | `#9ED4DF` | Borders on accent areas |
| Secondary (orange pastel) | `#D4B7A2` | Badges, "featured" labels, decorative accents |
| Background | `#FAFBFD` | Page background |
| Surface | `#FFFFFF` | Cards, modals |
| Text | `#1C2230` | Primary text (never pure black) |
| Text muted | `#64748B` | Secondary text, captions |
| Border | `#DDE3EC` | General borders, inputs |

State badges: `pending` → yellow-100/yellow-900; `active/published` → primary/accent; `paused` → muted; `closed` → secondary; `discarded` → destructive/10 + destructive text; `featured` → secondary with subtle border.

## Current status & Phase 1 scope

**`LANZAMIENTO-PLAN.md` (root) is the current status and launch plan** (phases, decisions, what's verified in production) and **`CHECKLIST-PRUEBAS-MANUALES.md` (root) is the manual QA list before launch.** Docs layout: `docs/referencia/` = still-valid design and rules (security, legal, deploy, AI/mail rules); `docs/eugenia/` = PDFs/HTML delivered to the client; `docs/archivo/` = finished or superseded plans (including the old `docs/planning/`, `FASE1-BBJOBS-REPASO.md` and `ESTADO.md`, which describe an earlier design — custom JWT, R2 — that contradicts the real code). Don't add new plan files to the root: put them in `docs/` and link them from `LANZAMIENTO-PLAN.md`.

Built and working: candidate registration/profile/CV upload/1-click applications, company registration with mandatory manual verification, job posting and public search with filters (rubro, zona, modalidad, contract type, salary range), admin panel (approve/suspend companies, take down jobs, approve suggested skills, create admins, metrics), in-app notifications, public company profiles, contact forms. Psychometric tests store responses but have no UI yet (by design, see below).

Remaining for Phase 1 close-out: Mercado Pago integration for featured-job payments (the biggest remaining item — models/webhook scaffolding exist but the flow isn't wired end-to-end), SEO/GEO, Google Business Profile listing, production deploy (currently local-only, no Railway/Vercel config checked in), and moving Clerk out of test mode.

Explicitly out of scope for Phase 1 (deferred to Phase 2): AI-based candidate matching, interpreted psychometric test results, internal company↔candidate messaging, and the public Observatorio Laboral.

**Next modules (planned 01/10/2026, see `docs/referencia/MODULOS-MAILS-IA-PLAN.md`; client brief in `docs/eugenia/BBJOBS-PROXIMOS-MODULOS-EUGENIA.pdf`):** automatic emails + job alerts + campaigns via Resend (own outbox queue, not Resend Broadcasts), and AI-recommended candidates via a hybrid RAG on Gemini (structured scoring first, embeddings second, LLM rerank with cited evidence last; CV text extracted and anonymized locally before anything leaves the server; age/gender never used). The psychometric module is paused until Talency provides material. **v4 (04/10/2026) in `docs/referencia/MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md`** adds the business rules (notification matrix, automation levels, send policy R1–R15), confirms Gemini, makes Resend the last step (build against a simulated provider first), and adds a paid **CV Review** product for candidates (Mercado Pago → Eugenia is notified → she contacts them outside the platform; the platform only charges and records, no AI involved). Note `payments.company_id` is NOT NULL today, so that product needs a migration making payments company-or-candidate. **`docs/referencia/AUDITORIA-RAG-Y-MODULOS-2026-10-04.md` overrides both plans where they differ** (measured against real data): `gemini-embedding-001` with per-section chunks (≤12 per candidate, matched per job requirement), pgvector (enabled on Railway's Postgres 18.6 — verified 2026-11-20; locally use Postgres 18 + brew `pgvector`), one candidate per rerank call, hybrid-only at night, zone as a score factor, soft skills weigh 0, Secure External Ingestion level B for CVs. Hard rules from the plan: AI never sends emails or changes application state on its own; every new table holding personal data must be added to `services/account_deletion.py`; every new company-facing query filters by `company_id` and needs a cross-tenant test.
