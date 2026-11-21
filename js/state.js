import { roundMoney } from './utils/money.js'
import { roundQty, clampQty, isBulkUnit } from './utils/quantities.js'
import { saveNotificationSync } from './core/localStore.js'

/**
 * Gestión Centralizada de Estado de la SPA y Operaciones del Carrito POS.
 */

const state = {
  booting: true,
  initialized: false,
  storeProfile: null,
  user: null,
  route: 'pos',

  // Datos cargados desde IndexedDB
  categories: [],
  products: [],
  lots: [],
  movements: [],
  sales: [],
  salesSummary: {
    count: 0,
    grand_total: 0,
    by_payment_method: { efectivo: 0, nequi: 0, bancolombia: 0, daviplata: 0 },
  },
  users: [],

  // Estado operativo del POS y Hardware
  cart: [],
  posSearch: '',
  posCategory: 'ALL',
  posVisibleLimit: 60,
  paymentMethod: 'efectivo',
  amountReceived: '',
  saleNotes: '',
  transferVerification: null,
  mobileTicketOpen: false,
  mobileMenuOpen: false,
  lastCompletedSale: null,

  // Filtros en vistas de Dueño
  productSearch: '',
  productCategoryFilter: 'ALL',
  productStockFilter: 'ALL',
  productShowInactive: true,
  lotFilterStatus: 'ALL',
  lotFilterProduct: 'ALL',
  salesFilterFrom: '',
  salesFilterTo: '',
  salesFilterUser: '',
  salesFilterProduct: '',
  salesFilterMethod: '',

  // Notificación discreta y panel de historial
  toast: null,
  notificationsOpen: false,

  // Selección táctil en POS móvil (a una mano)
  posSelectedProductId: null,
  posSelectedQty: 1,
}

const listeners = new Set()

export function getState() {
  return state
}

export function setState(patch, notify = true) {
  Object.assign(state, patch)
  if (notify) {
    emitStateChange()
  }
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitStateChange() {
  for (const fn of listeners) {
    try {
      fn(state)
    } catch (err) {
      console.error('State listener error:', err)
    }
  }
}

let toastTimer = null

export function dismissToast() {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  if (state.toast) {
    state.toast = null
    emitStateChange()
  }
}

export function showToast(type, message, durationMs = 3800, options = {}) {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  state.toast = {
    type,
    message,
    id: Date.now(),
    actionText: options.actionText || null,
    actionRoute: options.actionRoute || null,
  }
  emitStateChange()

  // Guardar en el historial de notificaciones persistente si corresponde
  if (options.saveToHistory !== false && message) {
    try {
      saveNotificationSync({
        type: type === 'ok' ? 'ok' : type === 'error' ? 'error' : 'info',
        title: options.title || (type === 'ok' ? 'Operación exitosa' : type === 'error' ? 'Aviso o error' : 'Información'),
        message,
        dedupeKey: options.dedupeKey || null,
        role_scope: options.role_scope || 'all',
        action_route: options.action_route || null,
      })
    } catch {
      // Ignorar fallos de persistencia
    }
  }

  if (durationMs > 0) {
    const currentId = state.toast.id
    toastTimer = setTimeout(() => {
      if (state.toast?.id === currentId) {
        state.toast = null
        emitStateChange()
      }
    }, durationMs)
  }
}


// =============================================================================
// Lógica pura del Carrito POS
// =============================================================================

export function addProductToCart(cartList, product, delta = 1) {
  const maxStock = roundQty(product?.available_stock ?? 0)
  if (!product || !product.is_active || maxStock <= 0) {
    return {
      cart: cartList,
      ok: false,
      error: `Sin existencias disponibles para "${product?.name || 'el producto'}".`,
    }
  }

  const step = roundQty(delta)
  if (step <= 0) {
    return { cart: cartList, ok: false, error: 'Cantidad inválida.' }
  }

  const existing = cartList.find((item) => item.product_id === product.id)
  if (existing) {
    const nextQty = roundQty(existing.quantity + step)
    if (nextQty > maxStock) {
      return {
        cart: cartList.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: maxStock, available_stock: maxStock }
            : item
        ),
        ok: false,
        error: `Existencia máxima alcanzada (${maxStock} ${product.unit}).`,
      }
    }
    return {
      cart: cartList.map((item) =>
        item.product_id === product.id
          ? {
              ...item,
              name: product.name,
              sku: product.sku,
              unit: product.unit,
              unit_price: roundMoney(product.sale_price),
              available_stock: maxStock,
              quantity: nextQty,
            }
          : item
      ),
      ok: true,
      error: null,
    }
  }

  const initialQty = isBulkUnit(product.unit)
    ? Math.min(step, maxStock)
    : Math.min(Math.max(1, Math.round(step)), maxStock)

  return {
    cart: [
      ...cartList,
      {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        unit_price: roundMoney(product.sale_price),
        available_stock: maxStock,
        quantity: roundQty(initialQty),
      },
    ],
    ok: true,
    error: null,
  }
}

export function updateCartItemQty(cartList, productId, rawQuantity, maxOverride = null) {
  const qty = roundQty(rawQuantity)
  if (qty <= 0) {
    return cartList.filter((item) => item.product_id !== productId)
  }
  return cartList
    .map((item) => {
      if (item.product_id !== productId) return item
      const maxStock = maxOverride != null ? roundQty(maxOverride) : roundQty(item.available_stock)
      const clamped = clampQty(qty, maxStock)
      return { ...item, quantity: clamped, available_stock: maxStock }
    })
    .filter((item) => item.quantity > 0)
}

export function removeCartItem(cartList, productId) {
  return cartList.filter((item) => item.product_id !== productId)
}

export function calculateCartTotals(cartList) {
  const subtotal = roundMoney(
    cartList.reduce(
      (sum, item) => sum + roundMoney(item.unit_price) * roundQty(item.quantity),
      0
    )
  )
  return {
    subtotal,
    total: subtotal,
    itemsCount: cartList.length,
  }
}

export function syncCartWithProducts(products) {
  const map = new Map(products.map((p) => [p.id, p]))
  const synced = []
  for (const item of state.cart) {
    const fresh = map.get(item.product_id)
    if (!fresh || !fresh.is_active) continue
    const avail = roundQty(fresh.available_stock)
    if (avail <= 0) continue
    const q = Math.min(roundQty(item.quantity), avail)
    if (q > 0) {
      synced.push({
        ...item,
        name: fresh.name,
        sku: fresh.sku,
        unit: fresh.unit,
        unit_price: roundMoney(fresh.sale_price),
        available_stock: avail,
        quantity: q,
      })
    }
  }
  state.cart = synced
}
