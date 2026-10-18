# PLAN ACTIVO — Gestión Neiva + Fábrica de Agentes IA

**Fecha:** 2026-05-20  
**Sprint activo:** Sprint 6 — Template medium  
**Próxima revisión:** Fin de Sprint 6

> Este documento es **mutable por Claude y Gemini**. Ver `AGENTS.md` para el protocolo de cambios.  
> Usa `> [GEMINI PROPONE]` o `> [CLAUDE PROPONE]` para proponer cambios sin implementarlos aún.

---

## Estado general

```
[✅] Sprint 2 — Auth funcional, layout conectado, bugs críticos resueltos
[✅] Sprint 3 — MVP cerrado (flujo end-to-end en producción verificado)
[✅] Sprint 3.5 — Features gancho: vencimiento, granel, categorías, escáner
[✅] Sprint 3.6 — Historial de ventas con tabs y filtro por fecha
[✅] Sprint 3.8 — Cierre brechas SRS: categorías, escáner, responsividad
[✅] Sprint 4 — Fundamentos de la fábrica (docs + templates + workflows)
[✅] Sprint 5 — Pipeline funcional tier basic (COMPLETO)
[✅] Sprint 6 — Template medium (COMPLETO)
[✅] Sprint 7 — Template professional (Diseño & Especificaciones en factory/templates/professional/ COMPLETO)
[✅] Sprint 7.8 — Fusión e Integración del ERP Distribuidora en el POS (COMPLETO)
[✅] Sprint 7.9 — Agente IA In-App Orientado a Tareas para Tier Pro (COMPLETO)
[✅] Sprint 8.1 — RBAC (Dueño vs. Cajero), Actividad del Día y Límite de Cajeros por Plan (COMPLETO)
[✅] Sprint 8.2 — Transformación Web Informativa + Onboarding Educativo No Bloqueante (COMPLETO)
[✅] Sprint 8.3 — Gobernanza RBAC en Asistente IA, Reabastecimiento con Costo y Latencia Cero (COMPLETO)
[✅] Sprint 8.4 — Entitlements (Trial 15 Días), Normalización Errores 422, UI Pro en Header (COMPLETO)
[ ] Sprint 9 — Despliegue y Activación de Hermes-3 en Producción (SIGUIENTE)
[ ] Sprint 10 — Landing Premium Dark-First (PROPUESTA — ver al final del documento)
```

---

## Sprint 5 — Pipeline funcional tier basic

**Objetivo:** ejecutar el pipeline `build-basic.md` de punta a punta con un sistema demo real, medir costos reales y tener algo que mostrar a un primer cliente.

**La meta concreta:** construir **"POS Papelería"** — un segundo sistema básico usando la fábrica, que sirva como demo y validación del pipeline.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Definir requirements de POS Papelería (texto libre) | `factory/jobs/pos-papeleria/requirements.txt` | ✅ |
| 2 | [Gemini] Analizar requirements → JSON estructurado | `factory/jobs/pos-papeleria/requirements.json` | ✅ |
| 3 | [Architect] Schema DB + contratos API adaptados | `factory/jobs/pos-papeleria/schema.md` + `api-contracts.md` | ✅ |
| 4 | [Haiku] Backend: models + schemas + migration | `factory/jobs/pos-papeleria/` | ✅ |
| 5 | [Haiku] Backend: routers + services | `factory/jobs/pos-papeleria/` | ✅ |
| 6 | [Sonnet] Frontend adaptado | `factory/jobs/pos-papeleria/` | ✅ |
| 7 | [Gemini] QA review completo | `factory/jobs/pos-papeleria/qa-report.md` | ✅ |
| 8 | [Haiku] DevOps: docker-compose + README deploy | `factory/jobs/pos-papeleria/` | ✅ |
| 9 | Medir costo real en tokens y tiempo | `factory/jobs/pos-papeleria/METRICAS.md` | ✅ |
| 10 | Landing page simple para mostrar el portafolio | `docs/landing/` | ✅ Hecho |

### Criterios de éxito Sprint 5

1. POS Papelería corre en local: `login → inventario → venta → reporte`
2. Costo real de tokens documentado en `METRICAS.md`
3. Tiempo real de construcción documentado (debe ser < 4 horas)
4. QA report sin issues críticos
5. Hay algo que mostrarle a un potencial cliente (demo o landing)

### Resultado Sprint 5

✅ **34/34 tests passing** — 0 issues críticos en QA  
✅ `qa-report.md`, `docker-compose.yml`, `README.md`, `METRICAS.md` entregados  
✅ Landing Page ultra-premium interactiva con configurador completada en `docs/landing/`  
✅ Costo real: ~$0.22 USD | Tiempo: ~4.5 horas  

### Próximo paso (Sprint 6)

> Definir template medium: módulos de proveedores, compras, cuentas por pagar.


---

## Sprint 3 — Cierre MVP Gestión Neiva

**Objetivo:** ciclo completo `login → inventario → venta → reporte` funciona sin errores.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | CartSidebar en el layout | `Layout.jsx` | ✅ Hecho |
| 2 | Fix unique barcode global → por empresa | `models.py` + migration 002 | ✅ Hecho |
| 3 | Dashboard con métricas reales | `Dashboard.jsx` + `routers/dashboard.py` | ✅ Hecho |
| 4 | Correr migration 002 en BD | `alembic upgrade head` | ✅ Hecho |
| 5 | Probar flujo end-to-end | Manual: login → producto → venta | ✅ Hecho |
| 6 | Tests auth básicos | `tests/test_auth.py` | ✅ Hecho |
| 7 | Script arranque entorno | `dev.ps1` (Menú Interactivo Windows) | ✅ Hecho |

### Criterios de éxito Sprint 3

1. Login en `localhost:5173` funciona sin errores
2. Crear producto → aparece en la grilla
3. Click "Agregar" → CartSidebar aparece con el item
4. Finalizar venta → stock descontado, aparece en historial
5. Exportar Excel desde Reportes → descarga archivo válido
6. Dashboard muestra números reales (no "—")
7. Otro usuario en otra empresa puede registrarse y operar su propia tienda

---

---

## Sprint 3.5 — Features "Gancho" para MVP (Alta Prioridad)

**Objetivo:** Implementar analítica, fechas de vencimiento y soporte para productos a granel para aumentar el valor percibido del MVP Básico.

| # | Tarea | Responsable | Estado |
|---|-------|-------------|--------|
| 1 | Migración DB: `cantidad` a `Numeric`, añadir `fecha_vencimiento` y `unidad_medida` (Enum: unidad, gramo, libra, kilo) | Claude | ✅ Hecho |
| 2 | Endpoints Dashboard (Top productos, Alertas vencimiento a 15 días fijos) | Claude | ✅ Hecho |
| 3 | Actualizar ModalProducto (nuevos campos, input fecha y selector de medida) | Claude | ✅ Hecho |
| 4 | Modificar CartSidebar para permitir fracciones en granel según medida | Claude | ✅ Hecho |
| 5 | Gráficas en Dashboard (Recharts) y panel rojo de vencimientos | Claude | ✅ Hecho |

### Criterios de éxito Sprint 3.5
1. Dashboard muestra gráfica de los 5 productos más vendidos.
2. Dashboard muestra alerta roja para productos que vencen en 15 días o menos.
3. Se puede crear un producto seleccionando unidad de medida (ej. Libra) y fecha de vencimiento opcional.
4. En el POS (CartSidebar), si un producto es por peso, se puede ingresar "1.5" y calcula el subtotal.

---

## Sprint 4 — Fundamentos de la fábrica

**Objetivo:** infraestructura de documentación y agentes para que la fábrica pueda operar.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | CLAUDE.md completo | `CLAUDE.md` | ✅ Hecho |
| 2 | GEMINI.md (contexto para Antigravity) | `GEMINI.md` | ✅ Hecho |
| 3 | AGENTS.md (protocolo colaboración) | `AGENTS.md` | ✅ Hecho |
| 4 | PLAN_ACTIVO.md (este archivo) | `PLAN_ACTIVO.md` | ✅ Hecho |
| 5 | `.claude/settings.json` MCP servers | `.claude/settings.json` | ✅ Hecho |
| 6 | Agente haiku-worker | `.claude/agents/haiku-worker.md` | ✅ Hecho |
| 7 | Agente architect | `.claude/agents/architect.md` | ✅ Hecho |
| 8 | factory/README.md | `factory/README.md` | ✅ Hecho |
| 9 | Template basic (4 docs) | `factory/templates/basic/` | ✅ Hecho |
| 10 | Pipeline build-basic | `factory/workflows/build-basic.md` | ✅ Hecho |
| 11 | Portafolio de precios | `factory/pricing/PORTFOLIO.md` | ✅ Hecho |
| 12 | Actualizar VISION_Y_ROADMAP.md | `docs/VISION_Y_ROADMAP.md` | ✅ Hecho |

### Criterios de éxito Sprint 4

1. Nueva sesión Claude Code carga contexto completo sin handoff manual
2. Gemini puede leer GEMINI.md y PLAN_ACTIVO.md y contribuir al plan
3. `factory/templates/basic/` tiene los 4 documentos de referencia
4. El pipeline `build-basic.md` es ejecutable paso a paso

---

## Sprint 3.6 — Mini-refactor Historial de Ventas (UX cuadre de caja)

**Objetivo:** Vista de Ventas con 3 tabs (Hoy / Semana / Histórico) y filtro por fecha en el backend.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Endpoint ventas con `fecha_inicio` / `fecha_fin` query params | `routers/ventas.py`, `services/venta_service.py` | ✅ Hecho |
| 2 | UI tabs + TotalBanner + ExcelExport (tab Histórico) | `pages/Ventas.jsx` | ✅ Hecho |

---

## Sprint 3.8 — Cierre de Brechas SRS

**Objetivo:** Cubrir los requisitos funcionales RF-02 y RF-03 del SRS antes del despliegue.

| # | Paso | Descripción | Estado |
|---|------|-------------|--------|
| 1 | RF-02 | Categorías de productos — enum + migration 005 + selector en modal | ✅ Hecho |
| 2 | RF-03 | Escáner de código de barras via cámara (`@zxing/browser`) | ✅ Hecho |
| 3 | RF-04 | Responsividad móvil — layout y componentes adaptados a pantalla pequeña | ✅ Hecho |

### Criterios de éxito Sprint 3.8
1. Se puede asignar categoría al crear/editar un producto.
2. Al pulsar 📷 en el modal, la cámara detecta un código EAN/UPC y lo auto-rellena.
3. El POS es usable en móvil (mínimo 375 px de ancho).

---

## Sprint 5 — Pipeline funcional tier basic (próximo)

- `factory/workflows/build-basic.md` como workflow ejecutable real
- Generar un segundo sistema básico usando el pipeline (demo para clientes)
- Medir costo real en tokens por sistema construido
- Primer cliente Gestión Neiva pagando → **desbloquea Hermes-3**

---

## Sprint 6 — Template medium (ERP Ligero)

**Objetivo:** Definir el estándar para sistemas comerciales del Tier Medium y validar el pipeline construyendo un sistema demo completo llamado **"ERP Distribuidora"** (sistema mayorista de abasto con proveedores y deudas).

| # | Tarea | Recurso / Archivo | Estado |
|---|-------|-------------------|--------|
| 1 | **[Gemini]** Crear carpeta y plantillas del Tier Medium | `factory/templates/medium/` | ✅ Completado |
| 2 | **[Gemini]** Diseñar esquema de base de datos relacional del ERP | `factory/templates/medium/schema.md` | ✅ Completado |
| 3 | **[Gemini]** Diseñar contratos de API REST (Compras, Proveedores, CxP) | `factory/templates/medium/api-contracts.md` | ✅ Completado |
| 4 | **[Gemini]** Listar componentes React 19 y checklist de customización | `.../components-list.md` + `.../customization-checklist.md` | ✅ Completado |
| 5 | **[Gemini]** Analizar requisitos de "erp-distribuidora" → JSON | `factory/jobs/erp-distribuidora/requirements.json` | ✅ Completado |
| 6 | **[Architect/Claude]** Schema DB + Contratos adaptados a Distribuidora | `factory/jobs/erp-distribuidora/schema.md` + `api-contracts.md` | ✅ Completado |

| 7 | **[Haiku]** Backend Boilerplate (Modelos, schemas, migraciones Alembic) | `factory/jobs/erp-distribuidora/` | ✅ Completado |
| 8 | **[Haiku]** Routers FastAPI + Lógica de negocio (Servicios transaccionales) | `factory/jobs/erp-distribuidora/` | ✅ Completado |
| 9 | **[Sonnet]** Frontend React JSX (Compras, Proveedores, Cuentas por Pagar) | `factory/jobs/erp-distribuidora/` | ✅ Completado |
| 10 | **[Haiku]** Pruebas de integración del flujo de compras y abonos | `factory/jobs/erp-distribuidora/tests/` | ✅ Completado |
| 11 | **[Gemini]** QA completo y reporte final de bugs y correcciones | `factory/jobs/erp-distribuidora/qa-report.md` | ✅ Completado |
| 12 | **[Haiku]** DevOps: docker-compose + README deploy del ERP | `factory/jobs/erp-distribuidora/` | ✅ Completado |
| 13 | Medir costo real de tokens y tiempo en ERP | `factory/jobs/erp-distribuidora/METRICAS.md` | ✅ Completado |

### Criterios de éxito Sprint 6
1. La plantilla del Tier Medium está completa, estructurada y documentada.
2. El sistema de validación "ERP Distribuidora" funciona en local: registro de proveedor → compra a crédito (actualiza stock e incrementa deuda) → abono a cuenta por pagar (amortiza deuda hasta saldar e inactivar).
3. Todas las pruebas de integración backend de compras y abonos pasan satisfactoriamente.
4. Reporte de métricas reales del Tier Medium completado (costo en USD y tiempo).


---

## Sprint 7 — Template professional (COMPLETO)

- Template professional: multi-tenant real, pagos, SSO, API pública (Diseño & Especificaciones) ✅
- **factory/templates/professional/ creado:** `schema.md`, `api-contracts.md`, `components-list.md` y `customization-checklist.md` ✅

---

## Sprint 7.5 — Panel Super Admin + Sistema de Soporte CRM (COMPLETO)

**Objetivo:** Añadir una capa de operaciones internas a Gestión Neiva: panel de control para el superadmin y bandeja de soporte bidireccional entre tiendas y el equipo de soporte.

| # | Tarea | Archivo | Estado |
|---|-------|---------|--------|
| 1 | Modelos `SoporteTicket` + `SoporteMensaje` en `app/models.py` | `app/models.py` | ✅ Completado |
| 2 | Migración Alembic `006_crear_tablas_soporte` | `alembic/versions/006_crear_tablas_soporte.py` | ✅ Completado |
| 3 | Schemas Pydantic: `TicketOut`, `EmpresaAdminOut`, etc. | `app/schemas/soporte.py` | ✅ Completado |
| 4 | Router superadmin (empresas, trial, status, tickets) | `app/routers/superadmin.py` | ✅ Completado |
| 5 | Router soporte (crear, listar, detalle, responder) | `app/routers/soporte.py` | ✅ Completado |
| 6 | Registrar routers en `app/main.py` | `app/main.py` | ✅ Completado |
| 7 | Sidebar + rutas frontend (`/soporte`, `/superadmin`) | `Sidebar.jsx` + `App.jsx` | ✅ Completado |
| 8 | Página Soporte.jsx (bandeja Gmail-style) | `frontend/src/pages/Soporte.jsx` | ✅ Completado |
| 9 | Página SuperAdmin.jsx (login por clave + 2 tabs) | `frontend/src/pages/SuperAdmin.jsx` | ✅ Completado |
| 10 | Tests de integración (7/7 passing, 16/16 total) | `tests/test_soporte_crm.py` | ✅ Completado |

### Criterios de éxito Sprint 7.5
1. ✅ Usuario puede crear ticket, ver hilo y responder desde `/soporte`
2. ✅ Superadmin autentica con `x-superadmin-key`, ve todas las empresas y tickets
3. ✅ Superadmin puede responder tickets (estado → `respondido`)
4. ✅ Flujo end-to-end: Crear ticket → Responder como admin → Ver actualización en hilo del cliente
5. ✅ 16/16 tests passing (auth + OWASP + soporte CRM), build frontend sin errores

---

## Sprint 7.8 — Fusión e Integración del ERP Distribuidora en el POS (COMPLETO)

**Objetivo:** Integrar completamente los módulos de la fábrica (ERP Distribuidora: compras, proveedores y cuentas por pagar) en la misma aplicación monolítica multi-tenant de Gestión Neiva, habilitándose dinámicamente según el plan de la empresa.

| # | Tarea | Recurso / Archivo | Estado |
|---|-------|-------------------|--------|
| 1 | **[Architect/Claude]** Fusionar modelos Proveedor, Compra, CxP en models | `app/models.py` | ✅ Completado |
| 2 | **[Architect/Claude]** Crear y aplicar migración Alembic de nuevas tablas | `alembic/versions/` | ✅ Completado |
| 3 | **[Haiku]** Copiar y adaptar esquemas Pydantic del ERP | `app/schemas/` | ✅ Completado |
| 4 | **[Haiku]** Copiar y registrar servicios de compra y deudas | `app/services/` | ✅ Completado |
| 5 | **[Haiku]** Registrar nuevos routers del ERP y deshabilitar router SSO | `app/main.py` + `app/routers/` | ✅ Completado |
| 6 | **[Haiku]** Adaptar y fusionar pruebas de integración del ERP al core | `tests/test_erp_flows.py` | ✅ Completado |
| 7 | **[Sonnet]** Frontend: Copiar componentes, páginas y hooks del ERP | `frontend/src/` | ✅ Completado |
| 8 | **[Sonnet]** Frontend: Registrar rutas en App.jsx con protección de plan | `App.jsx` | ✅ Completado |
| 9 | **[Sonnet]** Frontend: Sidebar condicional y dinámico según `empresa.plan` | `Sidebar.jsx` | ✅ Completado |
| 10| **[Sonnet]** Frontend: Cambiar control de URL por selector de Plan en admin | `pages/SuperAdmin.jsx` | ✅ Completado |

### Criterios de éxito Sprint 7.8
1. Las 5 tablas del ERP están integradas en la base de datos de Gestión Neiva mediante Alembic.
2. Los endpoints del ERP responden de forma multi-tenant (`empresa_id` aislado).
3. Si el plan de una empresa es `basic`, los menús del ERP no se muestran.
4. Si el plan de una empresa cambia a `medium` desde el Superadmin, se muestran instantáneamente *Compras, Proveedores y Cuentas por Pagar*.
5. Todo el flujo (proveedor -> compra crédito -> abono CxP) se ejecuta en la misma pantalla.
6. 100% de los tests pasan sin errores (`pytest tests/`).

---

## Sprint 7.9 — Agente IA In-App Orientado a Tareas para Tier Pro (🟢 CERTIFICADO 9.5/10 — GO PRODUCCIÓN COMERCIAL)

**Objetivo:** Implementar la arquitectura definitiva del Agente de Inteligencia Artificial para el MVP Tier Pro ($89.000 – $99.000 COP/mes). El agente interpreta intenciones en lenguaje natural y delega la ejecución en los servicios existentes de negocio, con PostgreSQL como autoridad final y confirmación obligatoria previa a toda mutación.

> **Dictamen Oficial de Auditoría Externa:** 🟢 **GO PARA PRODUCCIÓN COMERCIAL (9.5/10 — CERTIFICADO)**
> - P0 restantes: **0**
> - P1 bloqueadores: **0**
> - Concurrencia artificial: **0** (concurrencia PostgreSQL pura mediante `SELECT FOR UPDATE` y `uq_empresa_command_id`, CERO cerrojos Python)
> - Autoridad transaccional: **100% servicios de negocio y PostgreSQL** (el LLM es solo intérprete probabilístico)
> - 53/53 tests pasando al 100% en todo el repositorio.

| # | Tarea | Recurso / Archivo | Estado |
|---|-------|-------------------|--------|
| 1 | **[Architect/DB]** Tabla de auditoría e idempotencia persistente `AgentCommand` + migración Alembic 010 | `app/models.py`, `alembic/versions/010_crear_tabla_agent_commands.py` | ✅ Completado |
| 2 | **[Architect/Backend]** Soporte transaccional externo (`commit=False`) en `venta_service` y `producto_service` | `app/services/venta_service.py`, `app/services/producto_service.py` | ✅ Completado |
| 3 | **[Core/Agente]** Almacenamiento de sesiones desacoplado (`SessionStore`: InMemory para test/dev + Redis con TTL 5m para prod) | `app/services/agente/session_store.py` | ✅ Completado |
| 4 | **[Core/Agente]** Matcher de catálogo fuzzy de 3 zonas con discriminación de ambigüedades | `app/services/agente/catalog_matcher.py` | ✅ Completado |
| 5 | **[Core/Agente]** Formateador determinístico de lenguaje natural (cero costo en tokens de salida) | `app/services/agente/response_formatter.py` | ✅ Completado |
| 6 | **[Core/Agente]** Consultas financieras y de inventario determinísticas con validaciones de fechas UTC | `app/services/agente/consultas_service.py` | ✅ Completado |
| 7 | **[Core/Agente]** FSM formal con matriz de transiciones estrictas (`AgentState`) | `app/services/agente/fsm.py` | ✅ Completado |
| 8 | **[Core/Agente]** Proveedor agnóstico de intenciones (Regex <1ms + adaptadores Groq/Gemini) | `app/services/agente/intent_provider.py` | ✅ Completado |
| 9 | **[Orchestrator]** Orquestador central de intenciones, slot-filling, verificación de tenant en JWT y fallback idempotente | `app/services/agente/agent_orchestrator.py` | ✅ Completado |
| 10 | **[Router]** Endpoint HTTP delgado `POST /api/agente/mensaje` con schema de entrada/salida tipado | `app/routers/agente.py`, `app/main.py` | ✅ Completado |
| 11 | **[QA/Tests]** Suite de 13 pruebas adversariales de producción (T-01 a T-13) con 100% de aprobación | `tests/test_agente_produccion.py` | ✅ Completado |
| 12 | **[Frontend]** Widget interactivo in-app (`AgentWidget.jsx` con Web Speech API `es-CO`, chips, preview cards y acción confirm/cancel) | `frontend/src/components/AgentWidget.jsx`, `Layout.jsx` | ✅ Completado |
| 13 | **[Auditoría Senior]** Correcciones P0 y P1 del auditor (P0.1, P0.3, P1.1-P1.5): confirmación sin LLM, timezone Neiva, modismos colombianos, aislamiento por usuario | Repositorio completo | ✅ Completado |
| 14 | **[Certificación Final 9.1/10]** Resolución de los 4 bloqueadores para Producción Comercial: confirmación inequívoca, Redis fail-closed, validación Pydantic + límites de cantidades, suite de concurrencia e integración Postgres | `agent_orchestrator.py`, `session_store.py`, `intent_provider.py`, `tests/test_concurrencia_real.py`, `tests/integration/postgres/` | ✅ Completado |
| 15 | **[PostgreSQL Concurrencia Pura - CERO db_lock]** Eliminación total de serialización artificial (`threading.Lock()`); pruebas empíricas contra motor PostgreSQL vivo con connection pool (`tests/integration/postgres/test_concurrencia_postgres.py` y `tests/test_concurrencia_real.py`) con medición de bloqueo de kernel `SELECT FOR UPDATE` (>0.25s), violación nativa de `uq_empresa_command_id` y cero lost updates | `tests/integration/postgres/test_concurrencia_postgres.py`, `tests/test_concurrencia_real.py` | ✅ Completado |

### Criterios de éxito y verificación Sprint 7.9
1. ✅ **El LLM nunca es autoridad:** Toda consulta financiera (ventas hoy, recaudo, stock) es calculada determinísticamente por PostgreSQL / SQLAlchemy; no hay alucinaciones de cifras ni falsas métricas de ROI.
2. ✅ **Cero duplicación de lógica:** Las ventas descuentan stock mediante `venta_service.registrar_venta` con `SELECT FOR UPDATE`.
3. ✅ **Aislamiento multi-tenant y multi-usuario estricto:** `empresa_id` y `usuario_id` se extraen únicamente del JWT verificado; sesiones cruzadas entre tiendas o entre cajeros de la misma tienda son aisladas.
4. ✅ **Confirmación obligatoria e idempotencia persistente:** Ninguna venta ni reabastecimiento muta la base de datos sin confirmación del tendero. Las confirmaciones repetidas o reintentadas responden con `idempotente=True` desde la tabla `agent_commands`.
5. ✅ **Confirmación inequívoca blindada:** Evaluación previa de negaciones y exigencia de expresiones completas cerradas; frases como *"sí, pero cambiar cantidad"* o *"espera"* no ejecutan.
6. ✅ **Redis fail-closed en producción:** En `ENVIRONMENT=production`, la caída o ausencia de Redis no degrada a memoria volátil, retornando HTTP 503 sin pérdida de contexto.
7. ✅ **Validación Pydantic estricta del LLM:** Salida del parser/LLM validada con `AgentLLMOutput` y `AgentSlotsSchema`, rechazando `NaN`, `Infinity`, ceros o valores fuera de rango $(0.001, 10000.0]$.
8. ✅ **Concurrencia Real en PostgreSQL Demostrada (CERO db_lock):** Eliminación total de serializaciones artificiales de Python (`db_lock = threading.Lock()`). Pruebas concurrentes multi-hilo sincronizadas con `threading.Barrier(2)` ejecutadas contra PostgreSQL real demostrando:
   - Bloqueo físico en kernel con `SELECT ... FOR UPDATE` (tiempo de suspensión medido $\ge 0.25$ segundos mientras la otra transacción finaliza).
   - Stock final estrictamente $0.0$, jamás negativo.
   - Deduplicación idempotente ante carreras por el mismo `command_id` arbitrada por `UniqueConstraint('empresa_id', 'command_id')` con `IntegrityError` nativo en PostgreSQL.
   - Reabastecimiento atómico sin lost updates ($10 + 5 + 5 = 20.0$).
9. ✅ **53/53 pruebas pasando al 100% en todo el repositorio:**
   - 5/5 pruebas de concurrencia e integración PostgreSQL pura (`tests/integration/postgres/test_concurrencia_postgres.py`)
   - 6/6 pruebas de concurrencia real y blindajes de producción (`tests/test_concurrencia_real.py`)
   - 13/13 pruebas adversariales de producción (`tests/test_agente_produccion.py`)
   - 29/29 pruebas de módulos core (Auth, ERP Compras/CxP, OWASP Security, CRM Soporte, Webhooks WhatsApp)
10. ✅ **Frontend Production Ready:** `npm run build` compila con 0 errores y el drawer se encuentra activo en el layout general.

---

## Sprint 7.9.5 — Hardening del Ciclo de Voz y Resiliencia Móvil Android-First (COMPLETO)

**Objetivo:** Blindar el ciclo de voz continuo (`VoiceTurnManager`, `voiceCapabilities`, `BackendSTTProvider`, `WebSpeechProvider`) para operar sin condiciones de carrera (`InvalidStateError`), sin callbacks huérfanos y con resiliencia total en dispositivos Android y Desktop.

| # | Tarea | Recurso / Archivo | Estado |
|---|-------|-------------------|--------|
| 1 | **[Detect]** Detección robusta de capacidades y política Android-First (`isAndroid`, `isMobile`, `maxTouchPoints`) | `frontend/src/services/voice/voiceCapabilities.js` | ✅ Completado |
| 2 | **[TurnManager]** Control de generaciones de proveedor (`providerGeneration`) y sesión (`sessionGeneration`) para descartar callbacks obsoletos | `frontend/src/services/voice/VoiceTurnManager.js` | ✅ Completado |
| 3 | **[Lifecycle & Watchdog]** Cierre asíncrono de WebSpeech (`onend` único), `abortAndWait` / `stopAndWait`, recuperación controlada de `InvalidStateError` y watchdog 9s limitador de captura sin abortar transcripciones BackendSTT en vuelo | `WebSpeechProvider.js`, `BackendSTTProvider.js`, `VoiceTurnManager.js` | ✅ Completado |
| 4 | **[Decouple]** Desacoplamiento de `BackendSTTProvider` de la orquestación de turnos, tracking de `turnId` y `isPendingTranscription` + logs estructurados | `frontend/src/services/voice/stt/BackendSTTProvider.js` | ✅ Completado |
| 5 | **[Vite/Ngrok]** Soporte de túnel seguro HTTPS con `host: true` y `allowedHosts: true` para pruebas móviles reales | `frontend/vite.config.js` | ✅ Completado |
| 6 | **[QA/Tests]** Suite de 40 pruebas unitarias formales para ciclo de voz (A, B, C, D, E, F, H, I, J, K, L, M, N) al 100% pasando | `frontend/test_voice_turn_manager.js` | ✅ Completado |
| 7 | **[DB/Local]** Sincronización de migraciones Alembic 001-010 en PostgreSQL local nativo + credenciales demo | `alembic/versions/`, `.env` | ✅ Completado |

---

## Sprint 8 — Despliegue en Producción y Piloto Comercial (SIGUIENTE)

**Objetivo:** Congelar la arquitectura del agente y poner el sistema en manos de 5 a 10 tiendas piloto reales en Neiva para validar producto y economía unitaria.

| # | Tarea | Detalle | Estado |
|---|-------|---------|--------|
| 1 | **[DevOps]** Preparación de entorno productivo con Docker Compose / VPS | PostgreSQL 16/18 + Redis 7 + FastAPI + Nginx + Frontend Vite | ⏳ Por iniciar |
| 2 | **[Telemetría]** Instrumentación de métricas clave del tendero | Logging/Métricas de `time_to_sale`, `confirmation_rate`, `clarification_rate`, `LLM_fallback_rate` | ⏳ Por iniciar |
| 3 | **[Piloto Neiva]** Onboarding controlado de 5 a 10 tiendas de barrio | Medición de adopción de voz vs texto y ahorro de tiempo por venta | ⏳ Por iniciar |
| 4 | **[Monetización]** Activación de Hermes-3 vía Together AI | Se activa con el cobro de la primera mensualidad real ($89.000 - $99.000 COP) | 🔒 Bloqueado hasta 1er pago |

---

## Sprint 9 — Brechas pendientes para Producción Comercial (PLAN — 2026-10-18)

**Estado verificado 2026-10-18:** 86/86 tests backend ✅ · build frontend ✅ (15.4s) · sincronizado con origin/main (1 commit local sin push).

### Brechas conocidas (funciones NO al 100%)

| # | Brecha | Impacto | Severidad |
|---|--------|---------|-----------|
| B1 | **Cobro/billing no automatizado:** "Activar Pro" solo genera ticket de soporte (`/api/soporte/solicitar-upgrade`); la activación es manual y no hay pasarela de pago (Wompi/PayU/MercadoPago) ni registro `empresa.plan` automático ni renovación/vencimiento de suscripción pagada | No se puede facturar sin intervención humana → bloquea el ingreso que desbloquea Hermes-3 | 🔴 Barrera comercial |
| B2 | **Ciclo de vida de suscripción pagada:** `entitlement_service` cubre trial de 15 días, pero falta estado `activa`/`suspendida`, cobro recurrente, y qué pasa exactamente al vencer el trial/Pro (Regla SUB-09 cubre POS básico, falta flujo de re-activación) | Churn silencioso y facturación incobrable | 🔴 Alta |
| B3 | **Despliegue productivo no ejecutado:** `docker-compose.yml` básico, `render.yaml` y `Dockerfile` existen pero falta un compose de producción completo (Redis incluido, HTTPS/Nginx, migraciones alembic en arranque, backups) y subir a VPS | El sistema corre solo en dev | 🔴 Alta |
| B4 | **Telemetría del agente ausente:** no se miden `time_to_sale`, `confirmation_rate`, `clarification_rate`, `LLM_fallback_rate` | Sin datos no se valida el piloto | 🟡 Media |
| B5 | **Landing con placeholders:** `[HISTORIA REAL PENDIENTE]` (×2) y enlaces de redes vacíos | Portafolio público incompleto | 🟡 Media |
| B6 | **Frontend sin code-splitting:** bundle único >500 kB (warning Vite); cargar `LandingPage`, `SuperAdmin`, `AgentWidget` con `lazy()` + `manualChunks` | Lento en 4G de móviles de barrio (usuario target) | 🟡 Media |
| B7 | **Handoff desactualizado:** `docs/traspaso/HANDOFF.md` todavía lista el POS como "en diseño Sprint 4" | Confunde a nuevos agentes/desarrolladores | 🟢 Baja |

### Plan de desarrollo propuesto (orden de ejecución)

1. **Push del commit local** `5c876d0` a origin (1 commit pendiente) y commit de docs no trackeados (`docs/spec`, `docs/checklists`, `docs/traspaso`).
2. **B7 → B5 (higiene documental, ~1 sesión):** reescribir `HANDOFF.md` al estado real; decidir historias reales o retirar la sección de la landing.
3. **B6 (UX móvil, medio día):** code-splitting de rutas pesadas en `App.jsx` (`React.lazy`), `manualChunks` para recharts/@zxing; verificar build < 500 kB principal.
4. **B1 + B2 (monetización, 1–2 sprints):** integrar pasarela colombiana (Wompi es candidata natural: bajo umbral, Neiva-friendly) para cobro mensual Pro; endpoint webhook de confirmación de pago idempotente; servicio `suscripcion_service` que activa `empresa.plan='pro'` y gestiona renovación/suspensión (fail-open en POS básico según SUB-09); tests de ciclo completo trial→pago→pro→vencimiento.
5. **B3 (DevOps, en paralelo a 4):** compose de producción (Postgres 16 + Redis 7 + backend + frontend estático servido por Nginx + cloudflared/ngrok solo para piloto), `alembic upgrade head` en arranque, healthchecks y job de backup diario.
6. **B4 (telemetría, al desplegar):** hooks de logging estructurado en `agent_orchestrator.py` y routers de voz; tabla `metricas_diarias` o entrada de log parseable para el piloto.
7. **Sprint 8 piloto:** onboarding de 5–10 tiendas, medir adopción voz vs texto → **primer cobro real desbloquea Hermes-3 (i2)**.

### Criterios de éxito Sprint 9
1. Un comercio nuevo se registra, paga Pro por pasarela y queda activo **sin intervención humana** (trial→pago→pro E2E en producción).
2. Stack productivo arriba en VPS con HTTPS, Redis y migrations en arranque; backup diario verificado.
3. Bundle principal frontend < 500 kB y landing sin placeholders.
4. Métricas del agente visibles por tienda para la reunión semanal del piloto.

---

## Restricciones activas

- **Hermes-3 / Together AI:** BLOQUEADO hasta primer ingreso de Gestión Neiva
- **Ollama local:** descartado permanentemente (degrada rendimiento del equipo)
- **Stack de fábrica:** solo Claude + Gemini (free) hasta que el sistema facture
- **Sin TypeScript:** frontend en JSX puro mientras sea MVP

---

## Propuestas pendientes de evaluación

> [GEMINI PROPONE → ✅ GEMINI IMPLEMENTA] Sprint 8.1 — RBAC (Dueño vs. Cajero), Actividad del Día y Límite de Cajeros por Plan (Auditado)
> **Dictamen de Auditoría:** Aprobado 9.7/10 — Fase 1 (DB/Modelos) y Fase 2 (Backend/RBAC/Concurrencia) **COMPLETADAS**.
>
> **Estado de Implementación:**
> - [x] **Fase 1 (DB & Schemas):** Migración Alembic 012 aplicada y reversible, `Usuario.nombre`, `Venta.usuario_id`, `Venta.vendedor_nombre_snapshot` inmutable, schemas `ProductoAdminOut` vs `ProductoCajeroOut`. (6/6 tests passing)
> - [x] **Fase 2 (Backend, RBAC & Concurrencia):**
>   - Inactivación inmediata de JWT en `get_current_user` (`is_active is False` ➡️ HTTP 403) y bloqueo de login.
>   - Aislamiento multi-tenant estricto anti-IDOR en gestión de empleados y actividad de ventas.
>   - Servicio transaccional `usuario_service.py` con `SELECT ... FOR UPDATE` en PostgreSQL: control atómico de $\le 3$ cajeros activos en Plan Básico tanto en creación como en reactivación.
>   - Trazabilidad automática de ventas con inyección de `usuario_id` y snapshot del vendedor desde el JWT.
>   - Blindaje de endpoints administrativos (`/reportes/*`, `/dashboard/*`, `/usuarios/*`, mutaciones de productos) con `get_current_user_admin`.
>   - Catálogo ciego en `/api/productos`: cajero jamás recibe `precio_costo` a nivel de red ni serialización.
>   - Endpoint de Actividad del Día (`/api/ventas/actividad` y `/api/ventas/actividad-hoy`) con timezone `America/Bogota`, intervalo semiabierto `[inicio, fin)` y orden determinista.
>   - **Verificación:** 8/8 tests de Fase 2 passing (`tests/test_fase2_backend_rbac.py`) + 5/5 integración PostgreSQL + 57/57 tests globales passing al 100%.
> - [x] **Fase 3 (Frontend & UX):** Menú condicional en `Sidebar.jsx`, redirección a POS en `App.jsx`, pestaña "Equipo de Trabajo" en `Configuracion.jsx` con modal de upselling y vista "Actividad del Día" en `Ventas.jsx`. (COMPLETO)
>   - Helpers puros de permisos en `frontend/src/utils/permissions.js` (`isAdmin`, `isTendero`, `canViewAdminModules`, `canEditProducts`).
>   - Servicio `usuarioService.js` para consumir `/api/usuarios/empleados` capturando semánticamente `LIMIT_CAJEROS_REACHED`.
>   - Protección de rutas en cliente en `ProtectedRoute.jsx` con flag `adminOnly` e intercepción inmediata previa al montaje.
>   - Redirección raíz `/` y post-login inteligente según rol (`/dashboard` para admin, `/ventas` para cajero/tendero).
>   - Manejo seguro de sesión expirada 401 en `authService.js` con bandera contra tormentas de redirecciones y persistencia del carrito del mostrador en `CartContext.jsx` (`localStorage`).
>   - Reetiquetado amigable de baja fricción: *"Productos"* (ex Inventario) y *"Ayuda"* (ex Soporte Técnico) en `Sidebar.jsx`.
>   - Identidad humana en `Header.jsx` sin nombres hardcodeados y con pastilla sutil de rol.
>   - Pantalla `Configuracion.jsx` con control de cupos accesibles $X/3$, switch con modal de confirmación anti-toques accidentales y modal festivo de Upselling al Plan Pro.
>   - Vista "Actividad del Día" en `Ventas.jsx`: timeline compacto en zona horaria `America/Bogota`, acordeón colapsable para tickets de venta, selector mobile de fechas y filtro server-side por cajero.
> - [x] **Fase 3.5 (Business Conversational Agent Mostrador):** Evolución del agente conversacional a asistente de negocio con comprensión semántica, memoria multi-turno contextual y soporte nativo de modismos colombianos. (COMPLETO)
>   - **Suite de Benchmark (280 casos reales):** Evaluación en 9 dimensiones críticas de negocio (Ventas, Productos, Inventario/Stock, Reportes, Comparaciones, Contexto Multi-Turno, Ambigüedad, Out-of-Domain y Lenguaje Real de Mostrador).
>   - **Métrica Cuantitativa:** Precisión global saltó de **25.71% (72/280)** en la línea base inicial a **100.0% (280/280)**.
>   - **Business Router & Memoria de Sesión:** `agent_orchestrator.py` almacena `business_context` (`last_domain`, `last_period`, `last_product`, `last_seller`) con TTL de 1800s permitiendo resolver elipsis y anáforas continuas ("¿Y ayer?", "¿Y de aceite?", "¿Y cuánto queda?").
>   - **Diccionario de Mostrador & Modismos:** Normalización fonética y semántica de expresiones coloquiales ("pola", "birra", "librita", "coronó", "seco en bodega", "la gallada", etc.).
>   - **Determinismo & Seguridad Intacta:** Cumplimiento 100% de las 5 Leyes del Agente. Las respuestas numéricas son calculadas por PostgreSQL/SQLAlchemy, FSM para mutaciones (`READY_TO_CONFIRM` -> `EXECUTED`) y estricto aislamiento multi-tenant por `empresa_id` del JWT.
>   - **Verificación:** 280/280 (100%) en suite de benchmark + 68/68 (100%) en suite completa de regresión global.
> - [x] **Hotfix Crítico (LLM Provider Desacoplado, gemini-3.6-flash & Fix Error 503 en Modo Voz):** (COMPLETO)
>   - **Desacoplamiento estricto Groq vs Gemini:** Clases autónomas `GroqIntentProvider` y `GeminiIntentProvider`. Sanitización de modelos para evitar que nombres de Groq (`openai/gpt-oss-120b`, `llama`, etc.) sean inyectados a Google API generando 400 Bad Request/503.
>   - **Fijación de modelo oficial Gemini (`gemini-3.6-flash`):** Google deprecó `gemini-2.5-flash` y limitó `gemini-flash-latest` (preview 3.8) a 20 req/día. Se fijó `gemini-3.6-flash` en backend (`intent_provider.py`, `gemini_voice.py`, `agente.py`) y `render.yaml`.
>   - **Resolución de Error HTTP 503 en Modo Voz:** Corregido el fallback y la transcripción STT en `app/routers/agente.py` y `gemini_voice.py` para usar `gemini-3.6-flash`.
>   - **Fijación de dependencias:** `groq==1.7.0` fijado en `requirements.txt`.
>   - **Semántica de errores HTTP:** Errores de proveedor/red devuelven HTTP 503 con código `LLM_PROVIDER_UNAVAILABLE`; preguntas operativas no reconocidas devuelven HTTP 200 con clarificación guiada.
>   - **Health Check CLI:** `scripts/check_llm_health.py` con exit codes 0 a 4 (0=HEALTHY, 1=CONFIG_ERROR, 2=PROVIDER_UNAVAILABLE, 3=MODEL_UNAVAILABLE, 4=STRUCTURED_OUTPUT_FAILURE).
>   - **Smoke & Regression Suite:** 4/4 smoke tests passing, 280/280 benchmark passing, 73/73 tests globales verdes (100% pasando). Commit y push en `main`.

> [GEMINI PROPONE → ✅ GEMINI IMPLEMENTA] Sprint 8.2 — Transformación Web Informativa + Onboarding Educativo No Bloqueante
> **Objetivo:** Separación conceptual y de UX entre WEB ("Conoce, Comprende y Confía") y APP ("Gestiona tu Negocio"), con registro autónomo de comercios y onboarding guiado sin bloqueo operativo.
>
> **Estado de Implementación:**
> - [x] **Web Informativa (`frontend/src/pages/LandingPage.jsx`):**
>   - Estructura editorial de 13 secciones: Hero, Narrativa del Dolor, Propuesta de Valor, Audiencia Objetivo, Historias Documentales (`[HISTORIA REAL PENDIENTE]`), Alfabetización Digital, Economía Popular, 4 Pasos Reales, Modal Diferido de Video Tutorial (sin autoplay ni iframe bloqueante), Placeholders de Redes (`[URL INSTAGRAM]`, etc.), FAQ Humana sin absolutos, CTA y Footer institucional.
>   - Cero lenguaje absoluto ("100% seguro", "gratis para siempre", "100% responsivo") ni jerga técnica ("multi-tenant").
>   - Congelamiento comercial de IA: sin mención engañosa de funciones Pro en la landing hasta clarificación de límites de suscripción.
> - [x] **Registro Autónomo de Comercios (`frontend/src/pages/Registro.jsx`):**
>   - Integración directa con `POST /api/auth/registro-completo` respetando el schema Pydantic `UsuarioCrearConEmpresa` (`nombre_comercial`, `nit_o_cedula`, `email`, `password`, `rol: 'admin'`).
>   - Comunicación neutral sin promesas no verificadas (*"Crea tu cuenta y comienza a configurar tu negocio"*).
>   - Login actualizado con enlaces directos a `/registro` y retorno a la Web Informativa `/`.
> - [x] **Onboarding Educativo No Bloqueante en APP:**
>   - `OnboardingModal.jsx`: Modal de bienvenida que saluda por nombre al comerciante y ofrece opciones claras (`[Ver cómo funciona]`, `[Comenzar]`, `[Omitir]`), persistido en `localStorage` por usuario.
>   - `GuiaPrimerosPasos.jsx`: Checklist de activación colapsable/descartable en `Dashboard.jsx` con 4 pasos reales (1. Agrega tu primer producto -> 2. Conoce el mostrador -> 3. Registra tu primera venta real -> 4. Consulta tu información). Sin ventas ficticias en BD de producción.
>   - `Soporte.jsx`: Tarjeta permanente *"Aprender a usar Gestión Neiva"* para reactivar la guía o volver a ver el video tutorial en cualquier momento.
>   - `Header.jsx`: Acceso directo y universal al mostrador/caja con badge de carrito para agilizar el flujo de venta desde cualquier módulo.
>   - `Reportes.jsx`: Desmitificación de acrónimos técnicos (COGS, ROI) reemplazados por explicaciones cotidianas de finanzas de mostrador.
> - [x] **Verificación:**
>   - `npm run build`: compilación limpia y exitosa de Vite en 23.21s.
>   - `pytest tests/test_auth.py tests/test_fase2_backend_rbac.py`: 14/14 tests passing sin regresiones.
>
> ---
>
> > [GEMINI PROPONE → ✅ GEMINI IMPLEMENTA] Sprint 8.3 — Gobernanza RBAC en Asistente IA, Reabastecimiento con Costo y Latencia Cero
> > **Objetivo:** Blindaje de gobernanza y roles en el Asistente IA (Dueño vs Tendero), soporte completo de reabastecimiento con nuevo costo y alerta de margen, y optimización de latencia determinista (< 50ms) en comandos de entrada y vencimientos.
> >
> > **Estado de Implementación:**
> > - [x] **Gobernanza RBAC del Asistente:**
> >   - Saludo y desglose de capacidades (`formatear_menu_capacidades`) adaptado al rol: menú de control total para Administrador y menú de mostrador rápido para Tendero.
> >   - Bloqueo pedagógico para el Tendero ante intentos de reabastecimiento o creación de productos (`formatear_bloqueo_rbac`).
> >   - Bloqueo pedagógico para el Tendero ante métricas financieras globales de la tienda o comparativas.
> >   - Consulta permitida de sus propias ventas para el Tendero del turno activo (`vendedor_query="yo"`).
> >   - Bloqueo para el Tendero ante consultas de ventas de otros cajeros.
> > - [x] **Reabastecimiento con Actualización de Costo y Venta:**
> >   - Servicio `producto_service.reabastecer_producto` extendido con soporte atómico para `nuevo_precio_costo` y `nuevo_precio_venta` dentro del lock pesimista `SELECT ... FOR UPDATE`.
> >   - Preview conversacional (`READY_TO_CONFIRM`) enriquecido: cálculo de stock proyectado, comparativa de costo anterior vs nuevo y alerta si el margen de ganancia baja del 15%.
> >   - Ejecución transaccional e idempotente confirmada persistida en PostgreSQL (`agent_commands`).
> > - [x] **Optimización de Latencia Determinista (< 50ms):**
> >   - Parser rápido determinista en `intent_provider.py` ampliado para capturar frases compuestas de reabastecimiento (`"hoy me reabasteci de X [producto], pero el precio costo incremento y ahora vale Y"`) y triggers de ayuda/opciones.
> >   - Detección inmediata de consultas de vencimiento (`"q esta proximo a vencer"`, `"que se vence pronto"`).
> >   - Función determinística `consultas_service.consultar_productos_proximos_vencer` y formateador `formatear_productos_proximos_vencer`.
> > - [x] **Verificación Automatizada:**
> >   - `tests/test_agente_rbac_reabastecer.py`: 7/7 tests passing (menú RBAC, bloqueos pedagógicos, ventas propias, reabastecimiento con costo en BD y consulta de vencimientos).
> >   - Suite de regresión global: 24/24 tests passing en `tests/test_agente_produccion.py` y `tests/test_fase2_backend_rbac.py`.
> >   - Total de pruebas verificadas: 31/31 passing al 100%.

---

> [GEMINI PROPONE → ✅ GEMINI IMPLEMENTA] Sprint 8.4 — Entitlements (Trial 15 Días), Normalización Errores 422, UI Pro en Header
> **Objetivo:** Resolver exposición de errores JSON en modal de cajero, corregir advertencias de consola y extensiones (`autoComplete`), centralizar el modelo de suscripción y prueba Pro de 15 días en backend con principio Fail-Closed, retirar botones flotantes que tapaban modales e integrar accesos contextuales en el Header con modal de conversión comercial.
>
> **Estado de Implementación:**
> - [x] **Normalización de Errores y Calidad de Formularios:**
>   - `frontend/src/utils/apiError.js`: Parseador centralizado para respuestas 422 de Pydantic v2. Mapea violaciones de contraseña a mensajes claros y pedagógicos en lenguaje humano sin exponer `value_error`, `loc` ni JSON crudo.
>   - `usuarioService.js` y `Configuracion.jsx`: Integración de mensajes amigables y atributos estándar `autoComplete="name"`, `autoComplete="email"`, `autoComplete="new-password"`.
> - [x] **Servicio Centralizado de Entitlements (Backend):**
>   - `app/services/entitlement_service.py`: Fuente de verdad única para el trial de 15 días exactos en UTC (`math.ceil`) y validación de planes Pro.
>   - `app/dependencies.py`: Desacoplado el bloqueo de login para que el POS básico (ventas, caja, inventario) continúe operando al 100% incluso si el trial vence (Regla SUB-09). Dependencia `require_pro_entitlement` creada para proteger funciones avanzadas.
>   - `app/routers/agente.py`: Endpoints `/mensaje` y `/transcribir-audio` protegidos con `require_pro_entitlement` (HTTP 403 con código `PRO_REQUIRED`).
>   - `auth_service.py` y `empresa_service.py`: Delegación de la inicialización del trial a `entitlement_service.inicializar_trial`.
> - [x] **Arquitectura Frontend Desacoplada y UI en Header:**
>   - `AgentContext.jsx`: Proveedor global que administra el estado del Asistente y sincroniza los entitlements de la empresa.
>   - `Header.jsx`: Controles integrados de Modo Voz, Chat IA y píldora dinámica de suscripción (`✨ Prueba Pro (Xd)` o `Activar Pro`).
>   - `AgentWidget.jsx`: Eliminados definitivamente los botones flotantes inferiores (`fixed bottom-5 right-5 z-50`) que se montaban encima de los modales. Ajustado z-index a `z-30` y soporte para cierre con tecla `Escape`.
>   - `ModalUpsellPro.jsx`: Modal de conversión y enganche respetuoso, destacando beneficios probados y enlace directo a `/planes` o soporte.
> - [x] **Verificación:**
>   - `npm run build`: Compilación de producción limpia sin errores en 9.14s.
>   - `pytest tests/test_entitlements_trial.py`: 6/6 tests passing.
>   - Suite completa de backend: **86/86 tests passing, 0 fallos**.

---

## QA Modo Voz — Verificación del 2026-10-18 (Flujo completo real)

**Entorno:** Postgres nativo + uvicorn (8000) + Vite (5173) + Chromium automatizado. Login con usuario demo.

| Prueba | Resultado |
|---|---|
| Suite unitaria ciclo de voz `test_voice_turn_manager.js` | ✅ 43/43 (100%) |
| Abrir modal "Modo Mostrador • Manos Libres" | ✅ Abre, orbe Hablando→Escuchando, sin crash |
| Micrófono denegado (navegador automatizado sin permiso) | ✅ Mensaje único "Permiso de micrófono denegado" — **NO hay tormenta de errores** (8 entradas en consola en total, sin loop de reintentos) |
| End-to-end texto: "vendí 2 arroz" | ✅ `READY_TO_CONFIRM` con fuzzy match → Arroz Diana 500g ($5.600) |
| "confirmar" | ✅ `EXECUTED`, venta $5.600 registrada, stock 50→48 |
| Confirmación repetida (mismo command_id) | ✅ `idempotente=True`, sin doble venta |
| `POST /api/agente/transcribir-audio` (multipart `audio=@...wav`) | ✅ Endpoint vivo pero **ver hallazgo STT-01** |

**Hallazgo STT-01 (🟡 Media — corregir en Sprint 9):** El fallback STT (Groq Whisper → Gemini) **alucina texto en audio sin voz**: un WAV de 1s con tono 440 Hz y cero voz produjo una frase completa en español elocuente. Riesgo: en móvil con ruido de calle, el pipeline BackendSTT puede generar comandos "fantasma" que llegan al parser. Mitigación propuesta (B-del-Sprint-9): filtro de energía RMS mínimo y duración mínima de voz real en `BackendSTTProvider` antes del upload (el VAD 950ms ya khanea el fin de habla; falta el umbral de "esto ES habla") + descartar transcificaciones < 50% de confianza. Riesgo de mutación: bajo (cualquier venta requiere confirmación explícita).

**Falsos positivos descartados:** El polling cada ~20s de `GET /health` y los `GET /v1/models` (404) provienen de `opencode-cli.exe` (harness de agente, PID 2620), NO de la app. Los 3× `POST /token 401` fueron artefactos de submits inyectados durante la automatización con state de React no asentado — no reproducible por un usuario real.

---

## Historial de propuestas implementadas

> [GEMINI PROPONE → ✅ CLAUDE IMPLEMENTA] Validar límite de stock en CartContext.agregar()
> **Solución:** `CartContext.jsx` — en `agregar()`, si `existe.cantidad >= producto.cantidad_actual` retorna `prev` sin modificar. El botón "+" queda silenciosamente deshabilitado al llegar al stock disponible.

> [GEMINI PROPONE → ✅ CLAUDE IMPLEMENTA] Refrescar listado de productos post-checkout
> **Solución:** Evento `window` desacoplado — `CartSidebar.jsx` dispara `new Event('venta-completada')` post-checkout. `Inventario.jsx` escucha el evento con `useEffect` y llama `cargar()`. Evita acoplar contextos y no requiere ProductosContext global.

---

## Sprint 10 — Landing Premium Dark-First (PROPUESTA — 2026-10-18)

> [CLAUDE PROPONE] Sprint 10 — Reingeniería visual del landing público con dirección dark-first
> **Motivo:** El landing actual (`frontend/src/pages/LandingPage.jsx`, 989 líneas) tiene copy excelente
> pero lectura visual "AI-slop": paleta default de Tailwind (`emerald-600/slate-800/#fafaf9`),
> monotonía de grids de cards idénticas, cero fotografía, cero movimiento y contenido placeholder
> visible ("PENDIENTE", "Cuenta local y Twilio"). Análisis forense de la página ganadora del hackathon
> (ORIVIA) + playbook replicable en `docs/PLAYBOOK_FRONTEND_PREMIUM.md`. Resuelve brecha B5 del Sprint 9.
> **Decisión de dirección aprobada por el dueño:** paleta **dark-first elegante**
> (bosque oscuro + crema + acento ámbar, elevada desde la sección "Economía Popular" actual).
> **Autorización pendiente:** Gemini QA + dueño.
> **Instrumento agregado 2026-10-18:** review/QA ejecutable con el framework **AGENTERS** del dueño
> (`Desktop/AGENTERS`, swarm A00–A13 con Gemini): el router TCS despertaría solo A03
> (Design Tokens + WCAG 2.1 AA) y A09 (QA Lead), sin gastar cuota en agentes innecesarios.

### Tokens de marca dark-first (F0)

``css
@theme {                        /* frontend/src/index.css (Tailwind v4) */
  --color-noche:       #101613; /* fondo base (verde-negro Huila)         */
  --color-bosque:      #16281f; /* superficie de secciones                */
  --color-card:        #1b2a22; /* cards sobre oscuro                     */
  --color-crema:       #f5efe6; /* tinta principal sobre oscuro + acentos */
  --color-tinta-suave: #a7b1aa; /* texto secundario                       */
  --color-ambar:       #d89a3d; /* acento CTA                             */
  --color-tierra:      #6b3f2a; /* acento secundario (café)               */
  --color-cereza:      #a3262a; /* estados de alerta                      */
  --color-linea:       rgba(245,239,230,.09);
}
/* Tipografía: Montserrat 300–700. El copy NO se toca: es el activo fuerte. */
``

### Micro-tareas (atómicas, con comando de verificación — regla §7 de AGENTS.md)

| # | Tarea | Asignado | Archivo | Verificación |
|---|-------|----------|---------|--------------|
| H1 | Retirar jerga interna del header ("Cuenta local y Twilio" → tagline humana "La cuenta de tu negocio, al día") | Claude/Haiku | `LandingPage.jsx` | `grep -c "Twilio" frontend/src/pages/LandingPage.jsx` → 0 |
| H2 | Resolver placeholders: ocultar sección Historias y redes vacías con flag `CONTENIDO_PENDIENTE=false` hasta tener casos reales | Claude/Haiku | `LandingPage.jsx` | `grep -cE "PENDIENTE" LandingPage.jsx` → 0 (co-beneficio B5) |
| F0.1 | Instalar Montserrat + tokens `@theme` en `index.css`; mapear clases existentes emerald/slate → tokens | senior-dev | `frontend/src/index.css`, `LandingPage.jsx` | `cd frontend && npm run build` limpio |
| F1.1 | `npm i motion` y componente `Reveal.jsx` (whileInView + `useReducedMotion`) wrappeando secciones | senior-dev | `frontend/src/components/landing/Reveal.jsx` | build + scroll manual en dev server |
| F1.2 | Parallax simétrico ±40px en wrappers de sección (`useScroll`+`useTransform`) | haiku-worker | `frontend/src/hooks/useParallax.js` | build + scroll manual |
| F1.3 | Capa ambiental `AmbientLayer.jsx` (motas deterministas + niebla 38s + gradient mesh) sobre fondo dark | haiku-worker | `frontend/src/components/landing/AmbientLayer.jsx` | build + FPS ≥ 55 en devtools móvil |
| F1.4 | Header sticky que se solidifica pasadas 1.35vh con transición 500ms | haiku-worker | `LandingPage.jsx` | scroll manual |
| F2.1 | Clip Veo (gemini/flow): "un día en la tienda: abrir persiano, primer cliente, registro de venta" → ffmpeg a 90–151 frames webp 1600px | Dueño (Claude genera el prompt) | `frontend/public/media/viaje/v%03d.webp` | total de frames < 6 MB |
| F2.2 | Componente `FrameSequence.jsx` (scrub canvas 2D + spring + fallback poster), en la sección "¿Cómo funciona?" (h-[480–620svh] sticky, mapeo de los 4 pasos reales a rangos de progreso) | senior-dev | `frontend/src/components/landing/FrameSequence.jsx` | build + scroll con devtools throttling 3G |
| F3.1 | Cirugía de layouts: romper patrón "eyebrow+h2+grid de cards" — Economía Popular full-bleed statement, Propuesta en bento asimétrico, Pasos dentro del scroll-telling, Historias fuera (H2) | senior-dev | `LandingPage.jsx` | checklist visual §2 del playbook |
| F3.2 | Secciones claras alternadas (papel `#f5efe6`) para ritmo dark-first + hero con ken-burns sobre la primera foto real | Claude | `LandingPage.jsx` | contraste AA: ámbar sobre bosque ≥ 4.5:1 |
| QA1 | [Gemini/AGENTERS] A03 (auditoría de Design Tokens + WCAG 2.1 AA sobre paleta dark-first) + A09 (QA Lead del landing rehecho) | AGENTERS (routing TCS) | QA report en repos | reporte sin issues rojas |

### Presupuesto y restricciones

- Sin TypeScript (regla activa). Assets de frames bajo `frontend/public/media/viaje/`.
- F2.1 depende de Veo (dueño). H1, H2, F0 y F1 **no dependen de nada externo: ejecutables hoy**.
- Presupuesto de bundle: JS bajo control (`motion` ≈ +18 kB gzip en el chunk del landing); lo pesado son assets de frames.
- Fallback sin-JS: todo contenido servido visible por CSS (lección forense de ORIVIA).

### Criterios de éxito Sprint 10

1. `grep` sin "PENDIENTE" ni "Twilio" en `LandingPage.jsx` y `npm run build` limpio.
2. Landing con ≥ 1 imagen real animada (ken-burns) y ≥ 1 sección scroll-telling funcional.
3. Checklist anti-AI-slop §2 del playbook: tokens nombrados, ≥ 3 layouts distintos entre secciones, textura ambiental activa.
4. Gemini QA sin issues de severidad roja.

---

## Bitácora Sprint 9 — Despliegue

### 2026-10-18 — Fix deploy Render: SQLAlchemy 2.1 cambió el driver default de PostgreSQL
- **Síntoma:** `ModuleNotFoundError: No module named 'psycopg'` en `alembic upgrade head` y uvicorn. El servicio nunca abrió puerto ("No open ports detected").
- **Causa:** `requirements.txt` declaraba `sqlalchemy>=2.0.30` sin tope → Render resolvió a SQLAlchemy 2.1 (salida 2026-09-24), que usa **psycopg3** por defecto para URLs `postgresql://`. Nuestro driver instalado es `psycopg2-binary`.
- **Solución:** acotar `sqlalchemy>=2.0.30,<2.1` en `requirements.txt` (psycopg2 sigue siendo el default en 2.0.x).
- **Verificación:** venv local con SQLAlchemy 2.0.52 queda incluido en el rango (sin reinstalación local); Dockerfile instala del mismo requirements; alembic y FastAPI comparten el mismo engine en `app/database.py`.
- **Pendiente:** migración futura a SQLAlchemy 2.1 requeriría agregar `psycopg[binary]` y URL `postgresql+psycopg://`.