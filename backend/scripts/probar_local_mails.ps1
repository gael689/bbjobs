# Prueba local (NUNCA contra producción) del módulo de mails:
#   1. migraciones completas en una base descartable (incluye pgvector),
#   2. los tests de integración de la cola de mails (TEST_DATABASE_URL),
#   3. la migración de mails ida y vuelta.
# Borra la base al final, aunque algo falle. Correr en una ventana de PowerShell aparte:
#   powershell -ExecutionPolicy Bypass -File .\scripts\probar_local_mails.ps1
$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$backend = Split-Path -Parent $PSScriptRoot
$py = Join-Path $backend ".venv\Scripts\python.exe"
$db = "bbjobs_scratch_mails"

$sec = Read-Host "Contraseña del usuario postgres LOCAL" -AsSecureString
$pw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$env:PGPASSWORD = $pw

function Q($base, $sql) { & $psql -w -h localhost -U postgres -d $base -v ON_ERROR_STOP=1 -tAc $sql }
function Native([string]$label) {
    # Corre el bloque que sigue sin que PowerShell 5.1 trate el stderr como error fatal.
    if ($LASTEXITCODE -ne 0) { throw "$label falló (código $LASTEXITCODE)" }
}

$ok = $false
try {
    Write-Host "`n== 1. Base descartable $db"
    Q "postgres" "DROP DATABASE IF EXISTS $db WITH (FORCE)" | Out-Null
    Q "postgres" "CREATE DATABASE $db" | Out-Null

    $url = "postgresql+asyncpg://postgres:$([uri]::EscapeDataString($pw))@localhost:5432/$db"
    # alembic/env.py pasa la URL por configparser, que interpreta '%': se duplica sólo ahí.
    $env:DATABASE_URL = $url; $env:MIGRATIONS_DATABASE_URL = $url.Replace("%", "%%")
    $env:TEST_DATABASE_URL = $url; $env:SECRET_KEY = "x"
    Push-Location $backend
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"

    Write-Host "== 2. Migraciones hasta head"
    & $py -m alembic upgrade head; Native "alembic upgrade head"

    Write-Host "== 3. Tests (incluye los de integración con la base)"
    & $py -m pytest -q -p no:warnings; Native "pytest"

    Write-Host "== 4. Migración de mails ida y vuelta"
    & $py -m alembic downgrade a7c3e9d2f514; Native "alembic downgrade"
    & $py -m alembic upgrade head; Native "alembic upgrade (vuelta)"
    & $py -m alembic current

    $ErrorActionPreference = $prev
    $ok = $true
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    Q "postgres" "DROP DATABASE IF EXISTS $db WITH (FORCE)" | Out-Null
    Remove-Item Env:PGPASSWORD, Env:DATABASE_URL, Env:MIGRATIONS_DATABASE_URL, Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
    Write-Host "(base descartable borrada)"
    if ($ok) { Write-Host "`nRESULTADO: OK" -ForegroundColor Green } else { Write-Host "`nRESULTADO: FALLO" -ForegroundColor Red }
}
