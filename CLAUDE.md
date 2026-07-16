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
There's no `requirements.txt` — `pyproject.toml` is the sole dependency source (`pip install .`). No test suite exists yet (`backend/tests/` is empty, `pytest` isn't even a dependency).

**Full stack via Docker**: root `docker-compose.yml` runs `backend` + `postgres:16-alpine`. The frontend is not containerized — run it separately with `npm run dev`.

The frontend expects a backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

## Important: Next.js version

Read `frontend/AGENTS.md` before writing any Next.js code. This is **Next.js 16** with breaking changes from prior versions — APIs and conventions differ from training data. Check `node_modules/next/dist/docs/` for the actual current API.

## Backend architecture

- **Auth is entirely Clerk-based** — there is no local login/JWT-issuing router. `app/api/deps.py` verifies the Clerk session JWT (`clerk-backend-api`, cached JWKS) via `HTTPBearer`, then looks up the local `User` row by `clerk_user_id`. A request for a Clerk-authenticated user with no local `User` yet gets `403 onboarding_required` — the frontend then calls `POST /me/onboarding/candidate` or `/me/onboarding/company` to JIT-provision the row. `POST /webhooks/clerk` (svix-verified) only handles `user.deleted`/`user.updated` reconciliation, not provisioning.
- **No Postgres RLS is actually enforced** — `app/db/rls.py` sets `SET LOCAL app.current_user_id` / `app.user_role` per request, but no migration ever runs `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` (verified by grepping `backend/alembic/`), so those session variables are read by nothing. Data isolation today is 100% application-layer: every query in every endpoint filters explicitly by `company_id`/`candidate_id`. The app also connects to Postgres as a superuser (`postgres`), which would bypass RLS anyway even if policies existed — see `SEGURIDAD-PLAN.md` bloque E/F for the plan to fix both (a least-privilege DB role, then real RLS policies on top of it). Don't assume DB-level isolation exists; if you add a new query, the app-layer filter is the only thing protecting it.
- **Routers** (`app/api/v1/`, all mounted at `/api/v1` with no further prefix — each file hardcodes its own paths): `health`, `companies`, `candidates`, `skills`, `jobs`, `applications`, `tests`, `plans`, `subscriptions`, `payments`, `webhooks`, `catalogs`, `admin`, `notifications`, `account`, `me`, `onboarding`, `contact`.
- **Integrations** (`app/integrations/`): `clerk_client.py` (auth + backend-API user management), `cloudinary_client.py` (CV PDFs and company logos — replaced an earlier Cloudflare R2 plan), `mercado_pago.py` (featured-job payment preferences; webhook is the sole source of truth for payment state, frontend never sets it directly).
- **No email provider is currently wired up.** A previous Resend-based mailer (`services/email.py`, `integrations/resend_client.py`) was removed and nothing replaced it. Don't assume email verification/notification-by-email works — `.env.example` and some root docs still reference `RESEND_API_KEY` but no code consumes it.
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

`FASE1-BBJOBS-REPASO.md` (root) is the most up-to-date status document — it's what's used to brief the client (Eugenia) and reflects what's actually built. Prefer it over `docs/planning/`, `ESTADO.md`, and `README.md`, which describe an earlier design (custom JWT auth, Resend email, R2 storage) that has since been replaced by Clerk + Cloudinary and partially contradicts the real code.

Built and working: candidate registration/profile/CV upload/1-click applications, company registration with mandatory manual verification, job posting and public search with filters (rubro, zona, modalidad, contract type, salary range), admin panel (approve/suspend companies, take down jobs, approve suggested skills, create admins, metrics), in-app notifications, public company profiles, contact forms. Psychometric tests store responses but have no UI yet (by design, see below).

Remaining for Phase 1 close-out: Mercado Pago integration for featured-job payments (the biggest remaining item — models/webhook scaffolding exist but the flow isn't wired end-to-end), SEO/GEO, Google Business Profile listing, production deploy (currently local-only, no Railway/Vercel config checked in), and moving Clerk out of test mode.

Explicitly out of scope for Phase 1 (deferred to Phase 2): AI-based candidate matching, interpreted psychometric test results, internal company↔candidate messaging, and the public Observatorio Laboral.
