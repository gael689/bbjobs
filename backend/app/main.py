from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import structlog
import uuid
import time
import sentry_sdk
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1 import health, auth, companies, candidates, skills, jobs, applications, tests, plans, subscriptions, payments, webhooks
from app.core.scheduler import start_scheduler

setup_logging()
logger = structlog.get_logger("app")

# Sentry config
if hasattr(settings, "SENTRY_DSN") and settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

# SlowAPI config
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="BBJobs API",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.on_event("startup")
async def startup_event():
    start_scheduler()

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )
    
    start_time = time.time()
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            "request_completed",
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2)
        )
        return response
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            "request_failed",
            error=str(e),
            duration_ms=round(duration_ms, 2)
        )
        raise e
    finally:
        structlog.contextvars.clear_contextvars()

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
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
