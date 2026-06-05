from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import structlog
import uuid
import time
from app.core.config import settings
from app.core.logging import setup_logging
from app.api.v1 import health, auth

setup_logging()
logger = structlog.get_logger("app")

app = FastAPI(
    title="BBJobs API",
    version="0.1.0",
)

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
