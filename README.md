# TiendApp (Kairo) — Sistema POS, Inventario FEFO/FIFO y Motion UI

Plataforma comercial **Ultra-Minimalista y 100% Responsiva (PC vs Celular)** de Punto de Venta (POS) y Gestión de Inventario por Lotes desarrollada íntegramente en **HTML5, CSS3 y Vanilla JavaScript (ES6+ Modules)** con persistencia local estructurada en **IndexedDB + LocalStorage**.

---

## Despliegue en Vivo (Web Pública)

- **Landing Page 3D Interactiva (`/`):** [https://doritotes444.github.io/ejemplo/](https://doritotes444.github.io/ejemplo/)
- **Aplicación Operativa POS / Inventario (`/app/`):** [https://doritotes444.github.io/ejemplo/app/](https://doritotes444.github.io/ejemplo/app/)
- **Catálogo Opcional JSON (`data.json`):** [https://doritotes444.github.io/ejemplo/data.json](https://doritotes444.github.io/ejemplo/data.json)

---

## 1. Landing Page Premium y Efecto 3D ("Wow Factor")

Ubicada en la raíz del proyecto (`index.html`, `css/landing.css`, `js/landing.js`):

- **Diseño Minimalista con Alto Espacio en Blanco (Whitespace):** Sin párrafos extensos ni ruido visual; titulares directos de alto contraste e indicadores puntuales.
- **Fondo Interactivo 3D (`<canvas id="particle-network-canvas">`):** Red tridimensional de nodos y partículas conectadas con proyección de perspectiva `(x, y, z)` que reaccionan magnéticamente al cursor (estilo Vercel / Antigravity).
  - **Optimización Móvil Automática:** Reduce dinámicamente la densidad de nodos en pantallas móviles (`<= 768px`, `20` partículas frente a `72` en escritorio) y respeta `prefers-reduced-motion` para garantizar 60 FPS sin drenar batería.
- **Botones Principales (Call to Actions):**
  1. `¿Nuevo usuario? Registrarse` (`#btn-cta-register`) — Abre el modal de creación de tienda en blanco.
  2. `¿Ya tienes cuenta? Iniciar Sesión` (`#btn-cta-login`) — Permite ingresar directamente como **Dueño** o **Tendero**.
  3. `Dudas e Inquietudes` (`#btn-cta-faq`) — Despliega respuestas concisas sobre privacidad, arquitectura e inventario.

---

## 2. Onboarding en Blanco y Tutorial Interactivo Paso a Paso (Cero Datos Falsos Obligatorios)

1. **Tienda 100% en Blanco al Registrarse:**
   - Cuando un dueño registra su local (NIT, Nombre del dueño, Documento, Nombre del local, Dirección y Barrio), la tienda inicia **completamente limpia (`0` productos y `0` ventas)**. No se inyectan los 400 productos automáticamente al registrarse.
2. **Tutorial Interactivo Paso a Paso (`js/ui/tour.js`):**
   - Sistema guiado en Vanilla JS (estilo Intro.js) que acompaña y valida en tiempo real las 3 acciones esenciales:
     - **Paso 1 (`#/products`):** Crear su primer producto con lote inicial.
     - **Paso 2 (`#/pos`):** Realizar una venta de prueba en el Punto de Venta.
     - **Paso 3 (`#/inventory`):** Comprobar cómo se descontó automáticamente el stock en el Kardex y en el lote FEFO/FIFO.
3. **Panel de Ajustes con Toggles (`#/settings` — `js/ui/settings.js`):**
   - Interruptores interactivos (`role="switch"`) para activar o desactivar en caliente:
     - Modo Oscuro Premium
     - Mostrar Imágenes de Productos en el POS
     - Modo Compacto de Alta Densidad
     - Cámara Lectora al 50% de Pantalla (Vista Celular/POS)
     - Confirmación Sonora del Escáner (Beep Web Audio API)
     - Exigir Foto en Transferencias (Nequi / Bancolombia)
     - Tutorial Guiado Paso a Paso Activo (con botón para reiniciar el tour o importar opcionalmente el catálogo demo de 400 productos).

---

## 3. Sistema de Reseñas Privado ("Muro de Reseñas")

Implementado en `#/reviews` (`js/ui/reviews.js`) y persistido en el almacén `reviews` de `IndexedDB`:

- **Exclusivo para Usuarios Autenticados:** El **Muro de Reseñas** solo es accesible dentro del entorno privado `/app/` (tanto para **Dueño** como para **Tendero**) y jamás se expone en la Landing Page pública.
- **Calificación Interactiva:** Selector de 1 a 5 estrellas, categoría de experiencia (*Velocidad del POS*, *Control de Lotes FEFO*, *Escáner y Cámara*, *Interfaz Móvil / PC*), resumen en tiempo real del promedio de satisfacción y publicación instantánea con sello de tienda y rol.

---

## 4. Arquitectura 100% Responsiva (PC vs Celular) y Fallbacks de Imagen (`onerror`)

Una sola base de código CSS (`css/app.css`) y vistas adaptativas (`js/ui/shell.js`, `js/ui/pos.js`):

- **Versión PC (`Dueño`, `min-width: 901px`):**
  - **Menú Lateral Fijo (`.app-sidebar`):** Navegación vertical amplia con identificación del local, acceso directo a todas las áreas administrativas, **Panel de Métricas Rápidas** (Ventas del día, Producto más vendido, Alerta de bajo stock) y tablas ricas en datos para Productos, Lotes FEFO/FIFO, Kardex, Ventas y Usuarios.
- **Versión Celular (`Tendero / POS`, `max-width: 900px`):**
  - **Interfaz Tipo App Nativa:** Barra de Navegación Inferior fija (**Bottom Navigation Bar** `.app-bottom-nav`), botones gigantes de cobro pensados para operar con el pulgar (`.btn-thumb-giant`, `.bottom-nav-thumb-pay`) y cajón deslizable para el ticket.
  - **Lector de Barras al 50% de la Pantalla (`50vh`):** El panel `#pos-50vh-scanner-dock` acopla la cámara lectora (`html5-qrcode`) ocupando exactamente el **50% superior de la pantalla (`height: 50vh`)** para escanear productos sin salir del flujo de caja.
- **Imágenes Reales con Fallback Estético Garantizado (`onerror`):**
  - Todas las imágenes de productos conectadas a APIs públicas cuentan con el manejador `onerror="window.handleProductImageError && window.handleProductImageError(this)"`, que sustituye instantáneamente cualquier fallo de red por una miniatura vectorial SVG generada dinámicamente con el monograma y código del producto (`buildAestheticFallbackSVG`), evitando íconos rotos incluso sin conexión a internet.

---

## 5. Roles y Credenciales por Defecto

| Rol | Usuario | Contraseña | Permisos |
| :--- | :--- | :--- | :--- |
| **Dueño** | `dueno` | `Password2026!` | Acceso total: Sidebar PC, Métricas Rápidas, Tutorial Paso a Paso, POS, Productos, Lotes FEFO/FIFO, Kardex, Ventas, Muro de Reseñas Privado, Usuarios y Ajustes. |
| **Tendero** | `tendero` | `Tendero2026!` | Interfaz enfocada en el **Punto de Venta (`#/pos`)** con Bottom Navigation Bar móvil, cámara al 50% de pantalla, verificador de transferencias Nequi/Bancolombia y acceso al **Muro de Reseñas Privado (`#/reviews`)**. |

---

## 6. Estructura del Proyecto

```text
├── index.html                  # Landing Page Minimalista + Canvas 3D + 3 CTAs (Registro, Login, Dudas)
├── app/
│   └── index.html              # SPA Operativa (/app): POS, Inventario FEFO, Reseñas, Ajustes y Tour
├── db.js                       # Catálogo opcional ES6 (400 productos en COP)
├── data.json                   # Catálogo opcional JSON (400 productos en COP)
├── css/
│   ├── theme.css               # Sistema de diseño y variables de tema (Oscuro / Claro)
│   ├── base.css                # Reset tipográfico y componentes atómicos
│   ├── landing.css             # Estilos de alto espacio en blanco y animaciones de la Landing 3D
│   └── app.css                 # Arquitectura Dual: Sidebar PC, Bottom Nav Móvil, Cámara 50vh, Tour y Ajustes
├── js/
│   ├── landing.js              # Motor 3D de partículas en Canvas, modales CTA y registro de tienda en blanco
│   ├── app.js                  # Inicializador de la SPA en /app
│   ├── state.js                # Estado reactivo y lógica pura del carrito POS
│   ├── core/
│   │   ├── localStore.js       # Persistencia IndexedDB v4 (Productos, Lotes FEFO, Ventas, Reseñas, Tour, Ajustes, Fallback SVG)
│   │   ├── permissions.js      # Control de acceso por rol (Dueño vs Tendero)
│   │   ├── router.js           # Enrutador hash SPA con guardias de ruta
│   │   ├── session.js          # Gestión de sesión activa y Onboarding en blanco
│   │   └── theme.js            # Persistencia de tema oscuro/claro
│   ├── ui/
│   │   ├── shell.js            # Layout Dual: Sidebar lateral PC + Bottom Navigation Bar móvil + Métricas
│   │   ├── tour.js             # Tutorial Interactivo Paso a Paso (1. Producto -> 2. Venta -> 3. Stock/Kardex)
│   │   ├── pos.js              # Punto de Venta con Cámara 50vh, Botón Gigante para Pulgar y Fallback onerror
│   │   ├── reviews.js          # Muro de Reseñas Privado (exclusivo para usuarios logueados en /app)
│   │   ├── settings.js         # Panel de Ajustes con interruptores (Toggles) y reinicio de tutorial
│   │   ├── hardware.js         # Lector de código de barras (html5-qrcode) y Verificador Nequi/Bancolombia (<canvas>)
│   │   ├── lots.js             # Gestión de Productos, Lotes FEFO/FIFO, Kardex, Ventas y Usuarios
│   │   ├── receipt.js          # Comprobante imprimible con evidencia fotográfica y timestamp
│   │   ├── login.js            # Acceso por rol y creación de tienda en blanco
│   │   ├── dialog.js           # Modales accesibles
│   │   └── icons.js            # Iconografía vectorial SVG propia
│   └── utils/                  # Formateo COP, cantidades fraccionarias y validaciones
├── backend/
│   └── server.py               # Servidor HTTP local
└── tests/
    ├── test_frontend_logic.mjs # Pruebas unitarias de Carrito, FEFO/FIFO, RBAC, Reseñas/Ajustes y Fallback SVG
    └── test_backend_api.py     # Pruebas de integración del servidor HTTP
```

---

## 7. Ejecución Local y Pruebas

```bash
# Iniciar el servidor local en http://127.0.0.1:8080
python backend/server.py

# Ejecutar pruebas automatizadas de lógica frontend
node tests/test_frontend_logic.mjs
```
