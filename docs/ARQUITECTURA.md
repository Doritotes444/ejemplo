# Arquitectura Técnica y Modelo de Datos — Kairo POS

## 1. Modelo de Datos Relacional (`backend/migrations/001_initial_schema.sql`)

La base de datos relacional SQLite 3 opera con `PRAGMA foreign_keys = ON` y `PRAGMA journal_mode = WAL`.

### Tablas Principales
1. **`roles`**: Catálogo cerrado (`CHECK (code IN ('dueno', 'tendero'))`).
2. **`payment_methods`**: Métodos de pago soportados (`efectivo`, `nequi`, `daviplata`).
3. **`users`**: Usuarios con `username` único, `password_hash` (`PBKDF2-HMAC-SHA256`), `role_code` (`FK -> roles.code`) e `is_active`.
4. **`sessions`**: Sesiones activas en servidor identificadas por `token_hash` (`SHA-256` del token opaco), con `expires_at` y `revoked_at`.
5. **`categories`**: Clasificación de productos (`name` único).
6. **`products`**: Artículos con `sku` único, `barcode` opcional único, `unit` (`und`, `kg`, `lb`, `lt`, `gr`, `caja`), `sale_price` y `min_stock`.
7. **`lots`**: Lotes asociados a cada producto (`product_id`, `lot_number` único por producto, `entry_date`, `expiration_date` opcional, `unit_cost`, `initial_quantity`, `available_quantity`).
8. **`sales`**: Cabecera de venta con `folio` secuencial (`POS-000001`), `client_operation_id` único para idempotencia, `user_id` responsable, `payment_method_code`, `subtotal`, `total`, `amount_received`, `change_amount` y `created_at`.
9. **`sale_items`**: Detalle por línea vendida con snapshot inmutable de nombre, SKU, unidad y precio unitario.
10. **`sale_lot_allocations`**: Desglose exacto de qué lotes y cuántas unidades se descontaron para cada línea de venta.
11. **`inventory_movements`**: Kardex auditable (`ENTRADA_LOTE`, `SALIDA_VENTA`, `ENTRADA_AJUSTE`, `SALIDA_MERMA`, `AJUSTE_DIRECTO`) con saldo anterior, saldo nuevo, costo, motivo y usuario responsable.

---

## 2. Política de Salida de Inventario (FEFO + FIFO)

Al registrar una venta en `POST /api/sales` dentro de una transacción `BEGIN IMMEDIATE`:
1. Se consultan todos los lotes del producto con `available_quantity > 0`.
2. Se **excluyen y bloquean automáticamente** los lotes cuya `expiration_date` sea anterior a la fecha actual (`expiration_date < today`).
3. Los lotes vigentes se ordenan siguiendo la regla **FEFO + FIFO** (`sort_lots_fefo_fifo` en `backend/services.py`):
   - Primero los lotes que tienen fecha de vencimiento, ordenados por `expiration_date ASC` (**FEFO**: primero en vencer, primero en salir).
   - Luego los lotes no perecederos (sin fecha de vencimiento).
   - En caso de empate en vencimiento, se ordenan por `entry_date ASC` (**FIFO**: primero en entrar, primero en salir).
4. Si la suma de existencias vigentes es menor a la cantidad solicitada, la transacción completa hace `ROLLBACK` y devuelve un error `400` detallando el disponible real.
5. Si las existencias son suficientes, se descuentan las unidades de uno o varios lotes en orden, registrando tanto `sale_lot_allocations` como los registros `SALIDA_VENTA` en `inventory_movements`.
