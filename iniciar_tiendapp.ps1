# ==============================================================================
# INICIADOR AUTOMÁTICO DE TIENDAPP (GESTIÓN INTELIGENTE NEIVA)
# ==============================================================================
$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  TIENDAPP — GESTION INTELIGENTE NEIVA (SaaS POS)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Write-Host "-> Creando archivo .env local..." -ForegroundColor Yellow
    @"
DATABASE_URL=sqlite:///./tiendapp_dev.db
SECRET_KEY=tiendapp-secret-key-local-segura-2026-neiva-huila-colombia
ACCESS_TOKEN_EXPIRE_MINUTES=480
MAX_FAILED_LOGIN_ATTEMPTS=10
SUPERADMIN_KEY=tiendapp-superadmin-2026
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
UPLOAD_DIR=media
"@ | Set-Content -Path ".env" -Encoding UTF8
}

if (-not (Test-Path "frontend\.env")) {
    "VITE_API_URL=http://localhost:8000" | Set-Content -Path "frontend\.env" -Encoding UTF8
}

Write-Host "-> Inicializando base de datos y tienda de demostracion..." -ForegroundColor Green
.\.venv\Scripts\python.exe seed_demo.py

Write-Host "-> Levantando Backend FastAPI en http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir'; .\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000"

Write-Host "-> Levantando Frontend React PWA en http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\frontend'; npm run dev -- --host 0.0.0.0 --port 5173"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
Write-Host "`n[LISTO] Se abrio http://localhost:5173 en tu navegador." -ForegroundColor Cyan
