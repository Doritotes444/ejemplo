# ADR-001: Estrategia de Aislamiento Multi-Tenant en Gestión Neiva

- **Estado:** Aceptado  
- **Fecha:** 2026-09-28  
- **Decisores:** Equipo de Ingeniería Gestión Neiva  
- **Rige bajo:** `docs/spec/constitution.md` Artículo I  

---

## 1. Contexto y Problema

Gestión Neiva es una plataforma POS SaaS orientada a múltiples tiendas y microempresas en Neiva, Colombia. Cada tienda debe operar con independencia y estricta privacidad sobre su catálogo, precios, ventas y clientes. Debemos seleccionar una estrategia de arquitectura multi-tenant que combine costo eficiente de infraestructura, simplicidad en migraciones y garantía de aislamiento.

---

## 2. Opciones Evaluadas

### Opción A: Base de datos separada por tienda
- **Ventajas:** Aislamiento físico absoluto; fácil respaldo individual por tienda.
- **Desventajas:** Costos muy altos de infraestructura en nube; complejidad extrema para orquestar y aplicar migraciones de Alembic en cientos de bases de datos.

### Opción B: Esquemas separados de PostgreSQL (Schema-per-tenant)
- **Ventajas:** Aislamiento a nivel de esquema en una sola instancia de base de datos.
- **Desventajas:** Overhead de conexiones y tablas duplicadas; migraciones complejas.

### Opción C: Base de datos compartida con discriminador `tenant_id` por fila (Row-Level Multitenancy)
- **Ventajas:** Máxima eficiencia de recursos; una sola base de datos y un solo set de migraciones de Alembic; fácil agregación analítica de plataforma.
- **Desventajas:** Requiere disciplina estricta para garantizar que toda consulta filtre por `tenant_id`.

---

## 3. Decisión Adoptada

Se adopta la **Opción C (Discriminador `tenant_id` por fila)** combinada con **inyección de dependencias estricta en FastAPI**.

1. Cada tabla de negocio incluye la columna `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
2. Los tokens JWT autenticados extraen y validan obligatoriamente el `tenant_id`.
3. Una dependencia centralizada de FastAPI (`get_current_tenant`) proporciona el contexto de empresa a todos los servicios y repositorios.
4. Índices compuestos `(tenant_id, ...)` garantizan que las búsquedas se ejecuten en milisegundos dentro del subconjunto de datos de la tienda.

---

## 4. Consecuencias

### Positivas
- Despliegue económico y escalable en PostgreSQL 16.
- Migraciones con Alembic centralizadas y homogéneas.
- Alta velocidad en consultas mediante índices compuestos bien afinados.

### Mitigaciones de Riesgo
- Pruebas automatizadas de aislamiento (un usuario de Tenant A no puede leer registros de Tenant B por ID).
- Prohibición de endpoints sin filtro de tenant a nivel de revisión de código.
