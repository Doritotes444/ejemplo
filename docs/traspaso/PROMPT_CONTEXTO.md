# PROMPT DE CONTEXTO — Pegar al inicio de cualquier sesión nueva (Claude/Gemini)

> Última actualización: 2026-10-18 · Mantener este prompt actualizado al cierre de cada sprint (ver checklist en `docs/checklists/pre-flight-checklist.md`).

---

## Copiar y pegar desde aquí ⬇️

Estás trabajando en **Gestión Neiva** (`C:\Users\merid\Documents\GESTION_NEIVA_CLAUDE`), un POS/ERP multi-tenant para tenderos de Neiva, Colombia. Es también una **fábrica de sistemas IA** (tiers basic/medium/professional) construida con Claude + Gemini como co-autores; leer `AGENTS.md` (protocolo de colaboración), `CLAUDE.md`, `GEMINI.md` y `PLAN_ACTIVO.md` (fuente de verdad del sprint).

**Stack:** FastAPI + SQLAlchemy + Alembic + PostgreSQL (SQLite solo para tests rápidos) + Redis en backend (`app/`); React 19 + JSX puro (SIN TypeScript) + Vite + Tailwind en frontend (`frontend/src/`); docker + render.yaml para deploy. Scripts en PowerShell (Windows).

**Estado real (verificado 2026-10-18):** 86/86 tests backend pasando y build de Vite limpio (~15s). Completados hasta Sprint 8.4: auth multi-tenant, POS con stock concurrente (`SELECT FOR UPDATE`), dashboard/reportes, categorías/vencimientos/granel/escáner, RBAC Dueño vs Cajero con límite de cajeros por plan, ERP integrado (compras/proveedores/cuentas por pagar) según plan de empresa, CRM de soporte + SuperAdmin, **Agente IA in-app** con FSM + idempotencia persistente (`agent_commands`) + provider agnóstico (Groq/Gemini, modelo fijado `gemini-3.6-flash`) + benchmark 280/280 + dictamen GO producción 9.5/10, ciclo de voz blindado (VAD 950ms, BackendSTT vs WebSpeech, watchdog), y entitlements con trial Pro de 15 días Fail-Closed + UI Pro en Header.

**Vamos a trabajar sobre las brechas del Sprint 9 (definidas en `PLAN_ACTIVO.md` → sección "Sprint 9 — Brechas pendientes para Producción Comercial")**, hoje priorizadas:

1. **🔴 B1+B2 — Monetización (prioridad main):** la activación Pro es hoy manual vía ticket de soporte (`/api/soporte/solicitar-upgrade`). Falta pasarela de pago colombiana (candidato: Wompi), webhook idempotente de confirmación, `suscripcion_service` que active/desactive `empresa.plan` automáticamente, y ciclo de vida trial→pago→pro→vencimiento con tests E2E. **El primer cobro real desbloquea Hermes-3 (Together AI), restricción activa del proyecto.**
2. **🔴 B3 — Deploy productivo:** compose completo (Postgres 16 + Redis 7 + Nginx + migraciones alembic en arranque + backups). `docker-compose.yml`, `render.yaml`, `Dockerfile` y `Procfile` ya existen pero básicos.
3. **🟡 B4 — Telemetría del agente:** medir `time_to_sale`, `confirmation_rate`, `clarification_rate`, `LLM_fallback_rate` para el piloto de 5–10 tiendas.
4. **🟡 B5 — Landing con placeholders** (`[HISTORIA REAL PENDIENTE]` ×2, redes vacías) en `LandingPage.jsx`.
5. **🟡 B6 — Code-splitting:** bundle único >500 kB; hacer `React.lazy` en rutas pesadas (`App.jsx`, `LandingPage`, `SuperAdmin`) y `manualChunks`.

**Reglas inamovibles (las 5 Leyes + restricciones):**
- PostgreSQL es la única autoridad de datos; el LLM es solo intérprete. Toda mutación pasa por servicios de negocio con confirmación del usuario.
- Aislamiento multi-tenant estricto: `empresa_id`/`usuario_id` desde el JWT verificado, siempre.
- POS básico (ventas/caja/inventario) **nunca se bloquea** por vencimiento de trial/suscripción (Regla SUB-09); `require_pro_entitlement` solo protege funciones Pro (agente, voz).
- Hermes-3 y toda API paga: BLOQUEADOS hasta primer ingreso real. Sin Ollama local. Sin TypeScript en frontend.
- TDD pragmático: test rojo primero cuando aplique; toda tarea de `PLAN_ACTIVO.md` se cierra ejecutando su comando de verificación y actualizando el plan + commit descriptivo.

**Verificación rápida al iniciar (PowerShell, raíz del repo):**
```powershell
.venv\Scripts\python.exe -m pytest tests/ -q --tb=no    # esperado: todos passed
cd frontend; npm run build; cd ..                       # esperado: ✓ built
docker compose ps                                       # servicios arriba
.venv\Scripts\python.exe -m alembic current             # migración al día
```

Lee `PLAN_ACTIVO.md` antes de proponer cambios y registra propuestas con `> [CLAUDE PROPONE]` o `> [GEMINI PROPONE]`.

## ⬆️ Hasta aquí — copiar y pegar
