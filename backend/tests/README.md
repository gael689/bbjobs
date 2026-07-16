# Tests

## Correrlos

```bash
pip install ".[dev]"
pytest
```

No hace falta ninguna base de datos ni variables de entorno — todo lo que hay hoy son tests
unitarios sobre funciones puras (`app/services/profile_completion.py`,
`app/services/job_status.py`, `app/services/applicant_stats.py`, `app/schemas/candidate.py`).
Corren en menos de un segundo y no tocan la base de Railway para nada.

## Qué cubren

- **`test_job_status.py`** — la máquina de estados de una búsqueda (activa → pausada → cerrada,
  etc.). Incluye un test explícito de regresión del bug real donde comparar `str(Enum)` en vez
  del `Enum` hacía que ninguna transición funcionara nunca.
- **`test_profile_completion.py`** — el cálculo de "% de perfil completo" y el throttle del
  recordatorio semanal (no debe repetirse antes de 7 días).
- **`test_applicant_stats.py`** — años de experiencia, nivel educativo más alto y cálculo de
  edad, usados en las estadísticas de postulantes.
- **`test_candidate_schemas.py`** — el cálculo de edad expuesto en la respuesta de la API
  (existe una segunda copia en `applicant_stats.py` a propósito, desacoplada; este test
  garantiza que ambas sigan dando el mismo resultado).

## Qué falta (a propósito, no es un olvido)

Todavía no hay tests de los endpoints (FastAPI `TestClient` contra la base real) — eso requiere
una base de test separada. El backend de desarrollo hoy apunta directo a la base de Railway
compartida (`DATABASE_URL` en `.env`), así que un test que haga `INSERT`/`DELETE` ahí sería
riesgoso. El camino correcto cuando se priorice:

1. Crear una base nueva en el mismo proyecto de Railway (`CREATE DATABASE bbjobs_test;`) — no
   toca la base real, es un paso aislado.
2. Correr `alembic upgrade head` contra esa base.
3. Un fixture de `pytest` que abra una transacción por test y haga rollback al final (o trunquee
   las tablas entre tests), apuntando a `TEST_DATABASE_URL` en vez de `DATABASE_URL`.

No se hizo en esta pasada porque implica correr DDL (`CREATE DATABASE`) contra la instancia real
de Railway — mejor confirmarlo antes que hacerlo por mi cuenta.
