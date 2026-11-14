-- =============================================================================
-- Migración 001: Esquema Relacional Normalizado — Kairo POS & Inventario
-- Motor: SQLite 3 (Strict Foreign Keys, Transacciones ACID, WAL)
-- =============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL
);

-- 1. Roles Operativos (Exactamente dos: 'dueno' y 'tendero')
CREATE TABLE IF NOT EXISTS roles (
    code        TEXT PRIMARY KEY CHECK (code IN ('dueno', 'tendero')),
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL
);

INSERT OR IGNORE INTO roles (code, name, description) VALUES
    ('dueno',   'Dueño',   'Acceso total al punto de venta, catálogo, inventario, lotes FEFO/FIFO y usuarios.'),
    ('tendero', 'Tendero', 'Acceso exclusivo al módulo de Punto de Venta (POS) y consulta de sus ventas operativas.');

-- 2. Métodos de Pago (Efectivo, Nequi, Daviplata)
CREATE TABLE IF NOT EXISTS payment_methods (
    code          TEXT PRIMARY KEY CHECK (code IN ('efectivo', 'nequi', 'daviplata')),
    name          TEXT NOT NULL UNIQUE,
    requires_cash INTEGER NOT NULL DEFAULT 0 CHECK (requires_cash IN (0, 1)),
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

INSERT OR IGNORE INTO payment_methods (code, name, requires_cash, is_active) VALUES
    ('efectivo',  'Efectivo',  1, 1),
    ('nequi',     'Nequi',     0, 1),
    ('daviplata', 'Daviplata', 0, 1);

-- 3. Usuarios del Sistema
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role_code     TEXT NOT NULL REFERENCES roles(code) ON UPDATE RESTRICT ON DELETE RESTRICT,
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_code);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- 4. Sesiones Autenticadas (Tokens hasheados con SHA-256 en servidor)
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    revoked_at  TEXT,
    ip_address  TEXT,
    user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 5. Categorías de Productos
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT NOT NULL
);

-- 6. Productos
CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    sku         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    barcode     TEXT UNIQUE COLLATE NOCASE,
    name        TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    unit        TEXT NOT NULL DEFAULT 'und' CHECK (unit IN ('und', 'kg', 'lb', 'lt', 'gr', 'caja')),
    sale_price  REAL NOT NULL CHECK (sale_price > 0),
    min_stock   REAL NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 7. Lotes de Inventario (Política FEFO + FIFO)
CREATE TABLE IF NOT EXISTS lots (
    id                 TEXT PRIMARY KEY,
    product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_number         TEXT NOT NULL,
    entry_date         TEXT NOT NULL,
    expiration_date    TEXT,
    unit_cost          REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    initial_quantity   REAL NOT NULL CHECK (initial_quantity >= 0),
    available_quantity REAL NOT NULL CHECK (available_quantity >= 0),
    notes              TEXT,
    created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    UNIQUE (product_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_lots_product ON lots(product_id);
CREATE INDEX IF NOT EXISTS idx_lots_expiration ON lots(expiration_date);
CREATE INDEX IF NOT EXISTS idx_lots_entry ON lots(entry_date);

-- 8. Ventas (Cabecera Transaccional)
CREATE TABLE IF NOT EXISTS sales (
    id                  TEXT PRIMARY KEY,
    folio               TEXT NOT NULL UNIQUE,
    client_operation_id TEXT UNIQUE,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_method_code TEXT NOT NULL REFERENCES payment_methods(code) ON DELETE RESTRICT,
    subtotal            REAL NOT NULL CHECK (subtotal >= 0),
    total               REAL NOT NULL CHECK (total >= 0),
    amount_received     REAL NOT NULL CHECK (amount_received >= 0),
    change_amount       REAL NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
    status              TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (status IN ('COMPLETADA', 'ANULADA')),
    notes               TEXT,
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment ON sales(payment_method_code);

-- 9. Detalles de Venta (Líneas con Snapshot de Nombre y Precio)
CREATE TABLE IF NOT EXISTS sale_items (
    id                    TEXT PRIMARY KEY,
    sale_id               TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id            TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot          TEXT NOT NULL,
    unit_snapshot         TEXT NOT NULL,
    quantity              REAL NOT NULL CHECK (quantity > 0),
    unit_price            REAL NOT NULL CHECK (unit_price > 0),
    subtotal              REAL NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

-- 10. Asignación de Venta por Lote (Trazabilidad FEFO/FIFO por línea vendida)
CREATE TABLE IF NOT EXISTS sale_lot_allocations (
    id           TEXT PRIMARY KEY,
    sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
    lot_id       TEXT NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    lot_number   TEXT NOT NULL,
    quantity     REAL NOT NULL CHECK (quantity > 0),
    unit_cost    REAL NOT NULL CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_allocations_sale_item ON sale_lot_allocations(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_allocations_lot ON sale_lot_allocations(lot_id);

-- 11. Movimientos de Inventario (Kardex Auditable)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    lot_id          TEXT REFERENCES lots(id) ON DELETE SET NULL,
    movement_type   TEXT NOT NULL CHECK (movement_type IN ('ENTRADA_LOTE', 'SALIDA_VENTA', 'ENTRADA_AJUSTE', 'SALIDA_MERMA', 'AJUSTE_DIRECTO')),
    quantity        REAL NOT NULL,
    previous_stock  REAL NOT NULL CHECK (previous_stock >= 0),
    new_stock       REAL NOT NULL CHECK (new_stock >= 0),
    unit_cost       REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    reason          TEXT NOT NULL,
    reference_id    TEXT,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_lot ON inventory_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON inventory_movements(created_at);
