import os

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.routers import (
    auth,
    dashboard,
    empresas,
    productos,
    reportes,
    ventas,
    superadmin,
    soporte,
    agente,
    usuarios,
    caja,
    comprobantes,
    planes,
    sync,
)
from app.core.security_middleware import SecurityHeadersMiddleware

_DEBUG = os.getenv("DEBUG", "false").lower() == "true"

app = FastAPI(
    title="Tiendapp API",
    description="Sistema POS SaaS — Gestión Inteligente Neiva",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — en producción, Render/Vercel inyectan:
#   FRONTEND_URL=https://tu-app.vercel.app
#   CORS_ORIGINS=https://a.vercel.app,https://b.vercel.app  (lista completa si hay varios)
# En desarrollo, el default cubre los puertos que Vite asigna (5173 / 5174).
# ---------------------------------------------------------------------------
_CORS_DEFAULT = ",".join([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://gestion-neiva-claude.vercel.app",
])
_origins_raw = os.getenv("CORS_ORIGINS", _CORS_DEFAULT)
_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]

# FRONTEND_URL es un alias de una sola URL — se añade si no está ya en la lista
_frontend_url = os.getenv("FRONTEND_URL", "").strip()
if _frontend_url and _frontend_url not in _origins:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],   # incluye OPTIONS para preflight — previene 405
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# Archivos estáticos (fotos de productos)
# ---------------------------------------------------------------------------
_media_dir = os.getenv("UPLOAD_DIR", "media")
os.makedirs(_media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=_media_dir), name="media")

# ---------------------------------------------------------------------------
# Routers — cada uno con su propio prefijo y método HTTP definido
# ---------------------------------------------------------------------------
for r in (
    auth.router,
    dashboard.router,
    empresas.router,
    productos.router,
    ventas.router,
    reportes.router,
    superadmin.router,
    soporte.router,
    usuarios.router,
    agente.router,
    caja.router,
    comprobantes.router,
    planes.router,
    sync.router,
):
    app.include_router(r)
    app.include_router(r, prefix="/api")


# ---------------------------------------------------------------------------
# Exception handlers globales
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors())},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Sistema"])
def health_check():
    return {"status": "ok", "version": "2.0.0"}

@app.get("/", tags=["Sistema"])
def root():
    return {"status": "ok", "message": "Tiendapp API — Gestión Neiva", "version": "2.0.0"}
