# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

BBJobs is a local job portal for Bahía Blanca, Argentina, built for Talency (a local recruitment consultancy). It connects verified local companies with job seekers. Three roles: **admin** (Talency team), **empresa** (verified company), **candidato** (job seeker).

The backend (FastAPI + PostgreSQL) is fully planned in `docs/planning/` but not yet implemented. All current code is the **Next.js frontend** under `frontend/`.

## Frontend commands

All commands run from the `frontend/` directory:

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint
```

The frontend expects a backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).

## Important: Next.js version

Read `frontend/AGENTS.md` before writing any Next.js code. This is **Next.js 16** with breaking changes from prior versions — APIs and conventions differ from training data. Check `node_modules/next/dist/docs/` for the actual current API.

## Frontend architecture

```
frontend/src/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout: fonts, Header, Footer
│   ├── page.tsx                # Homepage (job listing, hero, sections)
│   ├── login/page.tsx
│   ├── register/page.tsx       # ?type=candidate or ?type=company
│   └── dashboard/
│       ├── candidate/page.tsx
│       └── company/page.tsx
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Fixed floating pill navbar, auth-aware
│   │   └── Footer.tsx
│   └── ui/
│       └── NeuralCanvas.tsx    # Animated canvas for hero background
├── lib/
│   └── api.ts                  # Axios instance with auth interceptors
└── store/
    └── auth.ts                 # Zustand store for auth state
```

**API client** (`src/lib/api.ts`): Axios instance with `withCredentials: true`. Access token is stored in memory (not localStorage) via `setAccessToken()`. On 401, automatically tries `POST /auth/refresh` (which reads the httpOnly cookie) and retries the original request.

**Auth state** (`src/store/auth.ts`): Zustand store holding `user` (id, email, role, is_verified) and `isAuthenticated`. Access token lives separately in the API module, not in Zustand.

**Auth flow**: Login → backend returns access token in JSON body + sets httpOnly refresh token cookie. Frontend stores access token in memory only. Refresh happens automatically via the axios interceptor.

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

## Backend plan (not yet implemented)

See `docs/planning/backend/00-estado-planeamiento.md` for the full technical decisions summary. Key decisions:

- **Stack**: FastAPI, PostgreSQL, SQLAlchemy 2.x, Pydantic v2, Alembic migrations
- **Auth**: HS256 JWT (30 min TTL) + refresh token table in DB with rotation
- **Storage**: Cloudflare R2 with presigned URLs (5–15 min)
- **Mail**: Resend + Jinja2 templates
- **Payments**: Mercado Pago (webhook is sole source of truth — frontend never triggers payment state changes)
- **Hosting**: Backend + DB on Railway, frontend on Vercel
- **Domain**: `bbjobs.com.ar` / `api.bbjobs.com.ar`

All API routes are under `/api/v1`. Full endpoint list in `docs/planning/backend/05-endpoints.md`.

## Phase 1 scope

Only the first-use flow is in scope for Phase 1: verified company registration, job posting, candidate profiles, 1-click applications, psychometric tests (responses stored, no AI interpretation), featured job payments via Mercado Pago, and the public Observatorio Laboral with basic aggregated data.

AI matching (Gemini), internal messaging, and advanced notifications are **Phase 2** — documented in `contexto_bbjobs.md` but not to be implemented now.
