# Tiendapp · Gestión Inteligente Neiva

Plataforma SaaS multi-inquilino (multi-tenant) y aplicación web progresiva (PWA) mobile-first diseñada para la administración integral de **tiendas de barrio, minimercados y microempresas en Colombia**.

Proyecto desarrollado en el marco del programa **Tecnólogo en Análisis y Desarrollo de Software (ADSO — Ficha 3413974, SENA)** por **Juan Pablo Doria Caviedes**.

---

## 1. Descripción Funcional y Propósito del Producto

**Tiendapp (Gestión Inteligente Neiva)** permite que un tendero o cajero sin conocimientos técnicos registre ventas en **menos de 3 segundos**, controle su inventario con fotografías reales, administre su cajón de efectivo y pagos digitales (Nequi, DaviPlata, Transferencias, Fiado), respalde comprobantes QR de forma privada y conozca en tiempo real si su negocio está ganando o perdiendo dinero.

### Módulos Integrados

1. **Catálogo de Productos con Fotografía Obligatoria:**
   - Captura desde cámara del celular, carga desde galería o compresión automática en cliente (`Canvas JPEG`) para ahorrar datos y memoria en celulares Android económicos.
   - Soporte para captura rápida provisional (`es_provisional`) durante una operación en mostrador, diferenciándola de un producto definitivamente registrado.
   - Aislamiento estricto multi-tienda de códigos de barras (`empresa_id`).
2. **Escáner de Códigos de Barras en Dos Contextos (`@zxing/browser` + Lector USB HID):**
   - **Escáner de Inventario:** Busca productos por código, abre el formulario con el código precargado si no existe, evita duplicados y registra entradas/salidas de existencias.
   - **Escáner de Caja:** Añade productos inmediatamente al carrito, incrementa unidades al repetir lectura y permite crear productos desconocidos al vuelo sin perder la venta actual.
3. **Flujo de Venta Rápida (`< 3 Segundos` POS):**
   - Cuadrícula visual de productos frecuentes con fotografía, precio y stock.
   - Selección en 1 toque de método de pago (`Efectivo`, `Nequi`, `DaviPlata`, `Transferencia`, `Tarjeta`, `Fiado`), denominaciones rápidas de billetes y cálculo automático de vueltas/cambio.
   - Cronómetro de latencia en vivo y anulación auditable de ventas (`POST /api/ventas/{empresa_id}/{venta_id}/anular`) con reversión automática de kardex y caja.
4. **Caja, Ingresos, Egresos y Arqueo (` SesionCaja` y `MovimientoCaja`):**
   - Apertura de turno con base inicial de efectivo.
   - Registro de entradas adicionales y salidas/gastos operativos o pagos a proveedores.
   - Cierre de turno con conteo de efectivo físico y cálculo automático de diferencia (`CUADRE_EXACTO`, `SOBRANTE`, `FALTANTE`).
5. **Escáner de Comprobantes QR y Bóveda Fotográfica Privada (`ComprobantePago`):**
   - Extracción de información estructurada desde códigos QR de pago (`POST /api/comprobantes/analizar-qr`).
   - Conservación simultánea en el dispositivo del tendero (`IndexedDB`) y en el servidor privado autenticado.
   - Distinción explícita y honesta entre **`CAPTURADO_NO_VERIFICADO`** (comprobante respaldado) y **`VERIFICADO_MANUALMENTE`** (pago confirmado en la app bancaria del comercio).
6. **Visión Financiera 360° y Rentabilidad (`GET /api/dashboard/{empresa_id}`):**
   - Diagnóstico inmediato: *«¿Estoy ganando o perdiendo dinero?»*.
   - Separación contable entre **Ventas Totales**, **Cobros Recibidos (Efectivo + Digital)**, **Ventas Fiadas (Cuentas por cobrar)**, **Costo de Mercancía Vendida (COGS)**, **Utilidad Bruta**, **Gastos/Egresos** y **Utilidad Neta**.
   - Ranking de productos más rentables y alertas de capital estancado (baja rotación en 30 días).
7. **Simulador Comercial Interactivo (`POST /api/reportes/simulador`):**
   - Simulación de cambios en precio de venta, costo de compra, descuentos, volumen estimado y gastos fijos/variables.
   - Cálculo de margen unitario, margen porcentual, utilidad neta estimada, punto de equilibrio en unidades/pesos y comparación contra escenario base.
8. **Suscripciones SaaS de 3 Planes Configurables (`PlanConfig`):**
   - Planes **Gratis (`basic`)**, **Standard (`standard`)** y **Pro (`pro`)** con límites configurables de productos, usuarios y ventas mensuales, más cambio de plan sin pérdida de información histórica.
9. **Funcionamiento Sin Conexión (Offline-First PWA + IndexedDB):**
   - Caché local del catálogo e imágenes de productos en `IndexedDB` (`tiendapp_offline_db`).
   - Cola persistente de operaciones (`venta`, `movimiento_inventario`, `movimiento_caja`, `comprobante`) con idempotencia garantizada mediante `client_operation_id` (`POST /api/sync/lote`).
10. **Panel SuperAdmin para el Equipo Desarrollador (`/superadmin`):**
    - Gestión de tiendas, activación/suspensión, extensión de período de prueba, configuración dinámica de los 3 planes comerciales, métricas globales de la plataforma, atención de tickets de soporte y bitácora de auditoría (`AuditLog`).

---

## 2. Arquitectura y Tecnologías Utilizadas

| Capa | Tecnología |
| :--- | :--- |
| **Backend API** | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Pydantic v2 · Uvicorn |
| **Base de Datos** | PostgreSQL (Producción / Supabase) · SQLite (Desarrollo local y pruebas) · Migraciones con **Alembic** (`001` a `013`) |
| **Seguridad** | JWT (`python-jose`), Hashing Bcrypt (`passlib`), Rate Limiting anti-fuerza bruta, recuperación de contraseña con tokens de un solo uso y `AuditLog` persistente |
| **Frontend Web / Móvil** | React 19 · Vite 6 · Tailwind CSS 4 · React Router 7 · Recharts · Lucide Icons |
| **Escáner y PWA** | `@zxing/browser` + `@zxing/library` · Service Worker (`sw.js`) · Web App Manifest · `IndexedDB` (`offlineDB.js`) |
| **Inteligencia Artificial** | Google Gemini (`google-genai`) para chatbot financiero/inventario y asistente de voz bidireccional |
| **Pruebas Automatizadas** | `pytest` + `FastAPI TestClient` (42 pruebas automatizadas de unidad e integración) |

---

## 3. Estructura del Proyecto

```text
├── alembic/                     # Migraciones de base de datos (001 a 013)
├── app/
│   ├── main.py                  # Punto de entrada FastAPI, CORS y registro de routers
│   ├── database.py              # Configuración de SQLAlchemy Engine y sesiones
│   ├── models.py                # Modelos ORM (Empresa, Usuario, Producto, Venta, SesionCaja, etc.)
│   ├── dependencies.py          # Dependencias de autenticación JWT y roles
│   ├── routers/                 # Endpoints REST (auth, productos, ventas, caja, comprobantes, sync, planes, dashboard, reportes, superadmin)
│   ├── schemas/                 # Esquemas de validación Pydantic v2
│   └── services/                # Lógica de negocio, auditoría, límites de plan e IA
├── frontend/
│   ├── public/                  # PWA manifest.webmanifest y Service Worker (sw.js)
│   └── src/
│       ├── components/          # Layout mobile-first, ModalProducto, ProductoCard, CartSidebar, BarcodeScanner
│       ├── context/             # AuthContext y CartContext
│       ├── hooks/               # useProductos, useVentas
│       ├── pages/               # Ventas (<3s POS), Inventario, Caja, ComprobantesQR, Simulador, Dashboard, Planes, SuperAdmin
│       └── services/            # authService, offlineDB (IndexedDB + compresor de imágenes)
├── tests/                       # Suite de pruebas automatizadas con pytest
├── .env.example                 # Plantilla de variables de entorno del backend
└── requirements.txt             # Dependencias de Python
```

---

## 4. Instalación y Ejecución Paso a Paso

### 4.1. Requisitos Previos
- **Python 3.11+** (recomendado Python 3.12)
- **Node.js 20+** y `npm`
- **PostgreSQL 14+** (o SQLite para ejecución local inmediata)

### 4.2. Configuración de Variables de Entorno

1. Copia el archivo `.env.example` en la raíz a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edita `.env` con tus valores locales:
   - `DATABASE_URL=sqlite:///./pos_local.db` (o tu cadena `postgresql://...`)
   - `SECRET_KEY=genera_una_clave_aleatoria_segura_de_al_menos_32_caracteres`
   - `SUPERADMIN_KEY=tu_clave_privada_superadmin`
3. Opcionalmente, en `frontend/`, copia `frontend/.env.example` a `frontend/.env`.

### 4.3. Instalación y Arranque del Backend

```bash
# Crear y activar entorno virtual
python -m venv .venv
# En Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# En Linux/macOS:
# source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar migraciones de base de datos
alembic upgrade head

# Iniciar servidor de desarrollo en http://localhost:8000
uvicorn app.main:app --reload --port 8000
```

### 4.4. Instalación y Arranque del Frontend

```bash
cd frontend
npm install

# Iniciar servidor de desarrollo en http://localhost:5173
npm run dev

# Compilar versión optimizada de producción
npm run build
```

---

## 5. Roles del Sistema y Flujo de Prueba

1. **Administrador / Dueño de Tienda (`rol = admin`):**
   - Puede crear su tienda desde `/registro` (`POST /api/auth/registro-completo`).
   - Tiene acceso completo al Dashboard 360°, Caja Rápida (`<3s`), Inventario con fotografías, Movimientos de Kardex, Arqueo de Caja, Bóveda de Comprobantes QR, Simulador Comercial, Reportes Excel, Planes y gestión de Cajeros.
2. **Cajero / Empleado (`rol = cajero`):**
   - Creado por el administrador de la tienda desde `/configuracion`.
   - Accede a Caja Rápida (`<3s`), consulta de Inventario, operación de Caja y captura de Comprobantes QR.
3. **SuperAdmin (`/superadmin`):**
   - Ingresa mediante la cabecera `x-superadmin-key` configurada en `SUPERADMIN_KEY` dentro de `.env`.

---

## 6. Ejecución de Pruebas Automatizadas

Para ejecutar la suite completa de pruebas automatizadas (42 tests de backend, seguridad, aislamiento multi-tenant, inventario, caja, QR, simulador y sincronización offline):

```bash
.\.venv\Scripts\pytest.exe -v
```
