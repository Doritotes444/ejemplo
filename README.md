# Tiendapp · POS Minimalista y Gestión de Lotes (FIFO)

Aplicación de página única (**SPA**) minimalista escrita **100 % en HTML5, CSS3 y Vanilla JavaScript (ES Modules)** con persistencia local en **IndexedDB**.

Diseñada sin frameworks ni herramientas de compilación para operar en una única pantalla compartida con separación de funciones por rol (**Tendero** y **Dueño**), control de inventario derivado de **Lotes (método FIFO con desempate FEFO)** y persistencia nativa de **Modo Oscuro**.

---

## 1. Características Principales

1. **SPA Minimalista 100 % Vanilla JS y CSS3 (`0` dependencias externas):**
   - Sin React, sin Vite, sin Tailwind y sin `node_modules`.
   - Carga inmediata mediante `<script type="module" src="./js/app.js"></script>`.
2. **Una sola interfaz con separación de permisos por rol:**
   - **Modo Tendero (`rol = tendero`):** Interfaz bloqueada exclusivamente para buscar productos, armar el carrito, cobrar y descontar existencias. No puede crear ni editar productos, ajustar lotes ni anular ventas.
   - **Modo Dueño (`rol = admin`, mostrado como «Dueño»):** Despliega en la **misma pantalla** (conservando el carrito activo) los controles y modales limpios para crear/editar productos, registrar lotes de compra, ajustar existencias/costos, anular ventas con reversión automática a los lotes originales y exportar/importar respaldos JSON. Incluye soporte opcional de PIN local para proteger el cambio a modo Dueño en mostrador.
3. **Gestión de Inventario por Lotes (Método FIFO + bloqueo de vencidos):**
   - El stock de cada producto no es un número estático: se deriva dinámicamente de la suma de sus **lotes vigentes**.
   - Al registrar una venta, el sistema descuenta unidades siguiendo el orden **FIFO** (*First-In, First-Out* por `fecha_entrada` ascendente) con desempate por fecha de vencimiento más próxima (**FEFO**) y **bloquea automáticamente los lotes vencidos**.
   - Si una venta requiere más unidades de las que tiene el primer lote, toma automáticamente el excedente del siguiente lote en la cola FIFO y registra la trazabilidad exacta en `AsignacionVentaLote` y `MovimientoInventario`.
   - Al anular una venta, las unidades regresan exactamente a los lotes de los cuales salieron.
4. **Persistencia de Modo Oscuro (`theme.css` + `js/core/theme.js`):**
   - Soporta modos **Claro**, **Oscuro** y **Sistema (Auto)**.
   - Sincroniza `prefers-color-scheme`, aplica variables CSS nativas (`color-scheme: light / dark`) y persiste la preferencia en `localStorage` (`tiendapp_theme`).

---

## 2. Permisos por Rol en la Misma Pantalla

| Función | Tendero (`tendero`) | Dueño (`admin`) |
| :--- | :---: | :---: |
| Buscar productos y consultar disponibilidad | Sí | Sí |
| Agregar al carrito (unidades o granel) y cobrar | Sí | Sí |
| Descuento automático de stock por lotes FIFO | Sí | Sí |
| Crear o editar productos y lotes | **No** | Sí |
| Ajustar existencias, costos y vencimientos | **No** | Sí |
| Anular ventas (devolviendo unidades a sus lotes) | **No** | Sí |
| Exportar e importar respaldos JSON | **No** | Sí |

> **Nota sobre seguridad local:** Al ser una aplicación 100 % local en el navegador con `IndexedDB`, la separación entre *Tendero* y *Dueño* (junto con el PIN opcional de mostrador) bloquea la interfaz operativa y valida las reglas en la capa de servicios para prevenir errores o cambios no autorizados en caja, aunque no sustituye a un servidor externo frente a alguien que manipule directamente las herramientas de desarrollador del navegador.

---

## 3. Estructura del Proyecto

```text
ejemplo/
├── index.html                  # Documento único de la SPA
├── README.md                   # Documentación general
├── .gitignore
├── assets/
│   └── icons/
│       └── favicon.svg
├── css/
│   ├── theme.css               # Variables de color y soporte nativo Light / Dark
│   ├── base.css                # Reset minimalista y controles atómicos
│   └── app.css                 # Layout POS, Panel Dueño integrado y Modales limpios
├── js/
│   ├── app.js                  # Punto de entrada e inicialización de módulos
│   ├── state.js                # Estado compartido, carrito aislado por usuario y eventos
│   ├── core/
│   │   ├── db.js               # IndexedDB nativo (productos, lotes, ventas, movimientos)
│   │   ├── session.js          # Sesión activa (Tendero / Dueño) y PIN opcional
│   │   ├── permissions.js      # Verificación de permisos antes de ejecutar acciones
│   │   └── theme.js            # Persistencia de Modo Oscuro / Claro / Sistema
│   ├── services/
│   │   ├── products.js         # Catálogo con stock derivado de lotes vigentes
│   │   ├── lots.js             # Reglas FIFO/FEFO, bloqueo de vencidos y CRUD de lotes
│   │   ├── sales.js            # Cobro, asignación multi-lote y anulación reversible
│   │   ├── inventory.js        # Kardex auditable por lote (MovimientoInventario)
│   │   ├── backup.js           # Exportación/importación JSON y semilla demo inicial
│   │   └── seedHelper.js       # Utilidades de fechas relativas para datos demo
│   ├── ui/
│   │   ├── shell.js            # Contenedor único, barra superior y atajos (F2 / Esc)
│   │   ├── login.js            # Conmutador de rol y modal de PIN de Dueño
│   │   ├── pos.js              # Mostrador de venta rápida y carrito con cálculo de vueltas
│   │   ├── lots.js             # Panel integrado del Dueño y modales de productos/lotes
│   │   └── dialog.js           # Gestor nativo de modales limpios
│   └── utils/
│       ├── money.js            # Formato COP y cálculo de vueltas
│       ├── quantities.js       # Cantidades enteras y fraccionarias (granel 3 decimales)
│       ├── validation.js       # Validaciones de dominio y fechas de vencimiento
│       └── images.js           # Compresión Canvas JPEG y placeholders SVG
├── docs/
│   └── ARQUITECTURA.md         # Modelo de datos y especificación técnica FIFO
├── landing/
│   ├── index.html              # Landing page optimizada para SEO ('inventario software')
│   └── style.css               # Estilos accesibles, tabla de planes, tutoriales y switch dark mode
└── tests/
    ├── runner.html             # Ejecutor visual de pruebas en el navegador
    ├── cart.test.js            # Pruebas de carrito y cantidades fraccionarias
    ├── lots.test.js            # Pruebas de ordenamiento y asignación FIFO/FEFO
    └── sales.test.js           # Pruebas de ventas, permisos y reversión por anulación
```

---

## 4. Ejecución Local y Pruebas

Al utilizar módulos nativos de JavaScript (`type="module"`), sirve la carpeta raíz con cualquier servidor HTTP estático:

```bash
# Opción 1: con Python 3
python -m http.server 8080

# Opción 2: con Node (npx serve)
npx serve -l 8080 .
```

1. Abre `http://localhost:8080` en tu navegador para usar el POS.
2. En la primera carga se inicializa automáticamente en `IndexedDB` el catálogo de demostración (**Tienda Don Chucho**) con productos por unidad y a granel, múltiples lotes activos con distintos costos y un lote vencido bloqueado para comprobar el comportamiento **FIFO** de inmediato.
3. Para ejecutar la suite de pruebas automatizadas:
   - En el navegador: abre `http://localhost:8080/tests/runner.html`.
   - Desde terminal con Node.js:
     ```bash
     node --input-type=module -e "import { registerCartTests } from './tests/cart.test.js'; import { registerLotsTests } from './tests/lots.test.js'; import { registerSalesTests } from './tests/sales.test.js'; const tests = []; const test = (n, f) => tests.push({n, f}); const assert = (c, m) => { if (!c) throw new Error(m); }; registerCartTests(test, assert); registerLotsTests(test, assert); registerSalesTests(test, assert); for (const t of tests) { await t.f(); console.log('OK:', t.n); }"
     ```
