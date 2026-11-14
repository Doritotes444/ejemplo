# Kairo — Sistema de Inventario y Punto de Venta (POS)

Sistema comercial de Punto de Venta (POS), gestión de inventario, control de lotes por vencimiento (**FEFO / FIFO**) y administración de usuarios con autorización real en servidor.

Construido bajo una arquitectura minimalista y sin dependencias innecesarias:
- **Frontend:** SPA en **HTML5, CSS3, JavaScript Vanilla (ES6+ Modules) e iconografía SVG** propia.
- **Backend:** Servidor HTTP transaccional en **Python 3.12** con persistencia relacional en **SQLite 3 (`WAL` + `FOREIGN KEYS = ON`)**, hashing de contraseñas **PBKDF2-HMAC-SHA256** (260.000 iteraciones) y sesiones persistentes validadas en cada solicitud.

---

## 1. Filosofía e Identidad Visual

- **Minimalismo funcional:** Inspirado en herramientas de ingeniería de alta precisión (Linear, Vercel, Raycast). Tipografía con números tabulares (`tabular-nums`), bordes definidos de `1px`, radios moderados (`4px`–`8px`), cero emojis y cero elementos decorativos superfluos.
- **Identidad original (`Kairo`):** Logotipo vectorial SVG ([assets/icons/logo.svg](file:///C:/Users/doria/.gemini/antigravity/scratch/tiendapp/assets/icons/logo.svg)) y favicon SVG ([assets/icons/favicon.svg](file:///C:/Users/doria/.gemini/antigravity/scratch/tiendapp/assets/icons/favicon.svg)) integrados en la pantalla de acceso y en la barra de navegación.
- **Modo Oscuro y Claro nativo:** Detección inicial del sistema operativo (`prefers-color-scheme`) y persistencia de la preferencia del usuario.

---

## 2. Roles Operativos y Control de Acceso Real

El sistema contempla exclusivamente **dos roles operativos**, protegidos tanto en la interfaz SPA como en cada endpoint del backend ([backend/security.py](file:///C:/Users/doria/.gemini/antigravity/scratch/tiendapp/backend/security.py)):

| Módulo / Operación | Tendero (`tendero`) | Dueño (`dueno`) |
| :--- | :---: | :---: |
| Punto de Venta (POS), búsqueda por nombre/SKU/código de barras y carrito | Sí | Sí |
| Registro de ventas (`Efectivo`, `Nequi`, `Daviplata`) y cálculo de cambio | Sí | Sí |
| Generación e impresión de comprobantes de venta | Sí | Sí |
| Consulta de sus propias ventas operativas en el POS | Sí | Sí |
| Historial global de ventas con filtros por fecha, producto, usuario y método | No (403) | Sí |
| Creación, edición y activación/desactivación de productos y categorías | No (403) | Sí |
| Gestión de lotes (`FEFO / FIFO`), fechas de ingreso y fechas de vencimiento | No (403) | Sí |
| Registro de entradas, salidas por merma, ajustes y consulta de Kardex | No (403) | Sí |
| Creación de usuarios (`Tendero` / `Dueño`) y activación/desactivación | No (403) | Sí |

- **Interfaz limpia para el Tendero:** Al iniciar sesión como `Tendero`, la aplicación muestra únicamente el terminal de Punto de Venta. No existen pestañas administrativas ocultas ni botones deshabilitados.

---

## 3. Estructura del Proyecto

```text
├── assets/
│   └── icons/
│       ├── favicon.svg              # Favicon vectorial original
│       └── logo.svg                 # Logotipo vectorial Kairo
├── backend/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Esquema relacional normalizado (10 tablas)
│   ├── database.py                  # Conexión SQLite3, WAL, migraciones y transacciones ACID
│   ├── security.py                  # PBKDF2-HMAC-SHA256, sesiones persistentes y RBAC
│   ├── services.py                  # Reglas de negocio, FEFO/FIFO, Kardex y ventas atómicas
│   └── server.py                    # Servidor HTTP (API REST JSON + SPA estática)
├── css/
│   ├── theme.css                    # Variables de diseño para modo claro y oscuro
│   ├── base.css                     # Reset tipográfico, controles y números tabulares
│   └── app.css                      # Layout POS, tablas densas, diálogos y comprobante imprimible
├── docs/
│   └── ARQUITECTURA.md              # Documentación del modelo de datos, seguridad y API
├── js/
│   ├── app.js                       # Punto de entrada de la SPA
│   ├── state.js                     # Estado centralizado y lógica del carrito POS
│   ├── core/
│   │   ├── api.js                   # Cliente HTTP autenticado y manejo de errores
│   │   ├── permissions.js           # Reglas de visibilidad y rutas por rol
│   │   ├── router.js                # Enrutador SPA sin recarga de página
│   │   ├── session.js               # Flujo de inicialización, login y logout
│   │   └── theme.js                 # Detección y persistencia de tema Claro / Oscuro
│   ├── services/
│   │   ├── products.js              # Consumo de API de productos y categorías
│   │   ├── lots.js                  # Consumo de API de lotes y ajustes
│   │   ├── inventory.js             # Consumo de API de movimientos (Kardex)
│   │   ├── sales.js                 # Consumo de API de ventas e idempotencia
│   │   └── users.js                 # Consumo de API de usuarios
│   ├── ui/
│   │   ├── icons.js                 # Sistema de iconografía SVG y marca
│   │   ├── shell.js                 # Marco principal de la SPA y atajos de teclado
│   │   ├── login.js                 # Inicio de sesión e inicialización del primer Dueño
│   │   ├── pos.js                   # Terminal de Punto de Venta
│   │   ├── lots.js                  # Módulos administrativos del Dueño (Productos, Lotes, Kardex, Ventas, Usuarios)
│   │   ├── receipt.js               # Comprobante de venta imprimible
│   │   └── dialog.js                # Gestor de diálogos modales
│   └── utils/
│       ├── money.js                 # Formato monetario COP y cálculo de cambio
│       ├── quantities.js            # Cantidades enteras y a granel (3 decimales)
│       └── validation.js            # Validaciones de fechas y formularios
├── tests/
│   ├── test_backend_api.py          # Pruebas de integración del servidor, RBAC, FEFO y transacciones
│   └── test_frontend_logic.mjs      # Pruebas unitarias de estado, carrito y permisos SPA
└── index.html                       # Documento único de la aplicación
```

---

## 4. Ejecución e Inicialización Segura

### Requisitos
- **Python 3.11+** (no requiere instalar paquetes externos con `pip`; utiliza `sqlite3`, `hashlib`, `secrets` y `http.server` de la biblioteca estándar).

### Iniciar el Servidor
```bash
python backend/server.py
```
El servidor aplica automáticamente las migraciones SQL sobre `data/kairo_pos.sqlite3` y queda activo en `http://127.0.0.1:8080`.

### Creación del Primer Usuario Dueño
1. Al abrir `http://127.0.0.1:8080` por primera vez, el sistema detecta que no existen usuarios registrados y presenta el formulario de **Inicialización del Sistema** (`POST /api/auth/setup`).
2. Define el nombre completo, usuario y contraseña (mínimo 8 caracteres) del **Dueño** principal. No existen contraseñas predeterminadas ni usuarios ficticios precargados.
3. Una vez inicializado, el endpoint `/api/auth/setup` queda bloqueado permanentemente (`409 Conflict`).

---

## 5. Pruebas Automatizadas

Ejecutar las pruebas de integración del backend (autenticación, RBAC estricto, salida de lotes FEFO/FIFO, bloqueo de vencidos y atomicidad de ventas):
```bash
python tests/test_backend_api.py
```

Ejecutar las pruebas de lógica del frontend (carrito, granel, cambio y control de rutas):
```bash
node tests/test_frontend_logic.mjs
```
