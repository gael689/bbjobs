from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str

    DATABASE_URL: str
    # Rol de mínimo privilegio para runtime (sin DDL). Alembic necesita CREATE TABLE/ALTER TABLE,
    # que ese rol no tiene — las migraciones corren con esta URL separada (rol con privilegios de
    # owner/DDL) en vez de DATABASE_URL. Si no está seteada, cae a DATABASE_URL (mismo rol para
    # todo) — no rompe nada para quien no haya hecho el split todavía.
    MIGRATIONS_DATABASE_URL: str | None = None

    @field_validator("DATABASE_URL", "MIGRATIONS_DATABASE_URL")
    @classmethod
    def _use_asyncpg_scheme(cls, v: str | None) -> str | None:
        # Railway (y Heroku antes) autogeneran DATABASE_URL con scheme `postgres://` o
        # `postgresql://` — ninguno de los dos es válido para create_async_engine, que necesita
        # `postgresql+asyncpg://`. Sin esto, copiar la URL autogenerada tal cual rompe el arranque.
        if v and v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v and v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    ALLOWED_ORIGINS: str = "http://localhost:3000"
    # Para armar back_urls de Mercado Pago (adónde vuelve el usuario tras el checkout).
    FRONTEND_URL: str = "http://localhost:3000"

    # Clerk (auth provider — ver docs/planning/backend/09-migracion-clerk-auth.md)
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_AUTHORIZED_PARTIES: str = "http://localhost:3000"

    SENTRY_DSN: str | None = None

    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None
    
    # Precios de prueba. Sirven para hacer un cobro real de monto bajo sin tocar el código:
    # se cargan como variable en Railway, se prueba, y para volver al precio de verdad se
    # **borra la variable**. Antes esto obligaba a editar la constante en el backend y sus dos
    # espejos del frontend, deployar, y acordarse de revertir los tres — y si se revertía mal,
    # la empresa veía un precio y se le cobraba otro.
    # Dejar en None en operación normal.
    TALENT_PACK_PRICE: float | None = None
    FEATURED_JOB_PRICE: float | None = None

    # A dónde le decimos a Mercado Pago que mande los avisos de pago. Se manda en CADA
    # preferencia; si queda vacía, MP usa lo que esté configurado en el panel (o nada).
    # En Railway se deduce sola de RAILWAY_PUBLIC_DOMAIN — está sólo para poder pisarla.
    MP_NOTIFICATION_URL: str | None = None
    RAILWAY_PUBLIC_DOMAIN: str | None = None
    # URL pública del backend con el prefijo /api/v1 — se usa en los links de baja de los mails.
    API_PUBLIC_URL: str | None = None

    MP_ACCESS_TOKEN: str | None = None
    MP_PUBLIC_KEY: str | None = None
    MP_WEBHOOK_SECRET: str | None = None

    # Compuerta de los módulos en desarrollo (mails, IA, Revisión de CV): ver core/features.py.
    # Apagada por defecto; en producción NO se prende hasta el lanzamiento. En local, `true`
    # para desarrollar y probar.
    MODULOS_NUEVOS_ACTIVOS: bool = False

    # Mails — Resend. Sin RESEND_API_KEY el sistema funciona igual que antes: los mails se
    # marcan `skipped` en la cola en vez de quedar pendientes (ver MODULOS-MAILS-IA-PLAN.md §3).
    RESEND_API_KEY: str | None = None
    # El dominio del remitente tiene que estar verificado en Resend (SPF/DKIM) o los mails caen
    # en spam o directamente se rechazan.
    RESEND_FROM_EMAIL: str = "BBJobs <avisos@bbjobs.com.ar>"
    RESEND_REPLY_TO: str | None = None
    # Secret de svix (empieza con `whsec_`) del webhook de eventos de Resend.
    RESEND_WEBHOOK_SECRET: str | None = None
    # auto | off | simulate | resend — ver services/email/provider.py. `auto` = resend si hay
    # key, off si no. `simulate` se elige a mano (desarrollo, vista previa para Eugenia).
    EMAIL_MODE: str = "auto"
    # Tope de mails por día (día de Argentina) para el calentamiento del dominio (v3 M3): un
    # dominio nuevo arranca en ~150/día. Se sube a mano semana a semana; 0 = sin tope. Los de la
    # categoría `cuenta` (pagos, verificación) salen aunque se haya llegado al tope.
    EMAIL_DAILY_CAP: int = 150

    # IA — Gemini. Los nombres de modelo son variables y no constantes a propósito: Google los
    # rota, y de esa manera cambiarlos no necesita un deploy de código.
    GEMINI_API_KEY: str | None = None
    # `gemini-2.5-*` quedó legado. 3.5 Flash-Lite: el de menor costo de la familia actual
    # (USD 0,30 entrada / 2,50 salida por millón, verificado el 04/10/2026).
    GEMINI_GENERATION_MODEL: str = "gemini-3.5-flash-lite"
    # `-001` y no `-2` por precio (auditoría P11). Se apaga el 14/05/2028; los vectores de uno y
    # otro no son comparables, así que cambiarlo obliga a reindexar todo.
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    # Reproducibilidad del rerank (auditoría R17): misma semilla y pensamiento mínimo.
    GEMINI_THINKING_LEVEL: str = "minimal"
    GEMINI_SEED: int = 20261004
    # El modelo de embeddings permite truncar la dimensión. 768 pesa 4 veces menos que los 3072
    # nativos con una pérdida de calidad que no se nota para ranking de perfiles.
    GEMINI_EMBEDDING_DIM: int = 768
    # Techos duros por corrida de las tareas programadas: si un bug las mete en un bucle, esto
    # es lo que evita que se coman el presupuesto de la cuenta de Google.
    AI_MAX_EMBEDDINGS_PER_RUN: int = 500
    AI_MAX_RERANKS_PER_RUN: int = 50
    # Cuántos candidatos de la Base de Talento (que no se postularon) ve una empresa en las
    # recomendaciones. El resto se muestra tapado, como incentivo al pack de créditos.
    RECS_TALENT_FREE_COUNT: int = 3

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def migrations_database_url(self) -> str:
        return self.MIGRATIONS_DATABASE_URL or self.DATABASE_URL

    @property
    def public_api_base_url(self) -> str:
        """Dónde nos pueden llamar desde afuera (links de baja de un click, webhooks). En Railway
        sale sola del dominio público; en local cae a localhost."""
        if self.API_PUBLIC_URL:
            return self.API_PUBLIC_URL.rstrip("/")
        if self.RAILWAY_PUBLIC_DOMAIN:
            return f"https://{self.RAILWAY_PUBLIC_DOMAIN}/api/v1"
        return "http://localhost:8000/api/v1"

    @property
    def email_provider_configured(self) -> bool:
        return bool(self.RESEND_API_KEY)

    @property
    def ai_provider_configured(self) -> bool:
        return bool(self.GEMINI_API_KEY)

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def clerk_authorized_parties(self) -> List[str]:
        return [party.strip() for party in self.CLERK_AUTHORIZED_PARTIES.split(",")]

settings = Settings()
