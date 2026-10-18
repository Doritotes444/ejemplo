# AGENTS.md — Protocolo de colaboración Claude + Gemini

> Documento vivo. Ambos AIs pueden proponer cambios marcándolos con  
> `> [CLAUDE PROPONE]` o `> [GEMINI PROPONE]` + justificación.

---

## 1. El equipo

Este proyecto tiene dos IAs trabajando como co-autores:

| Agente | Dónde vive | Fortaleza principal |
|--------|-----------|---------------------|
| **Claude** (Sonnet/Opus/Haiku) | Claude Code en Codespaces | Implementación, arquitectura, ejecución de comandos |
| **Gemini** | Antigravity editor (editor de código con integración Gemini nativa) | Análisis de codebase grande, QA, review, propuestas de plan |

Ninguno es el jefe del otro. Gemini no solo sigue órdenes de Claude — puede proponer cambios al plan, señalar problemas, y agregar valor desde su perspectiva.

---

## 2. División de responsabilidades

### Claude hace

- Escribe código y lo ejecuta (Bash, Edit, Write)
- Toma decisiones de arquitectura cuando hay trade-offs de implementación
- Registra cambios en `PLAN_ACTIVO.md` después de implementar
- Hace commit y push al final de cada sprint
- Invoca agentes Haiku para boilerplate cuando corresponde

### Gemini hace

- Lee y analiza el codebase completo (su ventana de 1M tokens lo hace eficiente para esto)
- Revisa calidad del código generado (QA paso 7 del pipeline)
- Propone cambios y mejoras al `PLAN_ACTIVO.md`
- Analiza requirements de clientes y los estructura en JSON para el Architect
- Señala inconsistencias entre el plan y el código real

### Ambos hacen

- Proponer mejoras al plan (`PLAN_ACTIVO.md`)
- Evaluar trade-offs de diseño
- Documentar decisiones relevantes

---

## 3. Cómo proponer cambios al plan

Si Gemini o Claude quiere proponer un cambio en `PLAN_ACTIVO.md`:

1. Agregar el bloque al archivo con el marcador correspondiente:

```markdown
> [GEMINI PROPONE] Agregar validación de stock en frontend antes del checkout
> **Motivo:** Actualmente el usuario puede agregar más unidades al carrito de las que hay en stock.
> **Propuesta:** En CartContext.agregar(), verificar que cantidad + existente <= producto.cantidad_actual
> **Impacto:** Evita errores 400 en checkout, mejor UX
```

2. En la próxima sesión activa del otro AI, evalúa la propuesta:
   - Si la acepta: implementa y remueve el marcador `[PROPONE]`
   - Si la rechaza: responde con `> [RECHAZADO]` + motivo y lo quita del plan

---

## 4. Pipeline de la fábrica — quién hace qué

Para cada sistema nuevo que genere la fábrica:

```
Paso 1  [Gemini]    Requirements → JSON estructurado
        Input: documento del cliente (texto libre)
        Output: factory/jobs/{sistema}/requirements.json

Paso 2  [Architect/Claude Sonnet]  Schema DB + contratos API
        Input: requirements.json
        Output: factory/jobs/{sistema}/schema.md + api-contracts.md

Paso 3  [Haiku Worker ×3]  Backend boilerplate
        Input: schema.md + api-contracts.md
        Output: models.py, schemas/, migrations/

Paso 4  [Haiku Worker ×3]  Routers + services
        Input: api-contracts.md + models.py
        Output: routers/, services/

Paso 5  [Claude Sonnet]  Frontend
        Input: api-contracts.md + components-list.md del tier
        Output: pages/, components/, hooks/

Paso 6  [Haiku Worker]  Tests
        Input: routers/ + services/
        Output: tests/

Paso 7  [Gemini]  QA review
        Input: todo el código generado
        Output: factory/jobs/{sistema}/qa-report.md + lista de fixes

Paso 8  [Haiku Worker]  DevOps
        Input: stack definido
        Output: docker-compose.yml, README.md, .env.example
```

---

## 5. Cuándo usar cada modelo Claude

| Tarea | Modelo recomendado | Por qué |
|-------|-------------------|---------|
| Diseño de schema DB | Sonnet o Opus | Requiere razonamiento profundo sobre relaciones |
| Contratos API | Sonnet | Trade-offs de diseño REST |
| Schemas Pydantic | Haiku | Boilerplate predecible, barato |
| Migraciones Alembic | Haiku | Plantilla estándar |
| Routers FastAPI simples | Haiku | CRUD predecible |
| Lógica de negocio compleja | Sonnet | Necesita entender edge cases |
| Componentes React UI | Sonnet | Interacción de estado, UX |
| Tests unitarios | Haiku | Estructura predecible |
| Review de sistema completo | Gemini | 1M tokens, gratis |
| Análisis de requirements | Gemini | Lectura de documentos largos |

---

## 6. Convenciones de comunicación entre sesiones

Dado que Claude y Gemini no comparten memoria en tiempo real, la coordinación se hace via archivos commiteados:

- `PLAN_ACTIVO.md` — estado del sprint activo y siguientes tareas
- `AGENTS.md` — este archivo (protocolo de coordinación)
- `factory/jobs/{sistema}/` — estado de cada sistema en construcción
- `git log` — historial de lo que cada AI implementó

**Regla:** Al final de cada sesión de trabajo, el AI que actuó debe:
1. Actualizar `PLAN_ACTIVO.md` con lo que completó
2. Hacer commit con mensaje descriptivo
3. Dejar comentario sobre qué viene después

---

## 7. Metodología de Trabajo (Inspirada en Superpowers)

Para evitar el "token burn" y garantizar código robusto, ambos agentes deben adherirse a esta metodología manual:

1. **Cero código sin diseño previo (Brainstorming):** Nunca empezar a escribir archivos sin antes tener un plan en `PLAN_ACTIVO.md`. Gemini hace el rol de estructurar el diseño; Claude lo implementa.
2. **Micro-tareas:** Los pasos en `PLAN_ACTIVO.md` deben ser tareas diminutas y atómicas (no "crear módulo de ventas", sino "crear endpoint POST /ventas").
3. **Verificación Explícita (Verification Before Completion):** Todo paso en `PLAN_ACTIVO.md` debe incluir un comando de verificación exacto. Claude *no puede* marcar un paso como ✅ sin antes haber ejecutado ese comando y visto el resultado exitoso.
4. **TDD pragmático (Test-Driven Development):** Siempre que sea posible, escribir el test unitario *antes* que la implementación. Si el proyecto aún no tiene tests formales, la prueba manual (ej: `curl`, script en python, o test por consola) debe fallar primero, y luego pasar al escribir la función.

---

## 8. Restricciones actuales

- **Hermes-3 (Together AI):** BLOQUEADO hasta primer ingreso del sistema
- **Ollama local:** descartado — degrada rendimiento del equipo de forma exponencial
- **Stack actual:** Claude (Opus/Sonnet/Haiku) + Gemini (free tier). Cero APIs pagas adicionales.

Cuando Gestión Neiva genere su primera factura real, se activa Hermes-3 para el tier professional.

---

## 9. Integración AGENTERS (aprobada por dueño — 2026-10-18)

> Origen: framework `Desktop\AGENTERS` del dueño — swarm de 14 agentes (A00–A13) guiado por grafos.
> **Decisión de integración:** adoptamos los **conceptos** de AGENTERS (TCS, ContextPackets,
> Zero-Unverified-Decision, telemetría, procedencia), NO su motor Python (Claude CLI ya ejecuta;
> su router por keywords es frágil). Sus 14 roles se **mapean** sobre el equipo existente en §1:

| Rol AGENTERS | Quién lo ejerce aquí | Cobertura |
|---|---|---|
| A00 Orquestador | Claude (descompone tareas, mantiene plan) | Ya se hace en PLAN_ACTIVO |
| A05 Product Owner | Gemini (requirements → JSON) | Paso 1 del pipeline |
| A06 Tech Lead / ADRs | Claude Sonnet | Pasos 2 y 5 |
| A07/A08 Devs | Claude Sonnet + Haiku workers | Pasos 3–6 |
| A09 QA Lead | Gemini | Paso 7 |
| A10/A13 Datos/DBA | Claude Sonnet + Haiku workers | Pasos 2–3 |
| **A04 Seguridad / A12 AppSec** | Gemini (QA ampliado, ver §9.4) | **Brecha nueva — se cubre con esta integración** |
| A03 UX Tokens | Gemini / AGENTERS directo | Ya en uso (Sprint 10) |

### 9.1 TCS-lite — clasificar ANTES de armar pipeline

El pipeline de pasos 1–8 (§4) es para **sistemas nuevos**. No toda tarea lo amerita. Al recibir
cualquier tarea, clasificarla primero:

| Nivel | Criterio | Flujo mínimo |
|---|---|---|
| **MICRO** | 1 archivo aislado, UI pura, copy, typo | Implementación directa + verificación + commit. Bitácora breve, sin tocar plan de sprint |
| **SMALL** | Bugfix cruzado front+back con test | [Claude] implementa + [Gemini] review puntual si hay riesgo |
| **MEDIUM** | Feature nuevo (endpoint + pantalla + test) | Subconjunto del pipeline (2→6) con QA de Gemini enfocado |
| **LARGE/CRITICAL** | Sistema nuevo, migración de esquema | Pipeline completo 1→8 + bitácora detallada + QA seguridad |

El ahorro: no montar la máquina de fábrica para micro-tareas; nunca ahorrar QA en tareas LARGE.

### 9.2 ContextPackets — regla para invocar trabajadores (Haiku/subagents)

Prohibido invocar un trabajador con *"explora el repositorio y deduce"*. Toda invocación debe
llevar un paquete compacto (~300–600 tokens) con campos fijos:

```text
CP-{N}: {objetivo en 1 línea}
ARCHIVOS_OBJETIVO: rutas exactas (crear/editar)
CONTRATOS_RELEVANTES: fragmento de api-contracts.md / schema.md que aplica
RESTRICCIONES: stack vigente + convenciones del módulo (ej: no TypeScript, Tailwind tokens)
VERIFICACION: comando exacto que Claude ejecutará al recibir el entregable
```

Para Gemini (ventana de 1M) NO aplica la poda agresiva: sí puede leer el codebase completo (esa es
su fortaleza según §1). El ContextPacket es para trabajadores baratos y rápidos.

### 9.3 Zero-Unverified-Decision (formaliza §7.3)

Todo entregable pasa 3 puertas antes de marcarse ✅:
1. **Puerta sintáctica:** linter/build compila (ej. `npm run build`, `python -c "import app.main"`).
2. **Puerta determinista:** suite pytest o comando de verificación exacto (§7.3 ya lo exige — se mantiene).
3. **Puerta de registro:** bitácora en PLAN_ACTIVO + commit. Sin registro, la tarea NO está cerrada.

Si una puerta falla → reintento aislado de esa pieza (nunca aceptar "está casi bien").

### 9.4 QA con checklist de seguridad (brecha A04/A12)

Desde ahora, el QA de Gemini (paso 7) incluye, para features que tocan **auth, roles, pagos,
datos de terceros o endpoints públicos**, un mini-checklist:

- [ ] Validación estricta de entrada (Pydantic) en todos los endpoints nuevos
- [ ] Autorización verificada: el recurso pertenece a la empresa del request (multi-tenant leak check)
- [ ] Sin secretos en código ni logs; cabeceras defensivas intactas
- [ ] OWASP rápido: inyección, XSS, SSRF, mass-assignment

Salida: sección `## Seguridad` en `qa-report.md`. Issues rojas = bloqueantes antes del commit de despliegue.

### 9.5 Procedencia EVIDENCED_BY en bitácora

Cuando una tarea modifica lógica existente, la bitácora en PLAN_ACTIVO cita `archivo:línea` del
código fuente real verificado (ej. `app/services/auth.py#L42-L67`). Evita stale context entre
sesiones Claude/Gemini y entre AIs que no comparten memoria tiempo real.

### 9.6 Grafo de proyecto ligero (FASE 2 — pendiente de validar con bitácora nueva)

Si la bitácora + procedencia no bastan contra el staleness, migrar a `factory/PROJECT_GRAPH.json`
(las 7 familias de nodo de AGENTERS: Producto/Arquitectura/Datos/UI/Seguridad/Infra/Evidencia).
**No se implementa ahora** — YAGNI; se corre la fase 1 y se evalúa al cierre del próximo sprint.
