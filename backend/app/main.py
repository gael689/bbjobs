from contextlib import asynccontextmanager
import uuid
import time

import structlog
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.scheduler import start_scheduler
from app.core.limiter import limiter
from app.api.v1 import (
    health, companies, candidates, skills, catalogs,
    jobs, applications, tests, plans, subscriptions, payments, webhooks,
    admin, notifications, account, me, onboarding, contact,
)

setup_logging()
logger = structlog.get_logger("app")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
    )

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    logger.info("app_started", env=settings.ENV)
    yield
    logger.info("app_shutdown")


app = FastAPI(title="BBJobs API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    start = time.time()
    try:
        response = await call_next(request)
        logger.info(
            "request_completed",
            status_code=response.status_code,
            duration_ms=round((time.time() - start) * 1000, 2),
        )
        return response
    except Exception as exc:
        logger.error("request_failed", error=str(exc), duration_ms=round((time.time() - start) * 1000, 2))
        raise
    finally:
        structlog.contextvars.clear_contextvars()


app.include_router(health.router, prefix="/api/v1")
app.include_router(companies.router, prefix="/api/v1", tags=["companies"])
app.include_router(candidates.router, prefix="/api/v1", tags=["candidates"])
app.include_router(skills.router, prefix="/api/v1", tags=["skills"])
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
app.include_router(applications.router, prefix="/api/v1", tags=["applications"])
app.include_router(tests.router, prefix="/api/v1", tags=["tests"])
app.include_router(plans.router, prefix="/api/v1", tags=["plans"])
app.include_router(subscriptions.router, prefix="/api/v1", tags=["subscriptions"])
app.include_router(payments.router, prefix="/api/v1", tags=["payments"])
app.include_router(webhooks.router, prefix="/api/v1", tags=["webhooks"])
app.include_router(catalogs.router, prefix="/api/v1", tags=["catalogs"])
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])
app.include_router(notifications.router, prefix="/api/v1", tags=["notifications"])
app.include_router(account.router, prefix="/api/v1", tags=["account"])
app.include_router(me.router, prefix="/api/v1", tags=["me"])
app.include_router(onboarding.router, prefix="/api/v1", tags=["onboarding"])
app.include_router(contact.router, prefix="/api/v1", tags=["contact"])
