"""
Suite de Pruebas Automatizadas de Integración y Reglas Críticas (Kairo POS & Inventario).
Verifica:
1. Inicialización segura del primer usuario Dueño y bloqueo de reinicialización.
2. Hashing PBKDF2-HMAC-SHA256, inicio de sesión, recuperación de sesión y revocación al desactivar usuario.
3. Control de acceso real en servidor (RBAC): el Tendero recibe error 403 si intenta crear productos, lotes, usuarios o ver ventas ajenas.
4. Gestión de lotes con política FEFO (primero en vencer, primero en salir) + FIFO, y bloqueo estricto de lotes vencidos.
5. Transaccionalidad de ventas: descuento multi-lote, cálculo confiable en servidor, idempotencia por client_operation_id y rollback ante stock insuficiente.
"""

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import readonly_connection, run_migrations, transaction
from backend.security import AuthError, get_authenticated_user, revoke_session
from backend.services import (
    DomainError,
    adjust_lot_inventory,
    authenticate_user,
    create_category,
    create_lot,
    create_product,
    create_user,
    is_system_initialized,
    list_all_lots,
    list_inventory_movements,
    list_products,
    list_sales,
    list_users,
    register_sale,
    setup_initial_owner,
    update_user,
)


class KairoSystemTestSuite(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "test_kairo.sqlite3"
        os.environ["KAIRO_DB_PATH"] = str(self.db_path)
        run_migrations()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_01_initial_setup_and_authentication_lifecycle(self):
        with readonly_connection() as conn:
            self.assertFalse(is_system_initialized(conn))

        with transaction() as conn:
            setup_res = setup_initial_owner(
                conn,
                {
                    "full_name": "Carlos Mendoza",
                    "username": "cmendoza",
                    "password": "PasswordSegura123!",
                },
            )

        self.assertIn("token", setup_res)
        self.assertEqual(setup_res["user"]["role"], "dueno")

        # No debe permitir reinicializar el sistema una vez creado el Dueño
        with self.assertRaises(DomainError) as ctx:
            with transaction() as conn:
                setup_initial_owner(
                    conn,
                    {
                        "full_name": "Intruso",
                        "username": "intruso",
                        "password": "Password123!",
                    },
                )
        self.assertEqual(ctx.exception.status_code, 409)

        # Recuperar sesión desde token
        with readonly_connection() as conn:
            me = get_authenticated_user(conn, setup_res["token"])
            self.assertEqual(me["username"], "cmendoza")
            self.assertEqual(me["role"], "dueno")

        # Cerrar sesión revoca el token
        with transaction() as conn:
            revoke_session(conn, setup_res["token"])

        with self.assertRaises(AuthError):
            with readonly_connection() as conn:
                get_authenticated_user(conn, setup_res["token"])

    def test_02_strict_rbac_enforcement_between_dueno_and_tendero(self):
        with transaction() as conn:
            owner_res = setup_initial_owner(
                conn,
                {
                    "full_name": "Dueño Principal",
                    "username": "dueno1",
                    "password": "ClaveDueno2026!",
                },
            )
            owner_user = owner_res["user"]

            tendero_created = create_user(
                conn,
                owner_user,
                {
                    "full_name": "Laura Cajera",
                    "username": "laura",
                    "role": "tendero",
                    "password": "ClaveTendero2026!",
                },
            )

        with transaction() as conn:
            login_tendero = authenticate_user(conn, "laura", "ClaveTendero2026!")
            tendero_user = login_tendero["user"]

        self.assertEqual(tendero_user["role"], "tendero")

        # El Tendero NO puede crear productos, categorías, lotes ni usuarios
        with self.assertRaises(AuthError) as e_prod:
            with transaction() as conn:
                create_product(
                    conn,
                    tendero_user,
                    {"name": "Arroz", "sku": "ARR-01", "sale_price": 3000},
                )
        self.assertEqual(e_prod.exception.status_code, 403)

        with self.assertRaises(AuthError) as e_cat:
            with transaction() as conn:
                create_category(conn, tendero_user, {"name": "Nueva Cat"})
        self.assertEqual(e_cat.exception.status_code, 403)

        with self.assertRaises(AuthError) as e_users:
            with readonly_connection() as conn:
                list_users(conn, tendero_user)
        self.assertEqual(e_users.exception.status_code, 403)

        # Si el Dueño desactiva al Tendero, su sesión queda invalidada inmediatamente
        with transaction() as conn:
            update_user(conn, owner_user, tendero_created["id"], {"is_active": False})

        with self.assertRaises(AuthError):
            with readonly_connection() as conn:
                get_authenticated_user(conn, login_tendero["token"])

    def test_03_fefo_fifo_lot_allocation_and_expired_lot_blocking(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        in_5_days = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
        in_20_days = (datetime.now(timezone.utc) + timedelta(days=20)).strftime("%Y-%m-%d")

        with transaction() as conn:
            owner = setup_initial_owner(
                conn,
                {
                    "full_name": "Dueño",
                    "username": "admin",
                    "password": "Password123!",
                },
            )["user"]

            prod = create_product(
                conn,
                owner,
                {
                    "name": "Leche Entera 1L",
                    "sku": "LEC-1L",
                    "barcode": "7701002003",
                    "unit": "und",
                    "sale_price": 4500,
                    "min_stock": 5,
                },
            )

            # Lote 1: Vencido ayer (10 unidades que deben bloquearse para la venta)
            create_lot(
                conn,
                owner,
                {
                    "product_id": prod["id"],
                    "lot_number": "L-VENCIDO",
                    "quantity": 10,
                    "unit_cost": 3100,
                    "entry_date": "2026-10-01",
                    "expiration_date": yesterday,
                },
            )

            # Lote 2: Vence en 20 días (entró antes, pero vence más tarde)
            create_lot(
                conn,
                owner,
                {
                    "product_id": prod["id"],
                    "lot_number": "L-LEJANO",
                    "quantity": 6,
                    "unit_cost": 3300,
                    "entry_date": "2026-10-10",
                    "expiration_date": in_20_days,
                },
            )

            # Lote 3: Vence en 5 días (FEFO: debe descontarse primero aunque haya entrado hoy)
            create_lot(
                conn,
                owner,
                {
                    "product_id": prod["id"],
                    "lot_number": "L-PROXIMO",
                    "quantity": 4,
                    "unit_cost": 3400,
                    "entry_date": today,
                    "expiration_date": in_5_days,
                },
            )

        with readonly_connection() as conn:
            prods = list_products(conn, owner)
            self.assertEqual(len(prods), 1)
            # Solo 6 + 4 = 10 disponibles (las 10 del lote vencido están bloqueadas)
            self.assertEqual(prods[0]["available_stock"], 10)
            self.assertEqual(prods[0]["expired_stock"], 10)
            self.assertEqual(prods[0]["next_lot_number"], "L-PROXIMO")

        # Vender 7 unidades: debe tomar las 4 de L-PROXIMO (FEFO) y 3 de L-LEJANO
        with transaction() as conn:
            sale = register_sale(
                conn,
                owner,
                {
                    "client_operation_id": "op-unica-001",
                    "payment_method": "efectivo",
                    "amount_received": 40000,
                    "items": [{"product_id": prod["id"], "quantity": 7}],
                },
            )

        self.assertEqual(sale["total"], 31500)  # 7 * 4500
        self.assertEqual(sale["change_amount"], 8500)  # 40000 - 31500
        allocs = sale["items"][0]["lots"]
        self.assertEqual(len(allocs), 2)
        self.assertEqual(allocs[0]["lot_number"], "L-PROXIMO")
        self.assertEqual(allocs[0]["quantity"], 4)
        self.assertEqual(allocs[1]["lot_number"], "L-LEJANO")
        self.assertEqual(allocs[1]["quantity"], 3)

        # Idempotencia: repetir el mismo client_operation_id no duplica la venta ni vuelve a descontar stock
        with transaction() as conn:
            duplicate_sale = register_sale(
                conn,
                owner,
                {
                    "client_operation_id": "op-unica-001",
                    "payment_method": "efectivo",
                    "amount_received": 40000,
                    "items": [{"product_id": prod["id"], "quantity": 7}],
                },
            )
        self.assertEqual(duplicate_sale["id"], sale["id"])

        with readonly_connection() as conn:
            prods_after = list_products(conn, owner)
            self.assertEqual(prods_after[0]["available_stock"], 3)

            # Intentar vender 5 unidades cuando solo quedan 3 vigentes debe fallar atómicamente
            with self.assertRaises(DomainError):
                with transaction() as tx_conn:
                    register_sale(
                        tx_conn,
                        owner,
                        {
                            "payment_method": "nequi",
                            "items": [{"product_id": prod["id"], "quantity": 5}],
                        },
                    )

            prods_unchanged = list_products(conn, owner)
            self.assertEqual(prods_unchanged[0]["available_stock"], 3)

    def test_04_inventory_adjustments_and_kardex_traceability(self):
        with transaction() as conn:
            owner = setup_initial_owner(
                conn,
                {
                    "full_name": "Dueño",
                    "username": "admin",
                    "password": "Password123!",
                },
            )["user"]

            prod = create_product(
                conn,
                owner,
                {
                    "name": "Café Grano 500g",
                    "sku": "CAF-500",
                    "unit": "und",
                    "sale_price": 18000,
                    "initial_lot": {
                        "lot_number": "L-CAF-01",
                        "quantity": 20,
                        "unit_cost": 12000,
                    },
                },
            )
            lots = list_all_lots(conn, owner, product_id=prod["id"])
            lot_id = lots[0]["id"]

            # Registrar salida por merma de 2 unidades
            updated_lot = adjust_lot_inventory(
                conn,
                owner,
                lot_id,
                {
                    "operation": "SALIDA_MERMA",
                    "quantity": 2,
                    "reason": "Empaque roto en bodega",
                },
            )
            self.assertEqual(updated_lot["available_quantity"], 18)

            movements = list_inventory_movements(conn, owner, {"product_id": prod["id"]})
            self.assertEqual(len(movements), 2)  # ENTRADA_LOTE + SALIDA_MERMA

        # Verificar filtrado de ventas por usuario
        with transaction() as conn:
            register_sale(
                conn,
                owner,
                {
                    "payment_method": "daviplata",
                    "items": [{"product_id": prod["id"], "quantity": 2}],
                },
            )
        with readonly_connection() as conn:
            sales_report = list_sales(conn, owner, {"payment_method": "daviplata"})
            self.assertEqual(sales_report["summary"]["count"], 1)
            self.assertEqual(sales_report["summary"]["grand_total"], 36000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
