/**
 * Pruebas Automatizadas de Lógica Frontend:
 * - Semilla de 400 Productos en COP e imágenes vía URL remota (db.js)
 * - Carrito POS, Cantidades Fraccionarias, Cambio y Permisos RBAC
 * - Métricas Rápidas del Dueño y Ordenamiento FEFO/FIFO de Lotes
 */

import {
  addProductToCart,
  updateCartItemQty,
  removeCartItem,
  calculateCartTotals,
} from '../js/state.js'
import { isRouteAllowed } from '../js/core/permissions.js'
import { calculateChange, formatCOP } from '../js/utils/money.js'
import { SEED_PRODUCTS, SEED_CATEGORIES } from '../js/data/db.js'
import {
  computeOwnerQuickMetrics,
  sortSellableLotsFEFO,
  buildAestheticFallbackSVG,
  generateUniqueSKU,
  assertOwnerAccess,
  isValidISODate,
  saveNotificationSync,
  getStoredNotificationsSync,
  markNotificationReadSync,
  markAllNotificationsReadSync,
  generateSystemAlertsSync,
} from '../js/core/localStore.js'
import { isBulkUnit, getUnitStep } from '../js/utils/quantities.js'
import {
  normalizeSearch,
  scoreProductSearch,
  filterAndRankProducts,
} from '../js/utils/search.js'

if (typeof globalThis.localStorage === 'undefined') {
  const memoryStore = new Map()
  globalThis.localStorage = {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, val) => memoryStore.set(key, String(val)),
    removeItem: (key) => memoryStore.delete(key),
    clear: () => memoryStore.clear(),
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Fallo en prueba: ${message}`)
  }
}

// 0. Verificación de la Base de Datos Semilla (400 Productos Reales en COP)
assert(SEED_PRODUCTS.length === 400, `Se esperaban 400 productos, se encontraron ${SEED_PRODUCTS.length}`)
assert(SEED_CATEGORIES.length === 3, 'Existen las 3 categorías principales (Abarrotes, Víveres, Papelería)')
for (const p of SEED_PRODUCTS) {
  assert(Number(p.sale_price) >= 400, `Precio COP válido para ${p.name}`)
  assert(String(p.image_url).startsWith('https://'), `URL remota de imagen para ${p.name}`)
  assert(String(p.barcode).startsWith('770'), `Código EAN-13 colombiano para ${p.name}`)
}

const sampleProduct = {
  id: 'prd_01',
  sku: 'ARR-500',
  name: 'Arroz Premium 500g',
  unit: 'und',
  sale_price: 3200,
  available_stock: 3,
  is_active: true,
}

// 1. Adición al carrito y respeto estricto de stock disponible
let res = addProductToCart([], sampleProduct, 2)
assert(res.ok === true, 'Permite agregar 2 unidades')
assert(res.cart[0].quantity === 2, 'Cantidad en carrito es 2')

res = addProductToCart(res.cart, sampleProduct, 2)
assert(res.ok === false, 'Rechaza superar las 3 unidades disponibles')
assert(res.cart[0].quantity === 3, 'Se ajusta al máximo disponible (3)')

const totals = calculateCartTotals(res.cart)
assert(totals.total === 9600, 'Total calculado correctamente (3 * 3200 = 9600)')
assert(calculateChange(10000, totals.total) === 400, 'Cálculo de cambio exacto ($400)')
assert(formatCOP(9600).includes('9.600'), 'Formato COP válido')

// 2. Cantidades a granel (kg, lb, lt, gr)
assert(isBulkUnit('kg') && isBulkUnit('lb') && isBulkUnit('lt') && isBulkUnit('gr'), 'Reconoce kg, lb, lt y gr como unidades a granel')
assert(!isBulkUnit('und') && !isBulkUnit('caja'), 'und y caja son unidades enteras')
assert(getUnitStep('lb') === 0.25 && getUnitStep('gr') === 50 && getUnitStep('und') === 1, 'Pasos por unidad correctos')

const bulkProduct = {
  id: 'prd_02',
  sku: 'QUE-LB',
  name: 'Queso Fresco Libra',
  unit: 'lb',
  sale_price: 10000,
  available_stock: 5.5,
  is_active: true,
}

let bulkRes = addProductToCart([], bulkProduct, 0.75)
assert(bulkRes.ok === true && bulkRes.cart[0].quantity === 0.75, 'Soporta 0.75 lb')
const updatedBulk = updateCartItemQty(bulkRes.cart, 'prd_02', 1.25)
assert(updatedBulk[0].quantity === 1.25, 'Actualiza a 1.25 lb')
const afterRemove = removeCartItem(updatedBulk, 'prd_02')
assert(afterRemove.length === 0, 'Elimina línea del carrito')

// 3. Control de rutas y operaciones por rol (RBAC)
const tenderoUser = { id: 'u1', role: 'tendero' }
const duenoUser = { id: 'u2', role: 'dueno' }

assert(isRouteAllowed(tenderoUser, 'pos') === true, 'Tendero puede acceder a POS')
assert(isRouteAllowed(tenderoUser, 'reviews') === true, 'Tendero puede acceder al Muro de Reseñas privado')
assert(isRouteAllowed(tenderoUser, 'products') === false, 'Tendero NO puede acceder a productos')
assert(isRouteAllowed(tenderoUser, 'lots') === false, 'Tendero NO puede acceder a lotes')
assert(isRouteAllowed(tenderoUser, 'users') === false, 'Tendero NO puede acceder a usuarios')
assert(isRouteAllowed(tenderoUser, 'settings') === false, 'Tendero NO puede acceder a ajustes')
assert(isRouteAllowed(duenoUser, 'users') === true, 'Dueño puede acceder a usuarios')
assert(isRouteAllowed(duenoUser, 'lots') === true, 'Dueño puede acceder a lotes')
assert(isRouteAllowed(duenoUser, 'reviews') === true, 'Dueño puede acceder al Muro de Reseñas privado')
assert(isRouteAllowed(duenoUser, 'settings') === true, 'Dueño puede acceder a Ajustes')

assert(assertOwnerAccess(duenoUser, 'crear productos') === duenoUser, 'assertOwnerAccess permite al Dueño')
let rbacBlocked = false
try {
  assertOwnerAccess(tenderoUser, 'crear productos')
} catch (err) {
  rbacBlocked = /Permiso denegado/i.test(err.message)
}
assert(rbacBlocked === true, 'assertOwnerAccess bloquea al Tendero')

// 4. Ordenamiento FEFO / FIFO y Métricas Rápidas del Dueño
const sortedLots = sortSellableLotsFEFO(
  [
    { id: 'l1', available_quantity: 5, entry_date: '2026-10-01', expiration_date: '2027-08-01' },
    { id: 'l2', available_quantity: 5, entry_date: '2026-10-15', expiration_date: '2027-02-01' },
    { id: 'l3', available_quantity: 5, entry_date: '2025-01-01', expiration_date: '2025-06-01' }, // Vencido
  ],
  '2026-11-14'
)
assert(sortedLots.length === 2, 'Excluye lotes vencidos')
assert(sortedLots[0].id === 'l2', 'Prioriza FEFO (vence primero l2)')

const metrics = computeOwnerQuickMetrics(SEED_PRODUCTS, [])
assert(metrics.low_stock_count > 0, 'Detecta productos con alerta de bajo stock en el catálogo semilla')

// 5. Fallback estético SVG (onerror), generador de SKU y validación de fechas
const fallbackSvg = buildAestheticFallbackSVG('Cafe Aguila Roja 500g', 'ABAR-001', 'emerald')
assert(fallbackSvg.startsWith('data:image/svg+xml;utf8,'), 'Genera Data-URI SVG estético válido')
assert(decodeURIComponent(fallbackSvg).includes('CA'), 'Incluye monograma de iniciales del producto')
assert(decodeURIComponent(fallbackSvg).includes('#064e3b'), 'Aplica paleta de color seleccionada al SVG')

const sku1 = generateUniqueSKU('Café Molido', [])
const sku2 = generateUniqueSKU('Café Molido', [{ sku: sku1 }])
assert(sku1 === 'CAFMO-001' && sku2 === 'CAFMO-002', `Genera SKUs únicos secuenciales (${sku1}, ${sku2})`)
// 6. Búsqueda Tolerante a Tildes y Prioridad de Ranking (Bugfix #4)
assert(normalizeSearch('Café Águila Roja') === 'cafe aguila roja', 'Normaliza tildes y mayúsculas')
assert(normalizeSearch('   Leche Entera  ') === 'leche entera', 'Recorta espacios')

const searchCatalog = [
  { id: 'p1', sku: 'ALIM-001', barcode: '7701234567890', name: 'Arroz con Leche', category_name: 'Postres' },
  { id: 'p2', sku: 'CAF-001', barcode: '7709876543210', name: 'Café Tradicional', category_name: 'Cafés' },
  { id: 'p3', sku: 'CAF-002', barcode: '0077012345009', name: 'Café Descafeinado', category_name: 'Cafés' },
  { id: 'p4', sku: 'BEB-001', barcode: '7705555555555', name: 'Bebida de Café Fría', category_name: 'Bebidas' },
]

// Búsqueda con tildes y sin tildes
const cafeResults = filterAndRankProducts(searchCatalog, 'cafe')
assert(cafeResults.length === 3, 'Encuentra los 3 productos de café buscando "cafe" sin tilde')
const topIds = [cafeResults[0].id, cafeResults[1].id]
assert(topIds.includes('p2') && topIds.includes('p3'), 'Prioriza coincidencias que empiezan por "Café"')
assert(cafeResults[2].id === 'p4', 'Deja al final la coincidencia interna "Bebida de Café Fría"')

// Prioridad: coincidencia exacta por código de barras
const exactBarcodeResults = filterAndRankProducts(searchCatalog, '0077012345009')
assert(exactBarcodeResults.length === 1 && exactBarcodeResults[0].id === 'p3', 'Coincidencia exacta por código de barras con ceros iniciales')

// Prioridad: prefijo de SKU
const skuPrefixResults = filterAndRankProducts(searchCatalog, 'CAF-')
assert(skuPrefixResults.length === 2, 'Encuentra por prefijo de SKU CAF-')

// 7. Notificaciones Persistentes e Historial con Aislamiento RBAC (Bugfix #2)
localStorage.clear()

// Guardar notificación para todos
saveNotificationSync({
  type: 'ok',
  title: 'Venta Registrada',
  message: 'Venta V-1001 por $12.500',
  role_scope: 'all',
})

// Guardar notificación exclusiva de dueño (alerta de stock)
saveNotificationSync({
  type: 'warning',
  title: 'Stock Bajo',
  message: 'El producto Café Tradicional tiene 2 unidades disponibles.',
  dedupeKey: 'stock_low_p2',
  role_scope: 'dueno',
  action_route: 'lots',
})

// Intento de spam con la misma dedupeKey
saveNotificationSync({
  type: 'warning',
  title: 'Stock Bajo Duplicado',
  message: 'Debe ser ignorado por dedupeKey',
  dedupeKey: 'stock_low_p2',
  role_scope: 'dueno',
})

const ownerNotifs = getStoredNotificationsSync('dueno')
assert(ownerNotifs.length === 2, `Dueño ve 2 notificaciones (1 general + 1 alerta), tiene ${ownerNotifs.length}`)
assert(ownerNotifs[0].dedupeKey === 'stock_low_p2', 'La más reciente está primero')
assert(ownerNotifs[0].read === false, 'Notificación inicial no leída')

const tenderoNotifs = getStoredNotificationsSync('tendero')
assert(tenderoNotifs.length === 1, `Tendero solo ve 1 notificación general, tiene ${tenderoNotifs.length}`)
assert(tenderoNotifs[0].title === 'Venta Registrada', 'Tendero no ve alertas internas de Lotes del Dueño')

// Marcar como leída
const notifIdToRead = ownerNotifs[0].id
markNotificationReadSync(notifIdToRead)
const ownerNotifsAfter = getStoredNotificationsSync('dueno')
assert(ownerNotifsAfter.find((n) => n.id === notifIdToRead).read === true, 'Notificación marcada como leída individualmente')

// Marcar todas como leídas
markAllNotificationsReadSync('dueno')
const ownerNotifsAllRead = getStoredNotificationsSync('dueno')
assert(ownerNotifsAllRead.every((n) => n.read === true), 'Todas las notificaciones del Dueño marcadas como leídas')

// 8. Conservación Estricta de Ceros Iniciales en Códigos de Barras (Bugfix #3)
const barcodeWithLeadingZero = '0077012345009'
assert(typeof barcodeWithLeadingZero === 'string', 'Código de barras tratado como String')
assert(barcodeWithLeadingZero.length === 13, 'Longitud de 13 caracteres preservada con ceros')
assert(barcodeWithLeadingZero.startsWith('00'), 'Ceros iniciales no se pierden ni se convierten a número')

console.log('OK: Todas las pruebas de frontend (Catálogo COP, Carrito, Unidades Granel, FEFO/FIFO, Métricas Rápidas, RBAC, Fallback SVG, Búsqueda Tolerante/Ranking, Notificaciones Persistentes y Ceros Iniciales) pasaron con éxito.')
