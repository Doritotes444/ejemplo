"""
Capa de Servicios de Dominio y Reglas de Negocio (Backend).
Implementa:
- Inicialización segura del primer usuario Dueño (sin credenciales predeterminadas expuestas)
- Autenticación y gestión de usuarios (Dueño y Tendero)
- Gestión de categorías y productos
- Gestión de lotes con política FEFO (First-Expired, First-Out) + FIFO y bloqueo de vencidos
- Movimientos de inventario auditables (entradas, salidas, mermas, ajustes)
- Registro atómico de ventas con validación en servidor, cálculo confiable e idempotencia
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.database import new_id, now_iso, today_iso
from backend.security import (
    ROLE_DUENO,
    ROLE_TENDERO,
    VALID_ROLES,
    AuthError,
    create_session,
    hash_password,
    require_role,
    revoke_all_user_sessions,
    verify_password,
)


class DomainError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def round_money(val: Any) -> float:
    try:
        n = float(val)
    except (TypeError, ValueError):
        raise DomainError("Importe monetario inválido.")
    return round(n, 2)


def round_qty(val: Any) -> float:
    try:
        n = float(val)
    except (TypeError, ValueError):
        raise DomainError("Cantidad numérica inválida.")
    return round(n, 3)


def validate_date_str(date_str: Optional[str], field_name: str, allow_none: bool = True) -> Optional[str]:
    if date_str is None or str(date_str).strip() == "":
        if allow_none:
            return None
        raise DomainError(f"El campo {field_name} es obligatorio.")
    clean = str(date_str).strip()[:10]
    try:
        datetime.strptime(clean, "%Y-%m-%d")
        return clean
    except ValueError:
        raise DomainError(f"El campo {field_name} debe tener formato YYYY-MM-DD.")


# =============================================================================
# 1. INICIALIZACIÓN Y USUARIOS
# =============================================================================

def is_system_initialized(conn) -> bool:
    row = conn.execute("SELECT COUNT(*) AS cnt FROM users").fetchone()
    return bool(row and row["cnt"] > 0)


def setup_initial_owner(conn, payload: Dict[str, Any], ip: str = "", ua: str = "") -> Dict[str, Any]:
    if is_system_initialized(conn):
        raise DomainError("El sistema ya fue inicializado con una cuenta de Dueño.", 409)

    username = str(payload.get("username") or "").strip().lower()
    full_name = str(payload.get("full_name") or "").strip()
    password = str(payload.get("password") or "")

    if len(username) < 3 or " " in username:
        raise DomainError("El nombre de usuario debe tener al menos 3 caracteres sin espacios.")
    if len(full_name) < 2:
        raise DomainError("El nombre completo es obligatorio.")
    if len(password) < 8:
        raise DomainError("La contraseña debe tener mínimo 8 caracteres.")

    user_id = new_id("usr")
    now = now_iso()
    pwd_hash = hash_password(password)

    conn.execute(
        """
        INSERT INTO users (id, username, full_name, password_hash, role_code, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (user_id, username, full_name, pwd_hash, ROLE_DUENO, now, now),
    )

    # Crear categorías base limpias (sin datos ficticios engañosos, solo clasificación estándar)
    default_categories = [
        ("cat_abarrotes", "Abarrotes", "Alimentos no perecederos y despensa general"),
        ("cat_lacteos", "Lácteos y Refrigerados", "Leche, derivados lácteos y refrigerados con control de vencimiento"),
        ("cat_bebidas", "Bebidas", "Aguas, refrescos, maltas y jugos"),
        ("cat_granos", "Granos y Cereales", "Arroz, lentejas, fríjol y harinas"),
        ("cat_aseo", "Aseo y Hogar", "Productos de limpieza e higiene"),
    ]
    for cid, cname, cdesc in default_categories:
        conn.execute(
            "INSERT OR IGNORE INTO categories (id, name, description, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
            (cid, cname, cdesc, now),
        )

    raw_token = create_session(conn, user_id, ip, ua)
    return {
        "token": raw_token,
        "user": {
            "id": user_id,
            "username": username,
            "full_name": full_name,
            "role": ROLE_DUENO,
            "role_name": "Dueño",
            "is_active": True,
        },
    }


def authenticate_user(conn, username: str, password: str, ip: str = "", ua: str = "") -> Dict[str, Any]:
    clean_user = str(username or "").strip().lower()
    if not clean_user or not password:
        raise AuthError("Ingresa tu usuario y contraseña.", 400)

    row = conn.execute(
        """
        SELECT u.*, r.name AS role_name
        FROM users u
        JOIN roles r ON r.code = u.role_code
        WHERE u.username = ?
        """,
        (clean_user,),
    ).fetchone()

    if not row or not verify_password(password, row["password_hash"]):
        raise AuthError("Credenciales inválidas. Verifica tu usuario y contraseña.", 401)

    if not row["is_active"]:
        raise AuthError("Esta cuenta se encuentra desactivada. Contacta al Dueño.", 403)

    raw_token = create_session(conn, row["id"], ip, ua)
    return {
        "token": raw_token,
        "user": {
            "id": row["id"],
            "username": row["username"],
            "full_name": row["full_name"],
            "role": row["role_code"],
            "role_name": row["role_name"],
            "is_active": bool(row["is_active"]),
        },
    }


def list_users(conn, current_user: dict) -> List[Dict[str, Any]]:
    require_role(current_user, {ROLE_DUENO})
    rows = conn.execute(
        """
        SELECT u.id, u.username, u.full_name, u.role_code, r.name AS role_name,
               u.is_active, u.created_at, u.updated_at,
               (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id) AS total_sales_count
        FROM users u
        JOIN roles r ON r.code = u.role_code
        ORDER BY u.created_at ASC
        """
    ).fetchall()

    return [
        {
            "id": r["id"],
            "username": r["username"],
            "full_name": r["full_name"],
            "role": r["role_code"],
            "role_name": r["role_name"],
            "is_active": bool(r["is_active"]),
            "total_sales_count": r["total_sales_count"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def create_user(conn, current_user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})

    username = str(payload.get("username") or "").strip().lower()
    full_name = str(payload.get("full_name") or "").strip()
    password = str(payload.get("password") or "")
    role_code = str(payload.get("role") or ROLE_TENDERO).strip().lower()

    if len(username) < 3 or " " in username:
        raise DomainError("El usuario debe tener al menos 3 caracteres sin espacios.")
    if len(full_name) < 2:
        raise DomainError("El nombre completo es obligatorio.")
    if len(password) < 8:
        raise DomainError("La contraseña debe tener al menos 8 caracteres.")
    if role_code not in VALID_ROLES:
        raise DomainError("Rol inválido. Solo existen 'dueno' y 'tendero'.")

    exists = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if exists:
        raise DomainError(f"El nombre de usuario '{username}' ya está registrado.", 409)

    uid = new_id("usr")
    now = now_iso()
    pwd_hash = hash_password(password)

    conn.execute(
        """
        INSERT INTO users (id, username, full_name, password_hash, role_code, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (uid, username, full_name, pwd_hash, role_code, now, now),
    )

    return {
        "id": uid,
        "username": username,
        "full_name": full_name,
        "role": role_code,
        "role_name": "Dueño" if role_code == ROLE_DUENO else "Tendero",
        "is_active": True,
        "created_at": now,
    }


def update_user(conn, current_user: dict, target_user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})

    target = conn.execute("SELECT * FROM users WHERE id = ?", (target_user_id,)).fetchone()
    if not target:
        raise DomainError("Usuario no encontrado.", 404)

    full_name = str(payload.get("full_name", target["full_name"])).strip()
    role_code = str(payload.get("role", target["role_code"])).strip().lower()
    is_active = bool(payload.get("is_active", bool(target["is_active"])))

    if role_code not in VALID_ROLES:
        raise DomainError("Rol inválido.")
    if len(full_name) < 2:
        raise DomainError("El nombre completo es obligatorio.")

    # Impedir que el único Dueño activo se desactive o se quite el rol de Dueño
    if target["role_code"] == ROLE_DUENO and (not is_active or role_code != ROLE_DUENO):
        other_owners = conn.execute(
            "SELECT COUNT(*) AS cnt FROM users WHERE role_code = 'dueno' AND is_active = 1 AND id != ?",
            (target_user_id,),
        ).fetchone()
        if not other_owners or other_owners["cnt"] == 0:
            raise DomainError("No puedes desactivar ni degradar al único Dueño activo del sistema.")

    now = now_iso()
    new_password = payload.get("password")
    if new_password:
        pwd_hash = hash_password(str(new_password))
        conn.execute(
            """
            UPDATE users
            SET full_name = ?, role_code = ?, is_active = ?, password_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (full_name, role_code, 1 if is_active else 0, pwd_hash, now, target_user_id),
        )
    else:
        conn.execute(
            """
            UPDATE users
            SET full_name = ?, role_code = ?, is_active = ?, updated_at = ?
            WHERE id = ?
            """,
            (full_name, role_code, 1 if is_active else 0, now, target_user_id),
        )

    if not is_active:
        revoke_all_user_sessions(conn, target_user_id)

    return {
        "id": target_user_id,
        "username": target["username"],
        "full_name": full_name,
        "role": role_code,
        "role_name": "Dueño" if role_code == ROLE_DUENO else "Tendero",
        "is_active": is_active,
        "updated_at": now,
    }


# =============================================================================
# 2. CATEGORÍAS, PRODUCTOS Y LOTES (FEFO + FIFO)
# =============================================================================

def list_categories(conn) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, name, description, is_active, created_at FROM categories ORDER BY name ASC"
    ).fetchall()
    return [dict(r) for r in rows]


def create_category(conn, current_user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip() or None
    if len(name) < 2:
        raise DomainError("El nombre de la categoría debe tener al menos 2 caracteres.")

    exists = conn.execute("SELECT id FROM categories WHERE name = ?", (name,)).fetchone()
    if exists:
        raise DomainError(f"La categoría '{name}' ya existe.", 409)

    cid = new_id("cat")
    now = now_iso()
    conn.execute(
        "INSERT INTO categories (id, name, description, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
        (cid, name, description, now),
    )
    return {"id": cid, "name": name, "description": description, "is_active": 1, "created_at": now}


def sort_lots_fefo_fifo(lots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Política consistente de salida de inventario:
    1. Primero los productos con fecha de vencimiento más próxima (FEFO: First-Expired, First-Out).
    2. Los lotes sin vencimiento van después de los perecederos.
    3. En caso de empate (o ambos sin vencimiento), primero el de fecha de ingreso más antigua (FIFO).
    """
    def sort_key(lot: Dict[str, Any]):
        exp = lot.get("expiration_date")
        has_exp = 0 if exp else 1
        exp_val = exp if exp else "9999-12-31"
        entry_val = lot.get("entry_date") or "9999-12-31"
        created_val = lot.get("created_at") or ""
        return (has_exp, exp_val, entry_val, created_val)

    return sorted(lots, key=sort_key)


def enrich_lot_status(lot: Dict[str, Any], ref_date: str) -> Dict[str, Any]:
    qty = round_qty(lot["available_quantity"])
    exp = lot.get("expiration_date")
    is_expired = bool(exp and exp < ref_date)
    days_to_expire = None
    is_expiring_soon = False

    if exp:
        try:
            d_exp = datetime.strptime(exp, "%Y-%m-%d").date()
            d_ref = datetime.strptime(ref_date, "%Y-%m-%d").date()
            days_to_expire = (d_exp - d_ref).days
            is_expiring_soon = 0 <= days_to_expire <= 7
        except ValueError:
            pass

    if qty <= 0:
        status = "AGOTADO"
    elif is_expired:
        status = "VENCIDO"
    elif is_expiring_soon:
        status = "PROXIMO_A_VENCER"
    else:
        status = "DISPONIBLE"

    return {
        **lot,
        "available_quantity": qty,
        "initial_quantity": round_qty(lot["initial_quantity"]),
        "unit_cost": round_money(lot["unit_cost"]),
        "is_expired": is_expired,
        "is_expiring_soon": is_expiring_soon,
        "days_to_expire": days_to_expire,
        "status": status,
    }


def list_products(conn, current_user: dict, include_inactive: bool = False) -> List[Dict[str, Any]]:
    ref_date = today_iso()
    is_owner = current_user.get("role") == ROLE_DUENO

    where_clause = "" if (is_owner and include_inactive) else "WHERE p.is_active = 1"
    prod_rows = conn.execute(
        f"""
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        {where_clause}
        ORDER BY p.name ASC
        """
    ).fetchall()

    lot_rows = conn.execute("SELECT * FROM lots").fetchall()
    lots_by_product: Dict[str, List[Dict[str, Any]]] = {}
    for lr in lot_rows:
        d = enrich_lot_status(dict(lr), ref_date)
        lots_by_product.setdefault(d["product_id"], []).append(d)

    results = []
    for pr in prod_rows:
        p_Lots = sort_lots_fefo_fifo(lots_by_product.get(pr["id"], []))
        sellable_lots = [
            l for l in p_Lots if l["available_quantity"] > 0 and not l["is_expired"]
        ]
        expired_lots = [
            l for l in p_Lots if l["available_quantity"] > 0 and l["is_expired"]
        ]
        expiring_soon_lots = [
            l for l in sellable_lots if l["is_expiring_soon"]
        ]

        available_stock = round_qty(sum(l["available_quantity"] for l in sellable_lots))
        expired_stock = round_qty(sum(l["available_quantity"] for l in expired_lots))
        next_lot = sellable_lots[0] if sellable_lots else None

        item = {
            "id": pr["id"],
            "sku": pr["sku"],
            "barcode": pr["barcode"],
            "name": pr["name"],
            "category_id": pr["category_id"],
            "category_name": pr["category_name"] or "Sin categoría",
            "unit": pr["unit"],
            "sale_price": round_money(pr["sale_price"]),
            "min_stock": round_qty(pr["min_stock"]),
            "is_active": bool(pr["is_active"]),
            "available_stock": available_stock,
            "expired_stock": expired_stock,
            "is_low_stock": available_stock <= round_qty(pr["min_stock"]),
            "next_lot_number": next_lot["lot_number"] if next_lot else None,
            "next_lot_expiration": next_lot["expiration_date"] if next_lot else None,
            "expiring_soon_count": len(expiring_soon_lots),
            "expired_lots_count": len(expired_lots),
            "active_lots_count": len(sellable_lots),
        }

        if is_owner:
            item["lots"] = p_Lots

        results.append(item)

    return results


def create_product(conn, current_user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})

    name = str(payload.get("name") or "").strip()
    sku = str(payload.get("sku") or "").strip().upper()
    barcode = str(payload.get("barcode") or "").strip() or None
    category_id = payload.get("category_id") or None
    unit = str(payload.get("unit") or "und").strip().lower()
    sale_price = round_money(payload.get("sale_price", 0))
    min_stock = round_qty(payload.get("min_stock", 5))

    if len(name) < 2:
        raise DomainError("El nombre del producto es obligatorio.")
    if not sku:
        raise DomainError("El código SKU es obligatorio.")
    if unit not in {"und", "kg", "lb", "lt", "gr", "caja"}:
        raise DomainError("Unidad de medida no válida.")
    if sale_price <= 0:
        raise DomainError("El precio de venta debe ser mayor a cero.")
    if min_stock < 0:
        raise DomainError("El stock mínimo no puede ser negativo.")

    if conn.execute("SELECT id FROM products WHERE sku = ?", (sku,)).fetchone():
        raise DomainError(f"Ya existe un producto con el SKU '{sku}'.", 409)
    if barcode and conn.execute("SELECT id FROM products WHERE barcode = ?", (barcode,)).fetchone():
        raise DomainError(f"Ya existe un producto con el código de barras '{barcode}'.", 409)

    pid = new_id("prd")
    now = now_iso()

    conn.execute(
        """
        INSERT INTO products (id, sku, barcode, name, category_id, unit, sale_price, min_stock, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (pid, sku, barcode, name, category_id, unit, sale_price, min_stock, now, now),
    )

    # Si se incluye un lote inicial opcional al crear el producto
    initial_lot = payload.get("initial_lot")
    if isinstance(initial_lot, dict) and round_qty(initial_lot.get("quantity", 0)) > 0:
        create_lot(
            conn,
            current_user,
            {
                "product_id": pid,
                "lot_number": initial_lot.get("lot_number") or f"L-{today_iso().replace('-', '')}-01",
                "quantity": initial_lot.get("quantity"),
                "unit_cost": initial_lot.get("unit_cost", 0),
                "entry_date": initial_lot.get("entry_date") or today_iso(),
                "expiration_date": initial_lot.get("expiration_date"),
                "notes": initial_lot.get("notes") or "Lote inicial de apertura",
            },
        )

    prods = list_products(conn, current_user, include_inactive=True)
    return next(p for p in prods if p["id"] == pid)


def update_product(conn, current_user: dict, product_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})

    existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not existing:
        raise DomainError("Producto no encontrado.", 404)

    name = str(payload.get("name", existing["name"])).strip()
    sku = str(payload.get("sku", existing["sku"])).strip().upper()
    barcode_raw = payload.get("barcode", existing["barcode"])
    barcode = str(barcode_raw).strip() if barcode_raw else None
    category_id = payload.get("category_id", existing["category_id"]) or None
    unit = str(payload.get("unit", existing["unit"])).strip().lower()
    sale_price = round_money(payload.get("sale_price", existing["sale_price"]))
    min_stock = round_qty(payload.get("min_stock", existing["min_stock"]))
    is_active = bool(payload.get("is_active", bool(existing["is_active"])))

    if len(name) < 2:
        raise DomainError("El nombre del producto es obligatorio.")
    if not sku:
        raise DomainError("El código SKU es obligatorio.")
    if sale_price <= 0:
        raise DomainError("El precio de venta debe ser mayor a cero.")

    dup_sku = conn.execute(
        "SELECT id FROM products WHERE sku = ? AND id != ?", (sku, product_id)
    ).fetchone()
    if dup_sku:
        raise DomainError(f"El SKU '{sku}' ya está asignado a otro producto.", 409)

    if barcode:
        dup_bar = conn.execute(
            "SELECT id FROM products WHERE barcode = ? AND id != ?", (barcode, product_id)
        ).fetchone()
        if dup_bar:
            raise DomainError(f"El código de barras '{barcode}' ya pertenece a otro producto.", 409)

    conn.execute(
        """
        UPDATE products
        SET sku = ?, barcode = ?, name = ?, category_id = ?, unit = ?,
            sale_price = ?, min_stock = ?, is_active = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            sku,
            barcode,
            name,
            category_id,
            unit,
            sale_price,
            min_stock,
            1 if is_active else 0,
            now_iso(),
            product_id,
        ),
    )

    prods = list_products(conn, current_user, include_inactive=True)
    return next(p for p in prods if p["id"] == product_id)


def list_all_lots(conn, current_user: dict, product_id: Optional[str] = None) -> List[Dict[str, Any]]:
    require_role(current_user, {ROLE_DUENO})
    ref_date = today_iso()

    params = ()
    where_sql = ""
    if product_id:
        where_sql = "WHERE l.product_id = ?"
        params = (product_id,)

    rows = conn.execute(
        f"""
        SELECT l.*, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit
        FROM lots l
        JOIN products p ON p.id = l.product_id
        {where_sql}
        """,
        params,
    ).fetchall()

    enriched = [enrich_lot_status(dict(r), ref_date) for r in rows]
    return sort_lots_fefo_fifo(enriched)


def create_lot(conn, current_user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO})

    product_id = str(payload.get("product_id") or "").strip()
    lot_number = str(payload.get("lot_number") or "").strip().upper()
    quantity = round_qty(payload.get("quantity", 0))
    unit_cost = round_money(payload.get("unit_cost", 0))
    entry_date = validate_date_str(payload.get("entry_date") or today_iso(), "fecha de ingreso", allow_none=False)
    expiration_date = validate_date_str(payload.get("expiration_date"), "fecha de vencimiento", allow_none=True)
    notes = str(payload.get("notes") or "").strip() or None

    prod = conn.execute("SELECT id, name FROM products WHERE id = ?", (product_id,)).fetchone()
    if not prod:
        raise DomainError("El producto seleccionado no existe.", 404)
    if not lot_number:
        raise DomainError("El código de lote es obligatorio.")
    if quantity <= 0:
        raise DomainError("La cantidad del lote debe ser mayor a cero.")
    if unit_cost < 0:
        raise DomainError("El costo unitario no puede ser negativo.")

    dup = conn.execute(
        "SELECT id FROM lots WHERE product_id = ? AND lot_number = ?",
        (product_id, lot_number),
    ).fetchone()
    if dup:
        raise DomainError(f"El lote '{lot_number}' ya existe para este producto.", 409)

    lid = new_id("lot")
    now = now_iso()

    conn.execute(
        """
        INSERT INTO lots (
            id, product_id, lot_number, entry_date, expiration_date,
            unit_cost, initial_quantity, available_quantity, notes,
            created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            lid,
            product_id,
            lot_number,
            entry_date,
            expiration_date,
            unit_cost,
            quantity,
            quantity,
            notes,
            current_user["id"],
            now,
            now,
        ),
    )

    conn.execute(
        """
        INSERT INTO inventory_movements (
            id, product_id, lot_id, movement_type, quantity,
            previous_stock, new_stock, unit_cost, reason, reference_id, user_id, created_at
        )
        VALUES (?, ?, ?, 'ENTRADA_LOTE', ?, 0, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id("mov"),
            product_id,
            lid,
            quantity,
            quantity,
            unit_cost,
            notes or f"Ingreso de lote {lot_number}",
            lid,
            current_user["id"],
            now,
        ),
    )

    lots = list_all_lots(conn, current_user, product_id=product_id)
    return next(l for l in lots if l["id"] == lid)


def adjust_lot_inventory(conn, current_user: dict, lot_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Permite al Dueño registrar entradas adicionales, salidas por merma/daño o ajustes sobre un lote,
    manteniendo trazabilidad en inventory_movements.
    """
    require_role(current_user, {ROLE_DUENO})

    lot = conn.execute("SELECT * FROM lots WHERE id = ?", (lot_id,)).fetchone()
    if not lot:
        raise DomainError("Lote no encontrado.", 404)

    operation = str(payload.get("operation") or "AJUSTE_DIRECTO").strip().upper()
    reason = str(payload.get("reason") or "").strip()
    if len(reason) < 3:
        raise DomainError("Debes indicar un motivo claro para el movimiento de inventario.")

    prev_qty = round_qty(lot["available_quantity"])
    qty_input = round_qty(payload.get("quantity", 0))

    if operation == "ENTRADA_AJUSTE":
        if qty_input <= 0:
            raise DomainError("La cantidad de entrada debe ser mayor a cero.")
        new_qty = round_qty(prev_qty + qty_input)
        delta = qty_input
    elif operation == "SALIDA_MERMA":
        if qty_input <= 0:
            raise DomainError("La cantidad de salida debe ser mayor a cero.")
        if qty_input > prev_qty:
            raise DomainError(f"No puedes retirar {qty_input} unidades; el lote solo tiene {prev_qty}.")
        new_qty = round_qty(prev_qty - qty_input)
        delta = -qty_input
    elif operation == "AJUSTE_DIRECTO":
        if qty_input < 0:
            raise DomainError("El nuevo saldo del lote no puede ser negativo.")
        new_qty = qty_input
        delta = round_qty(new_qty - prev_qty)
    else:
        raise DomainError("Tipo de operación de inventario no válido.")

    expiration_date = validate_date_str(
        payload.get("expiration_date", lot["expiration_date"]),
        "fecha de vencimiento",
        allow_none=True,
    )
    unit_cost = round_money(payload.get("unit_cost", lot["unit_cost"]))
    now = now_iso()

    conn.execute(
        """
        UPDATE lots
        SET available_quantity = ?, expiration_date = ?, unit_cost = ?, updated_at = ?
        WHERE id = ?
        """,
        (new_qty, expiration_date, unit_cost, now, lot_id),
    )

    if delta != 0:
        conn.execute(
            """
            INSERT INTO inventory_movements (
                id, product_id, lot_id, movement_type, quantity,
                previous_stock, new_stock, unit_cost, reason, reference_id, user_id, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id("mov"),
                lot["product_id"],
                lot_id,
                operation,
                delta,
                prev_qty,
                new_qty,
                unit_cost,
                reason,
                lot_id,
                current_user["id"],
                now,
            ),
        )

    lots = list_all_lots(conn, current_user, product_id=lot["product_id"])
    return next(l for l in lots if l["id"] == lot_id)


def list_inventory_movements(conn, current_user: dict, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    require_role(current_user, {ROLE_DUENO})

    clauses = []
    params: List[Any] = []

    if filters.get("product_id"):
        clauses.append("m.product_id = ?")
        params.append(filters["product_id"])
    if filters.get("movement_type"):
        clauses.append("m.movement_type = ?")
        params.append(filters["movement_type"])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    rows = conn.execute(
        f"""
        SELECT m.*, p.name AS product_name, p.sku AS product_sku, p.unit AS product_unit,
               l.lot_number, u.full_name AS user_name
        FROM inventory_movements m
        JOIN products p ON p.id = m.product_id
        LEFT JOIN lots l ON l.id = m.lot_id
        JOIN users u ON u.id = m.user_id
        {where_sql}
        ORDER BY m.created_at DESC
        LIMIT 250
        """,
        tuple(params),
    ).fetchall()

    return [dict(r) for r in rows]


# =============================================================================
# 3. REGISTRO DE VENTAS (TRANSACCIÓN ATÓMICA + ASIGNACIÓN FEFO/FIFO)
# =============================================================================

def register_sale(conn, current_user: dict, payload: Dict[str, Any]) -> Dict[str, Any]:
    require_role(current_user, {ROLE_DUENO, ROLE_TENDERO})

    items_req = payload.get("items")
    if not isinstance(items_req, list) or len(items_req) == 0:
        raise DomainError("El carrito de venta está vacío.")

    payment_method = str(payload.get("payment_method") or "efectivo").strip().lower()
    pm_row = conn.execute(
        "SELECT * FROM payment_methods WHERE code = ? AND is_active = 1",
        (payment_method,),
    ).fetchone()
    if not pm_row:
        raise DomainError("Método de pago no válido. Usa efectivo, nequi o daviplata.")

    client_op_id = str(payload.get("client_operation_id") or "").strip() or None
    if client_op_id:
        existing_sale = conn.execute(
            "SELECT id FROM sales WHERE client_operation_id = ?",
            (client_op_id,),
        ).fetchone()
        if existing_sale:
            return get_sale_by_id(conn, current_user, existing_sale["id"])

    ref_date = today_iso()
    now = now_iso()

    # Consolidar cantidades si el mismo producto viene repetido en el payload
    consolidated: Dict[str, float] = {}
    for line in items_req:
        pid = str(line.get("product_id") or "").strip()
        qty = round_qty(line.get("quantity", 0))
        if not pid or qty <= 0:
            raise DomainError("Cada línea de venta debe tener un producto válido y cantidad mayor a 0.")
        consolidated[pid] = round_qty(consolidated.get(pid, 0) + qty)

    sale_id = new_id("vta")
    count_row = conn.execute("SELECT COUNT(*) AS cnt FROM sales").fetchone()
    next_num = (count_row["cnt"] if count_row else 0) + 1
    folio = f"POS-{next_num:06d}"

    subtotal_sale = 0.0
    prepared_items = []

    for pid, needed_qty in consolidated.items():
        prod = conn.execute("SELECT * FROM products WHERE id = ?", (pid,)).fetchone()
        if not prod or not prod["is_active"]:
            raise DomainError(f"El producto solicitado ({pid}) no existe o está inactivo.")

        lot_rows = conn.execute(
            "SELECT * FROM lots WHERE product_id = ?",
            (pid,),
        ).fetchall()
        enriched_lots = [enrich_lot_status(dict(r), ref_date) for r in lot_rows]
        ordered_lots = sort_lots_fefo_fifo(enriched_lots)
        sellable_lots = [
            l for l in ordered_lots if l["available_quantity"] > 0 and not l["is_expired"]
        ]

        total_available = round_qty(sum(l["available_quantity"] for l in sellable_lots))
        if total_available < needed_qty:
            raise DomainError(
                f"Existencias insuficientes para '{prod['name']}': solicitado {needed_qty} {prod['unit']}, "
                f"disponible en lotes vigentes {total_available} {prod['unit']}."
            )

        remaining = needed_qty
        allocations = []
        for lot in sellable_lots:
            if remaining <= 0:
                break
            avail = lot["available_quantity"]
            take = round_qty(min(avail, remaining))
            new_avail = round_qty(avail - take)
            remaining = round_qty(remaining - take)

            allocations.append(
                {
                    "lot_id": lot["id"],
                    "lot_number": lot["lot_number"],
                    "take_qty": take,
                    "prev_stock": avail,
                    "new_stock": new_avail,
                    "unit_cost": lot["unit_cost"],
                }
            )

        unit_price = round_money(prod["sale_price"])
        line_subtotal = round_money(unit_price * needed_qty)
        subtotal_sale = round_money(subtotal_sale + line_subtotal)

        prepared_items.append(
            {
                "sale_item_id": new_id("sit"),
                "product": prod,
                "quantity": needed_qty,
                "unit_price": unit_price,
                "subtotal": line_subtotal,
                "allocations": allocations,
            }
        )

    total_sale = subtotal_sale
    raw_received = payload.get("amount_received")
    if payment_method == "efectivo":
        amount_received = round_money(raw_received if raw_received is not None else total_sale)
        if amount_received < total_sale:
            raise DomainError(
                f"El efectivo recibido (${amount_received:,.0f}) es menor al total de la venta (${total_sale:,.0f})."
            )
        change_amount = round_money(amount_received - total_sale)
    else:
        amount_received = total_sale
        change_amount = 0.0

    notes = str(payload.get("notes") or "").strip() or None

    # Insertar cabecera de venta
    conn.execute(
        """
        INSERT INTO sales (
            id, folio, client_operation_id, user_id, payment_method_code,
            subtotal, total, amount_received, change_amount, status, notes, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETADA', ?, ?)
        """,
        (
            sale_id,
            folio,
            client_op_id,
            current_user["id"],
            payment_method,
            subtotal_sale,
            total_sale,
            amount_received,
            change_amount,
            notes,
            now,
        ),
    )

    # Insertar detalles, descontar lotes y registrar movimientos de inventario
    for item in prepared_items:
        p = item["product"]
        conn.execute(
            """
            INSERT INTO sale_items (
                id, sale_id, product_id, product_name_snapshot,
                sku_snapshot, unit_snapshot, quantity, unit_price, subtotal
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["sale_item_id"],
                sale_id,
                p["id"],
                p["name"],
                p["sku"],
                p["unit"],
                item["quantity"],
                item["unit_price"],
                item["subtotal"],
            ),
        )

        for alloc in item["allocations"]:
            conn.execute(
                "UPDATE lots SET available_quantity = ?, updated_at = ? WHERE id = ?",
                (alloc["new_stock"], now, alloc["lot_id"]),
            )
            conn.execute(
                """
                INSERT INTO sale_lot_allocations (id, sale_item_id, lot_id, lot_number, quantity, unit_cost)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("sla"),
                    item["sale_item_id"],
                    alloc["lot_id"],
                    alloc["lot_number"],
                    alloc["take_qty"],
                    alloc["unit_cost"],
                ),
            )
            conn.execute(
                """
                INSERT INTO inventory_movements (
                    id, product_id, lot_id, movement_type, quantity,
                    previous_stock, new_stock, unit_cost, reason, reference_id, user_id, created_at
                )
                VALUES (?, ?, ?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("mov"),
                    p["id"],
                    alloc["lot_id"],
                    -alloc["take_qty"],
                    alloc["prev_stock"],
                    alloc["new_stock"],
                    alloc["unit_cost"],
                    f"Venta {folio} (Lote {alloc['lot_number']})",
                    sale_id,
                    current_user["id"],
                    now,
                ),
            )

    return get_sale_by_id(conn, current_user, sale_id)


def get_sale_by_id(conn, current_user: dict, sale_id: str) -> Dict[str, Any]:
    row = conn.execute(
        """
        SELECT s.*, u.full_name AS seller_name, u.username AS seller_username,
               pm.name AS payment_method_name
        FROM sales s
        JOIN users u ON u.id = s.user_id
        JOIN payment_methods pm ON pm.code = s.payment_method_code
        WHERE s.id = ?
        """,
        (sale_id,),
    ).fetchone()

    if not row:
        raise DomainError("Venta no encontrada.", 404)

    # El Tendero únicamente puede consultar sus propias ventas operativas
    if current_user["role"] == ROLE_TENDERO and row["user_id"] != current_user["id"]:
        raise AuthError("No tienes permiso para consultar ventas de otros usuarios.", 403)

    items_rows = conn.execute(
        "SELECT * FROM sale_items WHERE sale_id = ?",
        (sale_id,),
    ).fetchall()

    items_list = []
    for ir in items_rows:
        alloc_rows = conn.execute(
            "SELECT lot_id, lot_number, quantity, unit_cost FROM sale_lot_allocations WHERE sale_item_id = ?",
            (ir["id"],),
        ).fetchall()
        items_list.append(
            {
                "id": ir["id"],
                "product_id": ir["product_id"],
                "product_name": ir["product_name_snapshot"],
                "sku": ir["sku_snapshot"],
                "unit": ir["unit_snapshot"],
                "quantity": round_qty(ir["quantity"]),
                "unit_price": round_money(ir["unit_price"]),
                "subtotal": round_money(ir["subtotal"]),
                "lots": [dict(a) for a in alloc_rows],
            }
        )

    return {
        "id": row["id"],
        "folio": row["folio"],
        "user_id": row["user_id"],
        "seller_name": row["seller_name"],
        "seller_username": row["seller_username"],
        "payment_method": row["payment_method_code"],
        "payment_method_name": row["payment_method_name"],
        "subtotal": round_money(row["subtotal"]),
        "total": round_money(row["total"]),
        "amount_received": round_money(row["amount_received"]),
        "change_amount": round_money(row["change_amount"]),
        "status": row["status"],
        "notes": row["notes"],
        "created_at": row["created_at"],
        "items": items_list,
    }


def list_sales(conn, current_user: dict, filters: Dict[str, Any]) -> Dict[str, Any]:
    clauses = []
    params: List[Any] = []

    # Restricción estricta para Tendero: solo sus propias ventas
    if current_user["role"] == ROLE_TENDERO:
        clauses.append("s.user_id = ?")
        params.append(current_user["id"])
    elif filters.get("user_id"):
        clauses.append("s.user_id = ?")
        params.append(filters["user_id"])

    if filters.get("date_from"):
        clauses.append("substr(s.created_at, 1, 10) >= ?")
        params.append(str(filters["date_from"])[:10])
    if filters.get("date_to"):
        clauses.append("substr(s.created_at, 1, 10) <= ?")
        params.append(str(filters["date_to"])[:10])
    if filters.get("payment_method"):
        clauses.append("s.payment_method_code = ?")
        params.append(str(filters["payment_method"]).lower())
    if filters.get("product_id"):
        clauses.append(
            "EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.product_id = ?)"
        )
        params.append(filters["product_id"])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    rows = conn.execute(
        f"""
        SELECT s.id
        FROM sales s
        {where_sql}
        ORDER BY s.created_at DESC
        LIMIT 150
        """,
        tuple(params),
    ).fetchall()

    sales_list = [get_sale_by_id(conn, current_user, r["id"]) for r in rows]

    totals_by_method = {"efectivo": 0.0, "nequi": 0.0, "daviplata": 0.0}
    grand_total = 0.0
    for s in sales_list:
        if s["status"] == "COMPLETADA":
            grand_total = round_money(grand_total + s["total"])
            pm = s["payment_method"]
            totals_by_method[pm] = round_money(totals_by_method.get(pm, 0.0) + s["total"])

    return {
        "sales": sales_list,
        "summary": {
            "count": len(sales_list),
            "grand_total": grand_total,
            "by_payment_method": totals_by_method,
        },
    }
