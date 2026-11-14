# Arquitectura y Modelo de Datos — Tiendapp Vanilla FIFO

## 1. Principios de Diseño

1. **Cero Sobreingeniería:** Interfaz estática 100 % HTML5, CSS3 y Vanilla JavaScript (ES Modules), sin dependencias de compilación ni bibliotecas externas.
2. **Pantalla Única Integrada:** Tanto el **Tendero** como el **Dueño** operan sobre el mismo documento (`index.html`). Al activar el rol **Dueño**, se habilitan en la misma vista los botones de edición en cada tarjeta y el panel inferior de control de lotes FIFO, conservando intacto el carrito de compra.
3. **Existencias Derivadas de Lotes (FIFO):** El producto ya no almacena un campo fijo `cantidad_actual`. Su disponibilidad se calcula en tiempo real sumando `cantidad_disponible` de sus lotes vigentes (no vencidos).

---

## 2. Almacenes en `IndexedDB` (`tiendapp_vanilla_db`)

### 2.1. `productos`
Datos maestros del artículo:
- `id`: Identificador único (`prd-...`).
- `tienda_id`: Identificador de la tienda local.
- `codigo_barras`: Código EAN/SKU único por tienda.
- `nombre`: Nombre comercial.
- `categoria`: Categoría (`Granos`, `Lacteos`, `Abarrotes`, `Bebidas`, etc.).
- `unidad_medida`: `unidad`, `kg`, `libra`, `litro`, `gramo`, `caja`.
- `precio_venta`: Precio unitario de venta al público (COP).
- `stock_minimo`: Umbral para alerta visual de bajo inventario.
- `es_frecuente`: Booleano para destacar en el mostrador POS.
- `foto_url`: Data URI JPEG comprimido mediante `<canvas>` o `null` (genera avatar SVG automático).

### 2.2. `lotes`
Cada entrada o compra de mercancía genera un lote independiente:
- `id`: Identificador único (`lot-...`).
- `tienda_id`: Tienda propietaria.
- `producto_id`: Referencia al producto.
- `codigo_lote`: Código identificador del lote (ej. `L-ARR-01`).
- `fecha_entrada`: Fecha de ingreso (`YYYY-MM-DD`). Determina la prioridad **FIFO**.
- `fecha_vencimiento`: Fecha opcional (`YYYY-MM-DD` o `null`). Si es anterior a la fecha actual, el lote queda **bloqueado automáticamente** para la venta.
- `costo_unitario`: Costo de compra de esa entrada específica.
- `cantidad_inicial`: Cantidad ingresada originalmente.
- `cantidad_disponible`: Saldo actual del lote.

### 2.3. `ventas`
Incluye el detalle de líneas vendidas (`detalles`) y las asignaciones exactas por lote (`asignaciones_lote` / `AsignacionVentaLote`):
- `id`, `tienda_id`, `fecha_venta`, `total`, `metodo_pago`, `monto_recibido`, `cambio_entregado`, `vendedor_nombre`, `vendedor_rol`, `estado` (`COMPLETADA` | `ANULADA`).
- `detalles[]`:
  - `producto_id`, `producto_nombre`, `cantidad`, `precio_unitario`, `costo_unitario_snapshot`, `subtotal`.
  - `asignaciones_lote[]`: Lista de `{ lote_id, codigo_lote, cantidad_descontada, costo_unitario }`.

### 2.4. `movimientos` (`MovimientoInventario`)
Kardex auditable por lote:
- `id`, `tienda_id`, `producto_id`, `lote_id`, `codigo_lote`, `tipo` (`entrada_lote`, `ajuste_lote`, `venta_fifo`, `anulacion_venta`, `baja_lote`), `cantidad`, `stock_anterior`, `stock_nuevo`, `costo_unitario`, `motivo`, `referencia_id`, `usuario_nombre`, `created_at`.

---

## 3. Regla de Descuento FIFO + FEFO

1. Se filtran los lotes del producto con `cantidad_disponible > 0` y que **no estén vencidos** (`fecha_vencimiento === null || fecha_vencimiento >= hoy`).
2. Se ordenan por:
   - `fecha_entrada` ascendente (**FIFO**: primero en entrar, primero en salir).
   - En caso de empate en la fecha de entrada, `fecha_vencimiento` más próxima primero (**FEFO**).
3. Se recorre la cola descontando hasta cubrir la cantidad solicitada. Si la suma de lotes vigentes es menor a la cantidad pedida, la venta se rechaza atómicamente sin alterar ningún lote.
4. Si el **Dueño** anula una venta, cada registro de `asignaciones_lote` devuelve su `cantidad_descontada` al `lote_id` original y registra un movimiento `anulacion_venta`.
