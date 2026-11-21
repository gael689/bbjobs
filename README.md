# BBJobs

**El trabajo que buscás está en Bahía.** Portal de empleo local de Bahía Blanca y la zona, de
Talency: empresas verificadas a mano, postulantes de la región.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Estado actual y plan de lanzamiento | [`LANZAMIENTO-PLAN.md`](LANZAMIENTO-PLAN.md) |
| Qué probar a mano antes de lanzar | [`CHECKLIST-PRUEBAS-MANUALES.md`](CHECKLIST-PRUEBAS-MANUALES.md) |
| Guía para trabajar en el código | [`CLAUDE.md`](CLAUDE.md) |
| Diseño y reglas vigentes (seguridad, legal, deploy, IA, mails) | [`docs/referencia/`](docs/referencia/) |
| Lo entregado a Talency (PDF y HTML) | [`docs/eugenia/`](docs/eugenia/) |
| Planes viejos, ya cumplidos o reemplazados | [`docs/archivo/`](docs/archivo/) |
| Cambios por versión | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |

## Código

- `backend/`: API en FastAPI + SQLAlchemy + Alembic sobre PostgreSQL 18 con pgvector. Corre en
  Railway (`api.bbjobs.com.ar`).
- `frontend/`: Next.js 16 (App Router) + Tailwind v4. Corre en Vercel (`bbjobs.com.ar`).
- `infra/`: scripts y la zona DNS de Clerk.

Autenticación con Clerk, archivos en Cloudinary, pagos con Mercado Pago, mails con Resend e IA con
Gemini. Los módulos de mails, IA, Revisión de CV y prospección están detrás de la compuerta
`MODULOS_NUEVOS_ACTIVOS`.

## Desarrollo local

```bash
# Backend (Python ≥ 3.12)
cd backend && python -m venv .venv && .venv/bin/pip install -e .
.venv/bin/alembic upgrade head            # con DATABASE_URL y MIGRATIONS_DATABASE_URL locales
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm ci && npm run dev      # NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Tests del backend: ver la sección **Tests** de [`CLAUDE.md`](CLAUDE.md) (necesitan una base local
descartable; nunca la de producción).
