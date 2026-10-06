# Prueba local (NUNCA contra producción): pgvector + migración a7c3e9d2f514 ida y vuelta.
# Usa una base descartable `bbjobs_scratch` en el Postgres nativo de Windows y la borra al final.
# Correr en una ventana de PowerShell aparte:
#   powershell -ExecutionPolicy Bypass -File .\scripts\probar_local_pgvector_y_fix.ps1
$ErrorActionPreference = "Stop"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$py   = "C:\Users\gaelr\Desktop\Clientes\Archivo\BBJobs\bbjobs\backend\.venv\Scripts\python.exe"
$backend = Split-Path -Parent $PSScriptRoot

$sec = Read-Host "Contraseña del usuario postgres LOCAL" -AsSecureString
$pw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
$env:PGPASSWORD = $pw

function A {
    # Sin 2>&1: en PowerShell 5.1 eso convierte los INFO de alembic (stderr) en errores fatales.
    $prev = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    & $py -m alembic @args
    $ErrorActionPreference = $prev
    if ($LASTEXITCODE -ne 0) { throw "alembic $args falló (código $LASTEXITCODE)" }
}

function Q($db, $sql) { & $psql -w -h localhost -U postgres -d $db -v ON_ERROR_STOP=1 -tAc $sql }

try {
    Write-Host "`n== 1. Base descartable"
    Q "postgres" "DROP DATABASE IF EXISTS bbjobs_scratch" | Out-Null
    Q "postgres" "CREATE DATABASE bbjobs_scratch" | Out-Null

    Write-Host "== 2. pgvector"
    Q "bbjobs_scratch" "CREATE EXTENSION vector" | Out-Null
    $d = Q "bbjobs_scratch" "SELECT round(('[1,2,3]'::vector <=> '[1,2,4]'::vector)::numeric, 4)"
    Write-Host "   distancia coseno [1,2,3] vs [1,2,4] = $d  (esperado ~0.0085)"
    Write-Host "   version: $(Q 'bbjobs_scratch' "SELECT extversion FROM pg_extension WHERE extname='vector'")"

    Write-Host "== 3. Migraciones hasta antes del fix"
    $url = "postgresql+asyncpg://postgres:$([uri]::EscapeDataString($pw))@localhost:5432/bbjobs_scratch"
    # alembic/env.py pasa la URL por configparser, que interpreta '%': se duplica sólo ahí.
    $env:DATABASE_URL = $url; $env:MIGRATIONS_DATABASE_URL = $url.Replace("%", "%%"); $env:SECRET_KEY = "x"
    Push-Location $backend
    A upgrade f3b9c2d6a4e8

    Write-Host "== 4. Filas 'sucias' como las de producción (FKs apagadas sólo en esta sesión)"
    Q "bbjobs_scratch" @"
SET session_replication_role = replica;
INSERT INTO application_status_history (id, application_id, from_status, to_status, created_at) VALUES
 (gen_random_uuid(), gen_random_uuid(), NULL, 'ApplicationStatus.new', now()),
 (gen_random_uuid(), gen_random_uuid(), 'new', 'ApplicationStatus.selected', now()),
 (gen_random_uuid(), gen_random_uuid(), 'ApplicationStatus.seen', 'in_process', now());
"@ | Out-Null

    Write-Host "== 5. Aplicar el fix"
    A upgrade a7c3e9d2f514
    $sucias = Q "bbjobs_scratch" "SELECT count(*) FROM application_status_history WHERE to_status LIKE 'ApplicationStatus.%' OR from_status LIKE 'ApplicationStatus.%'"
    $valores = Q "bbjobs_scratch" "SELECT string_agg(coalesce(from_status,'-')||'>'||to_status, ' , ' ORDER BY to_status) FROM application_status_history"
    Write-Host "   filas con prefijo: $sucias (esperado 0)"
    Write-Host "   valores: $valores"

    Write-Host "== 6. Ida y vuelta"
    A downgrade f3b9c2d6a4e8
    A upgrade a7c3e9d2f514
    A current

    if ($sucias -eq "0") { Write-Host "`nRESULTADO: OK" -ForegroundColor Green }
    else { Write-Host "`nRESULTADO: FALLO" -ForegroundColor Red }
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    Q "postgres" "DROP DATABASE IF EXISTS bbjobs_scratch WITH (FORCE)" | Out-Null
    Remove-Item Env:PGPASSWORD, Env:DATABASE_URL, Env:MIGRATIONS_DATABASE_URL -ErrorAction SilentlyContinue
    Write-Host "(base descartable borrada)"
}
