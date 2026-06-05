FROM python:3.12-slim

WORKDIR /app

# Actualizamos pip
RUN pip install --upgrade pip

# Copiamos archivos de dependencias
COPY pyproject.toml .

# Instalamos dependencias directamente
RUN pip install --no-cache-dir .

# Copiamos el resto del codigo de la app
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
