# Handoff — Estado Real y Sincronización de Gestión Neiva

**Fecha de actualización:** 2026-09-28  
**Propósito:** Sincronización viva entre desarrolladores y agentes de IA. Ninguna cifra en prosa sustituye la ejecución de los comandos que miden la realidad.

---

## 1. Comandos de Verificación Rápida (Ejecútalos al iniciar sesión)

Ejecuta estos comandos en la raíz `C:\Users\merid\Documents\GESTION_NEIVA_CLAUDE`:

| Qué quieres saber | Comando exacto (PowerShell) | Resultado esperado |
|---|---|---|
| **¿Pasan las pruebas de Backend?** | `.venv\Scripts\python.exe -m pytest tests/test_auth.py -v` | `6 passed`, `0 failed`, `0 warnings` bloqueantes |
| **¿Compila el Frontend React?** | `cd frontend; npm run build; cd ..` | `Build succeeded`, dist generado |
| **¿Están los servicios arriba?** | `docker compose ps` | Contenedores de Postgres y Redis en `healthy / running` |
| **¿Están las migraciones al día?** | `.venv\Scripts\python.exe -m alembic current` | Muestra la última revisión aplicada |

---

## 2. Estado Real del Sistema (Capacidades Verificadas)

Capacidades ya probadas y operativas en el entorno:

- [x] **Autenticación Multi-Tenant (Sprint 3):** Registro de usuario con empresa asociada, hash seguro de contraseñas, login con JWT, validación de emails duplicados y endpoint `/me` protegido (6/6 tests pasando en `tests/test_auth.py`).
- [x] **Compatibilidad de Tests SQLite:** Pool `StaticPool` y decorador `GUID` para soportar pruebas en memoria sin requerir Postgres local para tests unitarios rápidos.
- [x] **Modelos Base:** `Tenant` (Empresa) y `User` (Usuario) definidos con llaves UUID y banderas de actividad.
- [ ] **Módulo POS de Ventas:** En diseño arquitectónico (Sprint 4).
- [ ] **Control de Stock y Concurrencia:** En diseño arquitectónico (Sprint 4).

---

## 3. Próximo Paso Inmediato (Sprint 4)

1. **Diseñar el contrato de la API de Ventas (`docs/spec/api-contract.md`):** Endpoint `POST /api/v1/sales` con validación atómica de inventario.
2. **Definir el modelo de datos de Venta y Detalle de Venta (`docs/spec/data-model.md`):** Implementar snapshots de precios y relación con `tenant_id`.
3. **Escribir prueba roja de ventas:** Test que intente registrar una venta descontando inventario y falle primero.

---

## 4. Trampas y Lecciones Aprendidas (¡No tropezar aquí!)

- **SQLite vs Postgres:** En SQLite los UUIDs requieren el convertidor `TypeDecorator GUID` configurado en `tests/conftest.py`. No uses tipos nativos de Postgres directamente en modelos si pretendes correr tests rápidos en memoria SQLite.
- **Server Defaults:** SQLite no siempre resuelve los `server_default` en modelos en memoria; los servicios deben inicializar explícitamente `is_active=True`.
- **Sesión de BD:** Todo endpoint nuevo debe usar `get_async_db` para no incurrir en bloqueos con la sesión síncrona legada.
