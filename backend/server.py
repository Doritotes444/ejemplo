"""
Servidor HTTP de Aplicación (API REST JSON + Archivos Estáticos SPA).
Implementado con biblioteca estándar de Python (ThreadingHTTPServer) y SQLite3 ACID.
"""

import json
import mimetypes
import os
import sys
import traceback
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

# Asegurar que el directorio raíz esté en sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import readonly_connection, run_migrations, transaction
from backend.security import (
    AuthError,
    get_authenticated_user,
    revoke_session,
)
from backend.services import (
    DomainError,
    adjust_lot_inventory,
    authenticate_user,
    create_category,
    create_lot,
    create_product,
    create_user,
    get_sale_by_id,
    is_system_initialized,
    list_all_lots,
    list_categories,
    list_inventory_movements,
    list_products,
    list_sales,
    list_users,
    register_sale,
    setup_initial_owner,
    update_product,
    update_user,
)

COOKIE_NAME = "kairo_session"

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")


class KairoRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def log_message(self, format_str, *args):
        # Registro limpio en consola
        sys.stderr.write(f"[KairoHTTP] {self.address_string()} - {format_str % args}\n")

    def _extract_token(self) -> Optional[str]:
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:].strip()

        cookie_header = self.headers.get("Cookie", "")
        if cookie_header:
            cookie = SimpleCookie()
            cookie.load(cookie_header)
            if COOKIE_NAME in cookie:
                return cookie[COOKIE_NAME].value
        return None

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            raise DomainError("Cuerpo JSON malformado.", 400)

    def _send_json(
        self,
        data: Any,
        status: int = 200,
        set_cookie_token: Optional[str] = None,
        clear_cookie: bool = False,
    ) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")

        if set_cookie_token:
            cookie_val = (
                f"{COOKIE_NAME}={set_cookie_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800"
            )
            self.send_header("Set-Cookie", cookie_val)
        elif clear_cookie:
            cookie_val = f"{COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
            self.send_header("Set-Cookie", cookie_val)

        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("GET", parsed.path, parse_qs(parsed.query))
            return

        # Bloquear acceso directo a archivos del backend o base de datos SQLite desde navegador
        if parsed.path.startswith("/backend") or parsed.path.startswith("/data/"):
            self._send_json({"error": "Acceso restringido."}, status=403)
            return

        # Si solicita /app o /app/, servir /app/index.html (entorno de aplicación POS/Inventario)
        if parsed.path == "/app" or parsed.path.startswith("/app/"):
            app_candidate = ROOT_DIR / parsed.path.lstrip("/")
            if app_candidate.is_file():
                return super().do_GET()
            self.path = "/app/index.html"
            return super().do_GET()

        # Si solicita una ruta estática existente, servirla; de lo contrario, servir index.html (Landing Pública)
        candidate = ROOT_DIR / parsed.path.lstrip("/")
        if parsed.path == "/" or (not candidate.is_file() and "." not in Path(parsed.path).name):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("POST", parsed.path, parse_qs(parsed.query))
        else:
            self._send_json({"error": "Ruta no encontrada."}, status=404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self._handle_api("PUT", parsed.path, parse_qs(parsed.query))
        else:
            self._send_json({"error": "Ruta no encontrada."}, status=404)

    def _handle_api(self, method: str, path: str, query: Dict[str, Any]) -> None:
        try:
            parts = [p for p in path.strip("/").split("/") if p]
            # parts[0] == "api"

            # 1. Estado de inicialización y sesión actual
            if method == "GET" and path == "/api/auth/status":
                token = self._extract_token()
                with readonly_connection() as conn:
                    initialized = is_system_initialized(conn)
                    user = None
                    if initialized and token:
                        try:
                            user = get_authenticated_user(conn, token)
                        except AuthError:
                            user = None
                self._send_json({"initialized": initialized, "user": user})
                return

            # 2. Inicialización segura del primer usuario Dueño
            if method == "POST" and path == "/api/auth/setup":
                body = self._read_json_body()
                ip = self.client_address[0] if self.client_address else ""
                ua = self.headers.get("User-Agent", "")
                with transaction() as conn:
                    res = setup_initial_owner(conn, body, ip, ua)
                self._send_json(res, status=201, set_cookie_token=res["token"])
                return

            # 3. Inicio de sesión
            if method == "POST" and path == "/api/auth/login":
                body = self._read_json_body()
                ip = self.client_address[0] if self.client_address else ""
                ua = self.headers.get("User-Agent", "")
                with transaction() as conn:
                    res = authenticate_user(
                        conn,
                        body.get("username", ""),
                        body.get("password", ""),
                        ip,
                        ua,
                    )
                self._send_json(res, status=200, set_cookie_token=res["token"])
                return

            # 4. Cierre de sesión
            if method == "POST" and path == "/api/auth/logout":
                token = self._extract_token()
                with transaction() as conn:
                    revoke_session(conn, token)
                self._send_json({"ok": True}, status=200, clear_cookie=True)
                return

            # A partir de aquí, todas las rutas requieren sesión autenticada
            token = self._extract_token()

            if method == "GET" and path == "/api/auth/me":
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                self._send_json({"user": user})
                return

            # Categorías
            if method == "GET" and path == "/api/categories":
                with readonly_connection() as conn:
                    get_authenticated_user(conn, token)
                    cats = list_categories(conn)
                self._send_json({"categories": cats})
                return

            if method == "POST" and path == "/api/categories":
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    cat = create_category(conn, user, body)
                self._send_json({"category": cat}, status=201)
                return

            # Productos
            if method == "GET" and path == "/api/products":
                inc_inactive = query.get("include_inactive", ["0"])[0] in ("1", "true")
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    prods = list_products(conn, user, include_inactive=inc_inactive)
                self._send_json({"products": prods})
                return

            if method == "POST" and path == "/api/products":
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    prod = create_product(conn, user, body)
                self._send_json({"product": prod}, status=201)
                return

            if method == "PUT" and len(parts) == 3 and parts[1] == "products":
                product_id = parts[2]
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    prod = update_product(conn, user, product_id, body)
                self._send_json({"product": prod})
                return

            # Lotes
            if method == "GET" and path == "/api/lots":
                product_id = query.get("product_id", [None])[0]
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    lots = list_all_lots(conn, user, product_id=product_id)
                self._send_json({"lots": lots})
                return

            if method == "POST" and path == "/api/lots":
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    lot = create_lot(conn, user, body)
                self._send_json({"lot": lot}, status=201)
                return

            if method == "POST" and len(parts) == 4 and parts[1] == "lots" and parts[3] == "adjust":
                lot_id = parts[2]
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    lot = adjust_lot_inventory(conn, user, lot_id, body)
                self._send_json({"lot": lot})
                return

            # Movimientos de Inventario (Kardex)
            if method == "GET" and path == "/api/inventory/movements":
                filters = {
                    "product_id": query.get("product_id", [None])[0],
                    "movement_type": query.get("movement_type", [None])[0],
                }
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    movs = list_inventory_movements(conn, user, filters)
                self._send_json({"movements": movs})
                return

            # Ventas
            if method == "POST" and path == "/api/sales":
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    sale = register_sale(conn, user, body)
                self._send_json({"sale": sale}, status=201)
                return

            if method == "GET" and path == "/api/sales":
                filters = {
                    "date_from": query.get("date_from", [None])[0],
                    "date_to": query.get("date_to", [None])[0],
                    "user_id": query.get("user_id", [None])[0],
                    "product_id": query.get("product_id", [None])[0],
                    "payment_method": query.get("payment_method", [None])[0],
                }
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    res = list_sales(conn, user, filters)
                self._send_json(res)
                return

            if method == "GET" and len(parts) == 3 and parts[1] == "sales":
                sale_id = parts[2]
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    sale = get_sale_by_id(conn, user, sale_id)
                self._send_json({"sale": sale})
                return

            # Administración de Usuarios (Exclusivo Dueño)
            if method == "GET" and path == "/api/users":
                with readonly_connection() as conn:
                    user = get_authenticated_user(conn, token)
                    users = list_users(conn, user)
                self._send_json({"users": users})
                return

            if method == "POST" and path == "/api/users":
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    created = create_user(conn, user, body)
                self._send_json({"user": created}, status=201)
                return

            if method == "PUT" and len(parts) == 3 and parts[1] == "users":
                target_id = parts[2]
                body = self._read_json_body()
                with transaction() as conn:
                    user = get_authenticated_user(conn, token)
                    updated = update_user(conn, user, target_id, body)
                self._send_json({"user": updated})
                return

            self._send_json({"error": "Endpoint de API no encontrado."}, status=404)

        except AuthError as err:
            self._send_json({"error": err.message}, status=err.status_code)
        except DomainError as err:
            self._send_json({"error": err.message}, status=err.status_code)
        except Exception as exc:
            traceback.print_exc()
            self._send_json(
                {"error": f"Error interno del servidor: {str(exc)}"},
                status=500,
            )


def run_server(host: str = "127.0.0.1", port: int = 8080) -> None:
    run_migrations()
    server = ThreadingHTTPServer((host, port), KairoRequestHandler)
    print(f"Kairo POS & Inventory Server activo en http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    port_arg = int(os.environ.get("PORT", "8080"))
    host_arg = os.environ.get("HOST", "127.0.0.1")
    run_server(host=host_arg, port=port_arg)
