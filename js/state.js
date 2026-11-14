import { roundQty, clampQty, isBulkUnit } from './utils/quantities.js'
import { roundMoney } from './utils/money.js'
import { getSessionUser, getCartStorageKey } from './core/session.js'

/**
 * Estado reactivo compartido y lógica pura del Carrito de Venta.
 * Rescata y corrige la lógica de CartContext.jsx:
 * - El carrito se aísla por tienda y usuario (tiendapp_cart:{tienda}:{usuario}).
 * - Valida cantidades finitas, precisión decimal (granel) y disponibilidad real derivada de lotes.
 * - Conserva el carrito activo cuando el Dueño alterna entre vistas o modales.
 */

export function addItemToCartList(cartList, producto, requestedDelta = 1) {
  const maxStock = roundQty(producto?.cantidad_disponible ?? producto?.cantidad_actual ?? 0)
  if (!producto?.id || maxStock <= 0) {
    return { cart: cartList, added: false, reason: 'Sin existencias disponibles para vender.' }
  }

  const delta = roundQty(requestedDelta)
  if (delta <= 0) {
    return { cart: cartList, added: false, reason: 'La cantidad debe ser mayor a cero.' }
  }

  const existing = cartList.find((item) => item.id === producto.id)
  if (existing) {
    const nextQty = roundQty(existing.cantidad + delta)
    if (nextQty > maxStock) {
      return {
        cart: cartList.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: maxStock, cantidad_disponible: maxStock }
            : item
        ),
        added: false,
        reason: `Stock máximo alcanzado (${maxStock} ${producto.unidad_medida || 'und'}).`,
      }
    }
    return {
      cart: cartList.map((item) =>
        item.id === producto.id
          ? {
              ...item,
              nombre: producto.nombre,
              precio_venta: roundMoney(producto.precio_venta),
              unidad_medida: producto.unidad_medida || 'unidad',
              cantidad_disponible: maxStock,
              cantidad: nextQty,
            }
          : item
      ),
      added: true,
      reason: null,
    }
  }

  const initialQty = isBulkUnit(producto.unidad_medida)
    ? Math.min(delta, maxStock)
    : Math.min(Math.max(1, Math.round(delta)), maxStock)

  if (initialQty <= 0) {
    return { cart: cartList, added: false, reason: 'Sin stock suficiente.' }
  }

  return {
    cart: [
      ...cartList,
      {
        id: producto.id,
        codigo_barras: producto.codigo_barras,
        nombre: producto.nombre,
        categoria: producto.categoria,
        unidad_medida: producto.unidad_medida || 'unidad',
        precio_venta: roundMoney(producto.precio_venta),
        foto_url: producto.foto_url || null,
        cantidad_disponible: maxStock,
        cantidad: roundQty(initialQty),
      },
    ],
    added: true,
    reason: null,
  }
}

export function decrementItemInCartList(cartList, productoId, step = 1) {
  const dec = roundQty(step)
  return cartList
    .map((item) => {
      if (item.id !== productoId) return item
      return { ...item, cantidad: roundQty(item.cantidad - dec) }
    })
    .filter((item) => item.cantidad > 0)
}

export function setItemQuantityInCartList(cartList, productoId, nuevaCantidad, maxAvailableOverride = null) {
  const parsed = roundQty(nuevaCantidad)
  if (parsed <= 0) {
    return cartList.filter((item) => item.id !== productoId)
  }
  return cartList
    .map((item) => {
      if (item.id !== productoId) return item
      const limit =
        maxAvailableOverride != null
          ? roundQty(maxAvailableOverride)
          : roundQty(item.cantidad_disponible)
      const clamped = clampQty(parsed, limit)
      return { ...item, cantidad: clamped, cantidad_disponible: limit }
    })
    .filter((item) => item.cantidad > 0)
}

export function removeItemFromCartList(cartList, productoId) {
  return cartList.filter((item) => item.id !== productoId)
}

export function calculateCartTotal(cartList) {
  return roundMoney(
    cartList.reduce(
      (acc, item) => acc + roundMoney(item.precio_venta) * roundQty(item.cantidad),
      0
    )
  )
}

// Estado global de la SPA
const state = {
  user: getSessionUser(),
  products: [], // Productos enriquecidos con stock derivado de sus lotes
  lots: [],
  sales: [],
  movements: [],
  cart: [],
  searchQuery: '',
  categoryFilter: 'Todas',
  onlyFrequent: false,
  paymentMethod: 'Efectivo',
  amountReceived: '',
  customerName: '',
  ownerPanelTab: 'lotes', // 'lotes' | 'ventas' | 'kardex'
  ownerDrawerOpen: false, // Panel integrado para Dueño en la misma pantalla
  feedback: null, // { type: 'ok'|'error'|'info', text: string }
}

const subscribers = new Set()

function persistCart() {
  try {
    if (typeof localStorage !== 'undefined') {
      const key = getCartStorageKey(state.user)
      localStorage.setItem(key, JSON.stringify(state.cart))
    }
  } catch {
    // ignore storage errors
  }
}

export function loadSavedCartForCurrentUser() {
  try {
    if (typeof localStorage !== 'undefined') {
      const key = getCartStorageKey(state.user)
      const raw = localStorage.getItem(key)
      state.cart = raw ? JSON.parse(raw) : []
    }
  } catch {
    state.cart = []
  }
  return state.cart
}

export function reconcileCartWithCatalog(products = state.products) {
  const prodMap = new Map(products.map((p) => [p.id, p]))
  const updated = []
  for (const item of state.cart) {
    const fresh = prodMap.get(item.id)
    if (!fresh || fresh.is_active === false) continue
    const available = roundQty(fresh.cantidad_disponible)
    if (available <= 0) continue
    const validQty = Math.min(roundQty(item.cantidad), available)
    if (validQty > 0) {
      updated.push({
        ...item,
        nombre: fresh.nombre,
        precio_venta: roundMoney(fresh.precio_venta),
        unidad_medida: fresh.unidad_medida,
        foto_url: fresh.foto_url,
        cantidad_disponible: available,
        cantidad: validQty,
      })
    }
  }
  state.cart = updated
  persistCart()
}

export function getState() {
  return state
}

export function setState(patch, notify = true) {
  Object.assign(state, patch)
  if ('cart' in patch) {
    persistCart()
  }
  if (notify) {
    emitChange()
  }
}

export function subscribe(fn) {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

export function emitChange() {
  for (const fn of subscribers) {
    try {
      fn(state)
    } catch (err) {
      console.error('Error en suscriptor de estado:', err)
    }
  }
}

export function showFeedback(type, text, autoClearMs = 4500) {
  state.feedback = { type, text, id: Date.now() }
  emitChange()
  if (autoClearMs > 0 && typeof setTimeout !== 'undefined') {
    const currentId = state.feedback.id
    setTimeout(() => {
      if (state.feedback?.id === currentId) {
        state.feedback = null
        emitChange()
      }
    }, autoClearMs)
  }
}
