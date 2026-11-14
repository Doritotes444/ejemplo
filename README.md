# Kairo — Sistema POS, Inventario FEFO/FIFO y Verificación por Cámara

Plataforma comercial **Mobile-First** de Punto de Venta (POS) y Gestión de Inventario por Lotes desarrollada íntegramente en **HTML5, CSS3 y Vanilla JavaScript (ES6+ Modules)** con persistencia local estructurada en **IndexedDB + LocalStorage** (y servidor HTTP integrado en Python).

---

## 1. Arquitectura de Entornos Separados (`/` vs `/app`)

El proyecto separa estrictamente el entorno público de captación y registro del entorno operativo de la aplicación:

| Ruta | Archivo Principal | Propósito |
| :--- | :--- | :--- |
| `/` | `index.html` + `js/landing.js` + `css/landing.css` | **Landing Page Pública y Onboarding de Creación de Tienda.** Si detecta que el usuario ya registró su tienda o tiene sesión activa en `LocalStorage` / `IndexedDB`, redirige automáticamente a `/app/` (salvo que se visite con `/?stay=1`). |
| `/app/` | `app/index.html` + `js/app.js` + `css/app.css` | **Aplicación SPA Operativa (POS, Inventario, Lotes FEFO/FIFO, Kardex, Ventas y Usuarios).** |
| `/db.js` y `/data.json` | `db.js`, `js/data/db.js`, `data.json` | **Catálogo Semilla de 400 Productos Reales** en Pesos Colombianos (COP). |

---

## 2. Funcionalidades Principales

### 2.1. Onboarding y Creación de Tienda
El flujo de registro solicita los datos legales y de ubicación del establecimiento comercial:
- **NIT del establecimiento** (ej. `901.482.310-4`)
- **Nombre del dueño** (ej. `Carlos Mendoza`)
- **Documento de identidad (C.C.)** (ej. `1020784512`)
- **Nombre del local** (ej. `Autoservicio y Papelería El Vecino`)
- **Dirección** (ej. `Calle 45 # 18-22`)
- **Barrio** (ej. `Chapinero Central`)

Al completar el formulario (desde la Landing Page en `/` o desde `/app/`), el sistema registra el establecimiento en `LocalStorage` (`kairo_store_profile_v3`) e `IndexedDB` (`kairo_pos_idb_v3`), siembra automáticamente los **400 productos** con sus lotes de apertura e inicia la sesión del **Dueño**.

### 2.2. Base de Datos Realista de 400 Productos en COP (`db.js` / `data.json`)
- **160 productos de Abarrotes:** Aceites, cafés, chocolatería, enlatados, pastas, harinas, salsas, snacks, galletas, aseo del hogar y cuidado personal.
- **140 productos de Víveres:** Arroz, granos (frijol, lenteja, garbanzo), azúcar, panela, lácteos, huevos, carnes frías, panadería y bebidas.
- **100 productos de Papelería:** Cuadernos cosidos y argollados, bolígrafos, lápices, colores, marcadores, borradores, pegantes, cintas, resmas de papel, carpetas, blocos y calculadoras.
- **Precios reales en Pesos Colombianos (COP)** y códigos de barras **EAN-13 (`770...`)**.
- **Imágenes dinámicas vía URL remota:** Generadas dinámicamente por categoría y semilla (`https://picsum.photos/seed/kairo-{categoria}-{id}/240/240`) con soporte complementario para `FakeStore API`, sin almacenar imágenes locales en el repositorio.

### 2.3. Integración de Hardware (Cámara y Escáner)
1. **Lector de Código de Barras (`html5-qrcode` vía CDN):**
   - Disponible desde el botón **Escanear Código** en la barra superior del POS y en la barra inferior móvil (`js/ui/hardware.js`).
   - Activa la cámara trasera del celular (`facingMode: "environment"`), decodifica códigos EAN-13 / QR y agrega automáticamente el producto al ticket de venta con confirmación sonora (Web Audio API).
   - Incluye selector de prueba rápida e ingreso directo de código EAN para equipos de escritorio sin cámara física.
2. **Verificador de Pagos (Nequi / Bancolombia) — Módulo "Verificar Transferencia":**
   - Al seleccionar transferencia (**Nequi** o **Bancolombia**) o pulsar **Verificar Transferencia**, abre la cámara trasera del dispositivo mediante `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })`.
   - Captura el frame de video en vivo dentro de un elemento `<canvas>`, estampa en la franja inferior la **fecha y hora exacta (`timestamp` ISO y hora local `es-CO`)**, la entidad, el monto en COP y el NIT del local, y guarda la evidencia fotográfica (`photo_data_url`) junto con el `timestamp` directamente en el registro de la venta en `IndexedDB`.

### 2.4. Valor Agregado: Métricas Rápidas del Dueño y Diseño Mobile-First
- **Panel de "Métricas Rápidas" (Exclusivo Dueño):**
  1. **Ventas del Día:** Total vendido hoy en COP, cantidad de operaciones del día y número de transferencias verificadas con fotografía.
  2. **Producto Más Vendido:** Identificación en tiempo real del artículo con mayor rotación en unidades e ingresos.
  3. **Alerta de Bajo Stock:** Contador de productos con stock disponible `<= stock_minimo` o agotados, con acceso directo al Kardex y reabastecimiento de lotes.
- **Interfaz Mobile-First Responsive:**
  - Barra inferior fija en dispositivos móviles (`<= 900px`) con acceso a un toque para **Escanear Código** y desplegar el **Ticket de Venta** tipo *bottom sheet*, diseñada para que el tendero opere cómodamente desde su teléfono celular.
- **Persistencia de Modo Oscuro / Claro:**
  - Detección inicial del sistema operativo y selector persistente en `LocalStorage` tanto en la Landing Page (`/`) como en la aplicación (`/app/`).

---

## 3. Roles y Credenciales Operativas

Una vez completado el Onboarding de la tienda, el sistema habilita dos perfiles con separación estricta de interfaz y rutas:

| Rol | Usuario por defecto | Contraseña por defecto | Permisos |
| :--- | :--- | :--- | :--- |
| **Dueño** | `dueno` | `Password2026!` | Acceso completo: Panel de Métricas Rápidas, POS, Catálogo de 400 Productos, Lotes FEFO/FIFO, Inventario/Kardex, Historial de Ventas con evidencia fotográfica y Usuarios. |
| **Tendero** | `tendero` | `Tendero2026!` | Interfaz bloqueada exclusivamente al **Punto de Venta (`#/pos`)**: búsqueda, escáner de cámara, verificador de transferencias Nequi/Bancolombia y registro de ventas. |

---

## 4. Estructura del Proyecto

```text
├── index.html                  # Entorno Público: Landing Page + Onboarding (redirige a /app si hay sesión)
├── app/
│   └── index.html              # Entorno de Aplicación: SPA POS & Inventario + CDN html5-qrcode
├── db.js                       # Base de datos semilla ES6 con 400 productos reales en COP
├── data.json                   # Base de datos semilla JSON con 400 productos reales en COP
├── css/
│   ├── theme.css               # Variables semánticas Modo Oscuro y Modo Claro
│   ├── base.css                # Reset tipográfico y controles base
│   ├── landing.css             # Estilos Mobile-First de la Landing Page y Onboarding
│   └── app.css                 # Estilos Mobile-First del POS, Métricas Rápidas y Modales de Cámara
├── js/
│   ├── landing.js              # Lógica de redirección automática, tema y Onboarding en Landing Page
│   ├── app.js                  # Inicializador de la SPA en /app
│   ├── state.js                # Estado reactivo y lógica pura del carrito POS
│   ├── data/
│   │   └── db.js               # Módulo de 400 productos (Abarrotes, Víveres y Papelería)
│   ├── core/
│   │   ├── localStore.js       # Motor IndexedDB + LocalStorage (FEFO/FIFO, Ventas, Onboarding, Métricas)
│   │   ├── permissions.js      # Control de acceso por rol (Dueño vs Tendero)
│   │   ├── router.js           # Enrutador SPA con guardias de ruta
│   │   ├── session.js          # Gestión de sesión activa y Onboarding
│   │   └── theme.js            # Persistencia de tema oscuro/claro
│   ├── services/               # Servicios desacoplados de Productos, Lotes, Inventario, Ventas y Usuarios
│   ├── ui/
│   │   ├── hardware.js         # Escáner de cámara (html5-qrcode) y Verificador Nequi/Bancolombia (<canvas>)
│   │   ├── shell.js            # Cabecera, navegación por rol y Panel de Métricas Rápidas del Dueño
│   │   ├── pos.js              # Punto de Venta Mobile-First con imágenes remotas y cobro
│   │   ├── lots.js             # Vistas administrativas de Productos, Lotes FEFO/FIFO, Kardex, Ventas y Usuarios
│   │   ├── receipt.js          # Comprobante imprimible con foto de transferencia y timestamp
│   │   ├── login.js            # Onboarding de tienda y selector de sesión en /app
│   │   ├── dialog.js           # Sistema de modales accesibles
│   │   └── icons.js            # Logotipo e iconografía vectorial SVG propia
│   └── utils/                  # Formateo COP, cantidades fraccionarias y validaciones
├── backend/
│   └── server.py               # Servidor HTTP local que sirve /, /app/ y endpoints REST
└── tests/
    ├── test_frontend_logic.mjs # Suite de pruebas de 400 productos, carrito, FEFO/FIFO, métricas y RBAC
    └── test_backend_api.py     # Suite de pruebas del servidor HTTP
```

---

## 5. Ejecución y Pruebas

1. **Iniciar el servidor local:**
   ```bash
   python backend/server.py
   ```
   - Landing Page y Onboarding: `http://127.0.0.1:8080/`
   - Panel POS e Inventario: `http://127.0.0.1:8080/app/`

2. **Ejecutar las pruebas automatizadas:**
   ```bash
   node tests/test_frontend_logic.mjs
   python tests/test_backend_api.py
   ```
