# Modelo de Datos — Módulo POS & Inventarios (Gestión Neiva)

**Motor:** PostgreSQL 16  
**ORM:** SQLAlchemy 2.0 (Modelos declarativos con `Mapped` y `mapped_column`)  
**Esquema:** Multi-Tenant con discriminador `tenant_id` por fila  

---

## 1. Tablas Principales

### Tabla: `tenants` (Empresas / Tiendas)
| Columna | Tipo | Nulable | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Identificador de la tienda |
| `nombre` | `VARCHAR(150)` | No | | Nombre de la tienda o razón social |
| `nit` | `VARCHAR(30)` | No | UNIQUE | Identificación fiscal |
| `is_active` | `BOOLEAN` | No | DEFAULT `TRUE` | Estado de suscripción |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | No | DEFAULT `NOW()` | Fecha de registro |

### Tabla: `productos`
| Columna | Tipo | Nulable | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Identificador único del producto |
| `tenant_id` | `UUID` | No | FK -> `tenants(id)` | Tienda dueña del producto |
| `codigo_barras` | `VARCHAR(60)` | Sí | | Código de barras o SKU |
| `nombre` | `VARCHAR(150)` | No | | Nombre descriptivo |
| `precio` | `NUMERIC(12, 2)` | No | CHECK (`precio` >= 0) | Precio de venta actual |
| `costo` | `NUMERIC(12, 2)` | No | CHECK (`costo` >= 0) | Costo de adquisición |
| `stock` | `INT` | No | CHECK (`stock` >= 0) | Unidades físicas disponibles |
| `is_active` | `BOOLEAN` | No | DEFAULT `TRUE` | Soft delete / estado activo |
| `version` | `INT` | No | DEFAULT `1` | Token de concurrencia optimista |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | No | DEFAULT `NOW()` | Auditoría |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | No | DEFAULT `NOW()` | Auditoría |

### Tabla: `ventas` (Cabecera)
| Columna | Tipo | Nulable | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Identificador de la transacción |
| `tenant_id` | `UUID` | No | FK -> `tenants(id)` | Tienda donde ocurrió la venta |
| `usuario_id` | `UUID` | No | FK -> `usuarios(id)` | Cajero que registró la venta |
| `cliente_id` | `UUID` | Sí | FK -> `clientes(id)` | Cliente (opcional) |
| `medio_pago` | `VARCHAR(30)` | No | | Efectivo, Nequi, Tarjeta, etc. |
| `fecha_venta` | `TIMESTAMP WITH TIME ZONE` | No | DEFAULT `NOW()` | Momento exacto de la venta |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | No | DEFAULT `NOW()` | Auditoría |

> **Nota Constitucional:** No se incluye columna estática `total`. Se calcula sumando `(cantidad * precio_unitario)` de las líneas de detalle.

### Tabla: `detalles_venta` (Líneas de Venta / Snapshot)
| Columna | Tipo | Nulable | Restricción | Descripción |
|---|---|---|---|---|
| `id` | `UUID` | No | PK | Identificador de la línea |
| `tenant_id` | `UUID` | No | FK -> `tenants(id)` | Tienda (desnormalizado para auditoría) |
| `venta_id` | `UUID` | No | FK -> `ventas(id)` ON DELETE CASCADE | Venta asociada |
| `producto_id` | `UUID` | No | FK -> `productos(id)` | Producto vendido |
| `nombre_historico` | `VARCHAR(150)` | No | | **Snapshot:** Nombre del producto al vender |
| `precio_unitario` | `NUMERIC(12, 2)` | No | CHECK (`precio_unitario` >= 0) | **Snapshot:** Precio congelado |
| `cantidad` | `INT` | No | CHECK (`cantidad` > 0) | Cantidad vendida |

---

## 2. Índices de Alto Rendimiento

| Tabla | Columnas | Propósito / Consulta protegida |
|---|---|---|
| `productos` | `(tenant_id, codigo_barras)` | Búsqueda ultrarrápida en caja por lector de código de barras. |
| `productos` | `(tenant_id, is_active, nombre)` | Catálogo y búsqueda por texto en la interfaz del POS. |
| `ventas` | `(tenant_id, fecha_venta)` | Reportes de ventas por turnos, días o rangos de fecha por tienda. |
| `detalles_venta` | `(venta_id)` | Carga inmediata de los productos de un ticket de venta. |
