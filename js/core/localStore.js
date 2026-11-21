/**
 * js/core/localStore.js — Motor de Persistencia Local (IndexedDB + LocalStorage)
 * - Onboarding de Tienda EN BLANCO (Cero productos falsos obligatorios al registrarse)
 * - Estado del Tutorial Interactivo Paso a Paso (1. Crear producto -> 2. Venta de prueba -> 3. Ver descuento de stock)
 * - Panel de Ajustes con Toggles persistentes
 * - Muro de Reseñas Privado (almacenado en IndexedDB, exclusivo para usuarios logueados en /app)
 * - Lotes FEFO/FIFO, Kardex y Ventas con evidencia en <canvas>
 */

import { SEED_CATEGORIES, SEED_PRODUCTS } from '../data/db.js'

const IDB_NAME = 'kairo_pos_idb_v4'
const IDB_VERSION = 1

export const LS_KEYS = {
  STORE_PROFILE: 'tiendapp_store_profile_v4',
  ACTIVE_SESSION: 'tiendapp_active_session_v4',
  UI_SETTINGS: 'tiendapp_ui_settings_v4',
  TOUR_STATE: 'tiendapp_tour_state_v4',
  NOTIFICATIONS: 'tiendapp_notifications_v1',
}

const DEFAULT_UI_SETTINGS = {
  scannerSound: true,
  showThumbnails: true,
  requireTransferPhoto: false,
  compactDensity: false,
  inlineMobileScanner: false,
}

let dbPromise = null

export function getTodayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const PRODUCT_COLOR_PALETTE = [
  { id: 'slate', label: 'Grafito', bg: '#1e293b', accent: '#60a5fa' },
  { id: 'emerald', label: 'Esmeralda', bg: '#064e3b', accent: '#34d399' },
  { id: 'amber', label: 'Ámbar', bg: '#78350f', accent: '#fbbf24' },
  { id: 'rose', label: 'Terracota', bg: '#881337', accent: '#fb7185' },
  { id: 'indigo', label: 'Índigo', bg: '#312e81', accent: '#818cf8' },
  { id: 'teal', label: 'Petróleo', bg: '#134e4a', accent: '#2dd4bf' },
]

export const VALID_PRODUCT_UNITS = new Set(['und', 'kg', 'lb', 'lt', 'gr', 'caja'])

export function assertOwnerAccess(currentUser, actionLabel = 'realizar esta operación') {
  const user = currentUser || getActiveSessionSync()
  if (!user || user.role !== 'dueno') {
    throw new Error(`Permiso denegado: solo el Dueño puede ${actionLabel}.`)
  }
  return user
}

export function isValidISODate(dateStr) {
  if (!dateStr) return false
  const clean = String(dateStr).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return false
  const [y, m, d] = clean.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function generateUniqueSKU(name = 'PROD', existingProducts = []) {
  const normalized = String(name || 'PRD')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
  const words = normalized.split(/\s+/).filter(Boolean)
  let prefix = ''
  if (words.length >= 2) {
    prefix = (words[0].slice(0, 3) + words[1].slice(0, 2)).toUpperCase()
  } else if (words.length === 1) {
    prefix = words[0].slice(0, 4).toUpperCase()
  }
  if (prefix.length < 2) prefix = 'PRD'

  const existingSet = new Set(
    (existingProducts || []).map((p) => String(p.sku || '').trim().toUpperCase())
  )
  for (let i = 1; i <= 999; i++) {
    const candidate = `${prefix}-${String(i).padStart(3, '0')}`
    if (!existingSet.has(candidate)) return candidate
  }
  return `${prefix}-${Date.now().toString().slice(-4)}`
}

/**
 * Genera una miniatura SVG estética en Data URI como fallback infalible (onerror)
 * para que jamás se muestre un ícono de imagen rota.
 */
export function buildAestheticFallbackSVG(name = 'Producto', sku = 'POS', colorId = 'slate') {
  const palette =
    PRODUCT_COLOR_PALETTE.find((c) => c.id === colorId) || PRODUCT_COLOR_PALETTE[0]
  const initials =
    String(name || 'PR')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase() || 'PR'
  const cleanSku = String(sku || 'ITEM').slice(0, 10).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.bg}"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="160" height="160" rx="14" fill="url(#g)"/>
    <circle cx="80" cy="66" r="28" fill="rgba(255,255,255,0.08)" stroke="${palette.accent}" stroke-opacity="0.55" stroke-width="1.5"/>
    <text x="80" y="74" text-anchor="middle" fill="${palette.accent}" font-family="system-ui,sans-serif" font-size="22" font-weight="700">${initials.replace(/[<>&"']/g, '')}</text>
    <text x="80" y="124" text-anchor="middle" fill="#cbd5e1" font-family="monospace" font-size="12" font-weight="600">${cleanSku.replace(/[<>&"']/g, '')}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

if (typeof window !== 'undefined') {
  window.handleProductImageError = function (imgEl, name, sku, colorId) {
    if (!imgEl || imgEl.dataset.fallbackApplied === '1') return
    imgEl.dataset.fallbackApplied = '1'
    imgEl.src = buildAestheticFallbackSVG(
      name || imgEl.alt || 'Producto',
      sku || imgEl.dataset.sku || 'ITEM',
      colorId || imgEl.dataset.color || 'slate'
    )
  }
}

export function openLocalDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      const stores = [
        'store_profile',
        'users',
        'categories',
        'products',
        'lots',
        'sales',
        'movements',
        'reviews',
      ]
      for (const name of stores) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }

    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })

  return dbPromise
}

async function getAllFromStore(storeName) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function putInStore(storeName, record) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.put(record)
    req.onsuccess = () => resolve(record)
    req.onerror = () => reject(req.error)
  })
}

async function clearObjectStore(storeName) {
  const db = await openLocalDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export function getStoredProfileSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.STORE_PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getActiveSessionSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.ACTIVE_SESSION)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setActiveSessionSync(user) {
  if (!user) {
    localStorage.removeItem(LS_KEYS.ACTIVE_SESSION)
  } else {
    localStorage.setItem(LS_KEYS.ACTIVE_SESSION, JSON.stringify(user))
  }
}

/**
 * Gestión de Ajustes de Interfaz (Toggles)
 */
export function getUISettingsSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.UI_SETTINGS)
    return raw ? { ...DEFAULT_UI_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_UI_SETTINGS }
  } catch {
    return { ...DEFAULT_UI_SETTINGS }
  }
}

export function saveUISettingsSync(patch) {
  const next = { ...getUISettingsSync(), ...patch }
  localStorage.setItem(LS_KEYS.UI_SETTINGS, JSON.stringify(next))
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(
      'data-density',
      next.compactDensity ? 'compact' : 'comfortable'
    )
  }
  return next
}

/**
 * Gestión del Tutorial Interactivo Paso a Paso (Tour)
 * Pasos:
 * 1 -> Crear su primer producto
 * 2 -> Hacer una venta de prueba en el POS
 * 3 -> Ver cómo se descontó el stock en Inventario/Kardex
 * 4 -> Completado
 */
export function getTourStateSync() {
  try {
    const raw = localStorage.getItem(LS_KEYS.TOUR_STATE)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    active: true,
    step: 1,
    completed: false,
  }
}

export function saveTourStateSync(patch) {
  const current = getTourStateSync()
  const next = { ...current, ...patch }
  localStorage.setItem(LS_KEYS.TOUR_STATE, JSON.stringify(next))
  return next
}

export function syncTourProgress(productsCount, salesCount) {
  const cur = getTourStateSync()
  if (cur.completed || !cur.active) return cur

  let nextStep = cur.step
  if (productsCount === 0) {
    nextStep = 1
  } else if (productsCount >= 1 && salesCount === 0 && cur.step < 2) {
    nextStep = 2
  } else if (productsCount >= 1 && salesCount >= 1 && cur.step < 3) {
    nextStep = 3
  }

  if (nextStep !== cur.step) {
    return saveTourStateSync({ step: nextStep })
  }
  return cur
}

/**
 * Gestión del Historial de Notificaciones Persistente y Alertas del Sistema
 */
export function getStoredNotificationsSync(role = 'all') {
  try {
    const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS)
    const list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    if (role === 'dueno') {
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    return list
      .filter((n) => n.role_scope === 'all' || n.role_scope === 'tendero')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } catch {
    return []
  }
}

export function saveNotificationSync({
  type = 'info',
  title = '',
  message = '',
  dedupeKey = null,
  role_scope = 'all',
  action_route = null,
}) {
  try {
    const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS)
    let list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) list = []

    if (dedupeKey) {
      const existing = list.find((n) => n.dedupeKey === dedupeKey)
      if (existing) {
        return existing
      }
    }

    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type, // 'info' | 'ok' | 'warning' | 'error'
      title: String(title || ''),
      message: String(message || ''),
      dedupeKey: dedupeKey || null,
      role_scope, // 'all' | 'dueno' | 'tendero'
      action_route: action_route || null,
      read: false,
      created_at: new Date().toISOString(),
    }

    list.unshift(newNotif)
    if (list.length > 100) list = list.slice(0, 100)
    localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(list))
    return newNotif
  } catch {
    return null
  }
}

export function markNotificationReadSync(id) {
  try {
    const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS)
    let list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    list = list.map((n) => (n.id === id ? { ...n, read: true } : n))
    localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(list))
    return list
  } catch {
    return []
  }
}

export function markAllNotificationsReadSync(role = 'all') {
  try {
    const raw = localStorage.getItem(LS_KEYS.NOTIFICATIONS)
    let list = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    list = list.map((n) => {
      if (role === 'dueno' || n.role_scope === 'all' || n.role_scope === 'tendero') {
        return { ...n, read: true }
      }
      return n
    })
    localStorage.setItem(LS_KEYS.NOTIFICATIONS, JSON.stringify(list))
    return list
  } catch {
    return []
  }
}

export function getUnreadNotificationsCountSync(role = 'all') {
  const notifs = getStoredNotificationsSync(role)
  return notifs.filter((n) => !n.read).length
}

export function generateSystemAlertsSync({ products = [], lots = [], user = null }) {
  if (!user || user.role !== 'dueno') return
  const now = new Date()

  for (const p of products) {
    if (!p.is_active) continue
    const stock = Number(p.available_stock || 0)
    const minStock = Number(p.min_stock_alert || 5)
    if (stock <= 0) {
      saveNotificationSync({
        type: 'error',
        title: 'Producto Agotado',
        message: `El producto "${p.name}" (${p.sku}) no tiene existencias disponibles.`,
        dedupeKey: `stock_zero_${p.id}`,
        role_scope: 'dueno',
        action_route: 'products',
      })
    } else if (stock <= minStock) {
      saveNotificationSync({
        type: 'warning',
        title: 'Stock Mínimo Alcanzado',
        message: `El producto "${p.name}" cuenta con solo ${stock} ${p.unit} (mínimo: ${minStock}).`,
        dedupeKey: `stock_low_${p.id}`,
        role_scope: 'dueno',
        action_route: 'products',
      })
    }
  }

  for (const l of lots) {
    if (!l.expiration_date) continue
    const expDate = new Date(`${l.expiration_date}T23:59:59`)
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) {
      saveNotificationSync({
        type: 'error',
        title: 'Lote Vencido',
        message: `El lote ${l.lot_number} de "${l.product_name}" venció el ${l.expiration_date}.`,
        dedupeKey: `lot_exp_${l.id}`,
        role_scope: 'dueno',
        action_route: 'lots',
      })
    } else if (diffDays <= 30) {
      saveNotificationSync({
        type: 'warning',
        title: 'Lote Próximo a Vencer',
        message: `El lote ${l.lot_number} de "${l.product_name}" vence en ${diffDays} días (${l.expiration_date}).`,
        dedupeKey: `lot_soon_${l.id}`,
        role_scope: 'dueno',
        action_route: 'lots',
      })
    }
  }
}


/**
 * Asegura únicamente las categorías base (sin agregar productos falsos automáticamente)
 */
export async function ensureBaseCategories() {
  const existingCats = await getAllFromStore('categories')
  if (existingCats.length > 0) return existingCats

  const nowISO = new Date().toISOString()
  for (const cat of SEED_CATEGORIES) {
    await putInStore('categories', {
      id: String(cat.id),
      name: cat.name,
      description: cat.description || '',
      created_at: nowISO,
    })
  }
  return getAllFromStore('categories')
}

/**
 * Opción manual (solo bajo petición explícita en Ajustes) para cargar el catálogo de 400 productos
 */
export async function loadOptional400Catalog(currentUser) {
  assertOwnerAccess(currentUser, 'importar el catálogo demo')
  await ensureBaseCategories()
  const db = await openLocalDB()
  const nowISO = new Date().toISOString()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['products', 'lots', 'movements'], 'readwrite')
    const prodStore = tx.objectStore('products')
    const lotStore = tx.objectStore('lots')
    const movStore = tx.objectStore('movements')

    for (const p of SEED_PRODUCTS) {
      const lotId = `lot-${p.id}`
      const initLot = p.initial_lot || {
        lot_number: `L-2026-${p.sku}`,
        quantity: p.available_stock || 20,
        unit_cost: p.unit_cost || Math.round(p.sale_price * 0.7),
        entry_date: '2026-11-01',
        expiration_date: null,
      }

      prodStore.put({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category_id: String(p.category_id),
        category_name: p.category_name,
        unit: p.unit || 'und',
        sale_price: Number(p.sale_price),
        unit_cost: Number(p.unit_cost || initLot.unit_cost),
        min_stock: Number(p.min_stock ?? 6),
        is_active: true,
        image_url: p.image_url,
        created_at: nowISO,
        updated_at: nowISO,
      })

      lotStore.put({
        id: lotId,
        product_id: p.id,
        lot_number: initLot.lot_number,
        initial_quantity: Number(initLot.quantity),
        available_quantity: Number(initLot.quantity),
        unit_cost: Number(initLot.unit_cost),
        entry_date: initLot.entry_date || '2026-11-01',
        expiration_date: initLot.expiration_date || null,
        notes: 'Catálogo semilla opcional',
        created_at: nowISO,
      })
    }

    movStore.put({
      id: `mov-seed-${Date.now()}`,
      product_id: SEED_PRODUCTS[0].id,
      product_name: 'Importación Manual Catálogo (400 productos)',
      product_sku: 'SEED-400',
      product_unit: 'und',
      lot_id: `lot-${SEED_PRODUCTS[0].id}`,
      lot_number: 'L-2026-IMPORT',
      movement_type: 'ENTRADA',
      quantity: 400,
      previous_stock: 0,
      new_stock: 400,
      reason: 'Importación opcional desde Ajustes',
      user_name: 'Dueño',
      created_at: nowISO,
    })

    tx.oncomplete = () => resolve(SEED_PRODUCTS.length)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Registra la tienda en el Onboarding:
 * REQUISITO ESTRICTO: Cuando un dueño se registra, su tienda debe estar EN BLANCO.
 * No se agregan los 400 productos automáticamente; se inicia el Tutorial Paso a Paso en el Paso 1.
 */
export async function registerStoreOnboarding(payload) {
  const nit = String(payload.nit || '').trim()
  const owner_name = String(payload.owner_name || '').trim()
  const owner_document = String(payload.owner_document || '').trim()
  const store_name = String(payload.store_name || '').trim()
  const address = String(payload.address || '').trim()
  const neighborhood = String(payload.neighborhood || '').trim()
  const username = String(payload.username || 'dueno').trim().toLowerCase()
  const password = String(payload.password || 'Password2026!')

  if (!nit || !owner_name || !owner_document || !store_name || !address || !neighborhood) {
    throw new Error(
      'Todos los datos del establecimiento son obligatorios: NIT, Nombre del dueño, Documento de identidad, Nombre del local, Dirección y Barrio.'
    )
  }

  // Limpiar productos, lotes y ventas previos para garantizar una tienda 100% en blanco al registrarse
  await Promise.all([
    clearObjectStore('products'),
    clearObjectStore('lots'),
    clearObjectStore('sales'),
    clearObjectStore('movements'),
  ])

  await ensureBaseCategories()

  const nowISO = new Date().toISOString()
  const profile = {
    id: 'main_store',
    nit,
    owner_name,
    owner_document,
    store_name,
    address,
    neighborhood,
    registered_at: nowISO,
  }

  const ownerUser = {
    id: 'usr-dueno-1',
    username,
    full_name: owner_name,
    document_id: owner_document,
    role: 'dueno',
    role_name: 'Dueño',
    password,
    is_active: true,
    created_at: nowISO,
  }

  const tenderoUser = {
    id: 'usr-tendero-1',
    username: 'tendero',
    full_name: 'Operador de Caja (Tendero)',
    document_id: '1000000001',
    role: 'tendero',
    role_name: 'Tendero',
    password: 'Tendero2026!',
    is_active: true,
    created_at: nowISO,
  }

  await putInStore('store_profile', profile)
  await putInStore('users', ownerUser)
  await putInStore('users', tenderoUser)

  // Sembrar una reseña inicial de bienvenida en el Muro de Reseñas Privado
  const existingReviews = await getAllFromStore('reviews')
  if (existingReviews.length === 0) {
    await putInStore('reviews', {
      id: 'rev-welcome-1',
      author_name: owner_name,
      author_role: 'Dueño',
      store_name,
      rating: 5,
      category: 'Diseño y Usabilidad',
      comment: `Tienda "${store_name}" configurada exitosamente en TiendApp. Lista para operar en PC y móvil.`,
      created_at: nowISO,
    })
  }

  localStorage.setItem(LS_KEYS.STORE_PROFILE, JSON.stringify(profile))
  saveTourStateSync({ active: true, step: 1, completed: false })

  const sessionUser = {
    id: ownerUser.id,
    username: ownerUser.username,
    full_name: ownerUser.full_name,
    document_id: ownerUser.document_id,
    role: ownerUser.role,
    role_name: ownerUser.role_name,
    store: profile,
  }
  setActiveSessionSync(sessionUser)
  return { profile, user: sessionUser }
}

export function computeLotStatus(lot, todayISO = getTodayISO()) {
  const avail = Number(lot.available_quantity || 0)
  if (avail <= 0) {
    return { status: 'AGOTADO', days_to_expire: null, is_sellable: false }
  }
  if (!lot.expiration_date) {
    return { status: 'DISPONIBLE', days_to_expire: null, is_sellable: true }
  }
  const todayMs = new Date(`${todayISO}T00:00:00`).getTime()
  const expMs = new Date(`${lot.expiration_date}T00:00:00`).getTime()
  const diffDays = Math.round((expMs - todayMs) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { status: 'VENCIDO', days_to_expire: diffDays, is_sellable: false }
  }
  if (diffDays <= 7) {
    return { status: 'PROXIMO_A_VENCER', days_to_expire: diffDays, is_sellable: true }
  }
  return { status: 'DISPONIBLE', days_to_expire: diffDays, is_sellable: true }
}

export function sortSellableLotsFEFO(lots, todayISO = getTodayISO()) {
  return lots
    .map((l) => ({ ...l, ...computeLotStatus(l, todayISO) }))
    .filter((l) => l.is_sellable && Number(l.available_quantity) > 0)
    .sort((a, b) => {
      const aHasExp = Boolean(a.expiration_date)
      const bHasExp = Boolean(b.expiration_date)
      if (aHasExp && !bHasExp) return -1
      if (!aHasExp && bHasExp) return 1
      if (aHasExp && bHasExp && a.expiration_date !== b.expiration_date) {
        return a.expiration_date.localeCompare(b.expiration_date)
      }
      if (a.entry_date !== b.entry_date) {
        return String(a.entry_date || '').localeCompare(String(b.entry_date || ''))
      }
      return String(a.id).localeCompare(String(b.id))
    })
}

export async function getCatalogWithStock() {
  await ensureBaseCategories()
  const [categories, products, lots] = await Promise.all([
    getAllFromStore('categories'),
    getAllFromStore('products'),
    getAllFromStore('lots'),
  ])

  const today = getTodayISO()
  const catMap = new Map(categories.map((c) => [String(c.id), c.name]))
  const lotsByProd = new Map()

  for (const l of lots) {
    const arr = lotsByProd.get(l.product_id) || []
    arr.push(l)
    lotsByProd.set(l.product_id, arr)
  }

  const enrichedProducts = products.map((p) => {
    const prodLots = lotsByProd.get(p.id) || []
    const sellable = sortSellableLotsFEFO(prodLots, today)
    const available_stock = Number(
      sellable.reduce((acc, l) => acc + Number(l.available_quantity || 0), 0).toFixed(3)
    )
    const expired_stock = Number(
      prodLots
        .filter((l) => computeLotStatus(l, today).status === 'VENCIDO')
        .reduce((acc, l) => acc + Number(l.available_quantity || 0), 0)
        .toFixed(3)
    )
    const expiring_soon_count = sellable.filter((l) => l.status === 'PROXIMO_A_VENCER').length
    const nextLot = sellable[0] || null
    const catIdStr = p.category_id != null && p.category_id !== '' ? String(p.category_id) : null

    return {
      ...p,
      category_id: catIdStr,
      category_name: catIdStr
        ? catMap.get(catIdStr) || p.category_name || 'Sin categoría'
        : 'Sin categoría',
      available_stock,
      expired_stock,
      active_lots_count: sellable.length,
      expiring_soon_count,
      next_lot_number: nextLot ? nextLot.lot_number : null,
      next_expiration: nextLot ? nextLot.expiration_date : null,
      is_low_stock: available_stock <= Number(p.min_stock ?? 5),
    }
  })

  return {
    categories,
    products: enrichedProducts,
  }
}

export async function getEnrichedLots(currentUser) {
  assertOwnerAccess(currentUser, 'consultar los lotes de inventario')
  const [products, lots] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('lots'),
  ])
  const prodMap = new Map(products.map((p) => [p.id, p]))
  const today = getTodayISO()

  return lots
    .map((l) => {
      const p = prodMap.get(l.product_id) || {}
      const st = computeLotStatus(l, today)
      return {
        ...l,
        product_name: p.name || 'Producto',
        product_sku: p.sku || '—',
        product_unit: p.unit || 'und',
        status: st.status,
        days_to_expire: st.days_to_expire,
        is_sellable: st.is_sellable,
      }
    })
    .sort((a, b) => {
      const aExp = a.expiration_date || '9999-12-31'
      const bExp = b.expiration_date || '9999-12-31'
      return aExp.localeCompare(bExp)
    })
}

export async function getInventoryMovements(currentUser) {
  assertOwnerAccess(currentUser, 'consultar el historial de movimientos (Kardex)')
  const movs = await getAllFromStore('movements')
  return movs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

export async function createLocalSale(payload, currentUser) {
  const actor = currentUser || getActiveSessionSync()
  if (!actor) {
    throw new Error('Debes iniciar sesión para registrar una venta.')
  }

  const rawItems = Array.isArray(payload?.items) ? payload.items : []
  if (rawItems.length === 0) {
    throw new Error('El ticket de venta está vacío.')
  }

  const [products, lots, existingSales] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('lots'),
    getAllFromStore('sales'),
  ])

  // Idempotencia estricta por client_operation_id: evita duplicar ventas y descuentos ante doble clic o reintento
  const clientOpId = payload.client_operation_id ? String(payload.client_operation_id).trim() : ''
  if (clientOpId) {
    const duplicate = existingSales.find((s) => s.client_operation_id === clientOpId)
    if (duplicate) {
      return duplicate
    }
  }

  // Consolidar líneas repetidas del mismo producto antes de asignar lotes
  const consolidatedMap = new Map()
  for (const line of rawItems) {
    const pid = String(line.product_id || '').trim()
    const qty = Number(line.quantity)
    if (!pid || !Number.isFinite(qty) || qty <= 0) {
      throw new Error('Hay un artículo con cantidad inválida en el ticket.')
    }
    const prev = consolidatedMap.get(pid) || 0
    consolidatedMap.set(pid, Number((prev + qty).toFixed(3)))
  }

  const today = getTodayISO()
  const nowISO = new Date().toISOString()
  const prodMap = new Map(products.map((p) => [p.id, p]))
  // Clonar lotes para no mutar registros originales si ocurre un error de validación a mitad del proceso
  const clonedLots = lots.map((l) => ({ ...l }))

  let total = 0
  const saleItems = []
  const updatedLotsMap = new Map()
  const movementsToCreate = []

  for (const [productId, qtyNeeded] of consolidatedMap.entries()) {
    const p = prodMap.get(productId)
    if (!p || !p.is_active) {
      throw new Error('Uno de los productos seleccionados no está activo.')
    }

    const prodLots = clonedLots.filter((l) => l.product_id === p.id)
    const sellableLots = sortSellableLotsFEFO(prodLots, today)
    const totalAvail = Number(
      sellableLots.reduce((s, l) => s + Number(l.available_quantity || 0), 0).toFixed(3)
    )

    if (qtyNeeded > totalAvail + 1e-6) {
      throw new Error(
        `Stock insuficiente para "${p.name}". Disponible vigente: ${totalAvail} ${p.unit}.`
      )
    }

    let remaining = qtyNeeded
    const allocations = []

    for (const sortedLot of sellableLots) {
      if (remaining <= 0) break
      const lot = clonedLots.find((l) => l.id === sortedLot.id)
      const avail = Number(lot.available_quantity)
      const take = Number(Math.min(avail, remaining).toFixed(3))
      if (take <= 0) continue

      const newAvail = Number((avail - take).toFixed(3))
      remaining = Number((remaining - take).toFixed(3))

      lot.available_quantity = newAvail
      lot.updated_at = nowISO
      updatedLotsMap.set(lot.id, lot)

      allocations.push({
        lot_id: lot.id,
        lot_number: lot.lot_number,
        quantity: take,
        previous_stock: avail,
        new_stock: newAvail,
        expiration_date: lot.expiration_date,
      })

      movementsToCreate.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        product_unit: p.unit,
        lot_id: lot.id,
        lot_number: lot.lot_number,
        movement_type: 'SALIDA_VENTA',
        quantity: -take,
        previous_stock: avail,
        new_stock: newAvail,
        reason: `Venta en POS`,
        user_name: actor.full_name || 'Operador POS',
        created_at: nowISO,
      })
    }

    const lineSubtotal = Math.round(qtyNeeded * Number(p.sale_price))
    total += lineSubtotal

    saleItems.push({
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      unit: p.unit,
      quantity: qtyNeeded,
      unit_price: Number(p.sale_price),
      subtotal: lineSubtotal,
      allocations,
    })
  }

  const paymentMethod = payload.payment_method || 'efectivo'
  const methodLabels = {
    efectivo: 'Efectivo',
    nequi: 'Nequi (Transferencia)',
    bancolombia: 'Bancolombia (Transferencia)',
    daviplata: 'Daviplata',
  }
  if (!methodLabels[paymentMethod]) {
    throw new Error('Método de pago no válido.')
  }

  const hasExplicitCash =
    paymentMethod === 'efectivo' &&
    payload.amount_received !== undefined &&
    payload.amount_received !== null &&
    payload.amount_received !== ''

  const amountReceived = hasExplicitCash ? Number(payload.amount_received) : total

  if (
    paymentMethod === 'efectivo' &&
    (!Number.isFinite(amountReceived) || amountReceived < total)
  ) {
    throw new Error('El efectivo recibido es menor al total a cobrar.')
  }

  // Calcular siguiente folio de manera segura a partir del máximo existente
  let maxFolioNum = 0
  for (const s of existingSales) {
    const match = String(s.folio || '').match(/(\d+)$/)
    if (match) {
      const n = Number(match[1])
      if (n > maxFolioNum) maxFolioNum = n
    }
  }
  const folioNumber = Math.max(existingSales.length, maxFolioNum) + 1
  const folio = `POS-${String(folioNumber).padStart(6, '0')}`
  const storeProfile = getStoredProfileSync()
  const saleNotes = String(payload.notes || '').trim() || null

  const saleRecord = {
    id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    folio,
    client_operation_id: clientOpId || folio,
    created_at: nowISO,
    date_iso: today,
    seller_id: actor.id || 'usr-tendero-1',
    seller_name: actor.full_name || 'Tendero',
    seller_username: actor.username || 'tendero',
    payment_method: paymentMethod,
    payment_method_name: methodLabels[paymentMethod],
    subtotal: total,
    total,
    amount_received: amountReceived,
    change_amount: Math.max(0, amountReceived - total),
    notes: saleNotes,
    items: saleItems,
    store_snapshot: storeProfile || null,
    transfer_verification: payload.transfer_verification || null,
  }

  for (const m of movementsToCreate) {
    m.reason = `Venta ${folio} (${saleRecord.payment_method_name})`
  }

  const lotsToUpdate = Array.from(updatedLotsMap.values())

  const db = await openLocalDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['lots', 'sales', 'movements'], 'readwrite')
    const lotStore = tx.objectStore('lots')
    const saleStore = tx.objectStore('sales')
    const movStore = tx.objectStore('movements')

    for (const l of lotsToUpdate) lotStore.put(l)
    for (const m of movementsToCreate) movStore.put(m)
    saleStore.put(saleRecord)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transacción abortada al guardar la venta.'))
  })

  // Actualizar progreso del tutorial (Paso 2 -> Paso 3 al registrar primera venta)
  syncTourProgress(products.length, existingSales.length + 1)

  return saleRecord
}

export function computeOwnerQuickMetrics(products = [], sales = []) {
  const today = getTodayISO()

  const todaySales = sales.filter((s) => {
    const sDate = s.date_iso || String(s.created_at || '').slice(0, 10)
    return sDate === today
  })

  const todayTotalCOP = todaySales.reduce((acc, s) => acc + Number(s.total || 0), 0)
  const verifiedTransfersCount = todaySales.filter((s) =>
    Boolean(s.transfer_verification?.photo_data_url)
  ).length

  const tally = new Map()
  for (const s of sales) {
    for (const item of s.items || []) {
      const prev = tally.get(item.product_id) || {
        product_id: item.product_id,
        name: item.product_name,
        sku: item.product_sku,
        quantity: 0,
        revenue: 0,
      }
      prev.quantity = Number((prev.quantity + Number(item.quantity || 0)).toFixed(3))
      prev.revenue += Number(item.subtotal || 0)
      tally.set(item.product_id, prev)
    }
  }

  let topProduct = null
  for (const entry of tally.values()) {
    if (!topProduct || entry.quantity > topProduct.quantity) {
      topProduct = entry
    }
  }

  const activeProducts = products.filter((p) => p.is_active)
  const lowStockProducts = activeProducts.filter(
    (p) => Number(p.available_stock || 0) <= Number(p.min_stock ?? 5)
  )
  const outOfStockProducts = activeProducts.filter((p) => Number(p.available_stock || 0) <= 0)

  return {
    today_date: today,
    today_sales_total: todayTotalCOP,
    today_sales_count: todaySales.length,
    verified_transfers_count: verifiedTransfersCount,
    top_product: topProduct || {
      name: 'Sin ventas registradas hoy',
      sku: '—',
      quantity: 0,
      revenue: 0,
    },
    low_stock_count: lowStockProducts.length,
    out_of_stock_count: outOfStockProducts.length,
    low_stock_items: lowStockProducts.slice(0, 8),
  }
}

export async function createOrUpdateCategoryLocal(payload, currentUser) {
  assertOwnerAccess(currentUser, 'gestionar categorías')
  const name = String(payload?.name || '').trim()
  if (name.length < 2) {
    throw new Error('El nombre de la categoría debe tener al menos 2 caracteres.')
  }
  const existing = await getAllFromStore('categories')
  const duplicate = existing.find((c) => String(c.name || '').trim().toLowerCase() === name.toLowerCase())
  if (duplicate) {
    throw new Error(`Ya existe una categoría llamada "${duplicate.name}".`)
  }
  const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
  const cat = {
    id,
    name,
    description: String(payload?.description || '').trim(),
    created_at: new Date().toISOString(),
  }
  await putInStore('categories', cat)
  return cat
}

export async function createProductLocal(payload, currentUser) {
  const actor = assertOwnerAccess(currentUser, 'crear productos')

  const [existingProducts, existingCategories] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('categories'),
  ])

  const name = String(payload?.name || '').trim()
  if (name.length < 2) {
    throw new Error('El nombre del producto es obligatorio (mínimo 2 caracteres).')
  }

  const rawSku = String(payload?.sku || '').trim().toUpperCase()
  const sku = rawSku || generateUniqueSKU(name, existingProducts)

  if (existingProducts.some((p) => String(p.sku || '').trim().toUpperCase() === sku)) {
    throw new Error(
      `Ya existe un producto con el SKU "${sku}". Cambia el SKU o déjalo vacío para generar uno automático.`
    )
  }

  const rawBarcode = payload?.barcode != null ? String(payload.barcode).trim() : ''
  const barcode = rawBarcode || null
  if (
    barcode &&
    existingProducts.some(
      (p) => p.barcode && String(p.barcode).trim().toLowerCase() === barcode.toLowerCase()
    )
  ) {
    throw new Error(
      `El código de barras "${barcode}" ya pertenece a otro producto. Verifica el código o déjalo vacío.`
    )
  }

  const unit = String(payload?.unit || 'und').trim().toLowerCase()
  if (!VALID_PRODUCT_UNITS.has(unit)) {
    throw new Error('La unidad de medida seleccionada no es válida.')
  }

  const salePrice = Number(payload?.sale_price)
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('El precio de venta debe ser un número mayor a $0.')
  }

  const minStock =
    payload?.min_stock === '' || payload?.min_stock === undefined || payload?.min_stock === null
      ? 5
      : Number(payload.min_stock)
  if (!Number.isFinite(minStock) || minStock < 0) {
    throw new Error('La alerta de stock mínimo debe ser 0 o mayor.')
  }

  const rawCost =
    payload?.unit_cost !== undefined && payload?.unit_cost !== '' && payload?.unit_cost !== null
      ? Number(payload.unit_cost)
      : payload?.initial_lot?.unit_cost !== undefined &&
          payload?.initial_lot?.unit_cost !== '' &&
          payload?.initial_lot?.unit_cost !== null
        ? Number(payload.initial_lot.unit_cost)
        : 0
  if (!Number.isFinite(rawCost) || rawCost < 0) {
    throw new Error('El costo unitario no puede ser negativo.')
  }

  const categoryId =
    payload?.category_id !== undefined && payload?.category_id !== null && String(payload.category_id).trim() !== ''
      ? String(payload.category_id).trim()
      : null
  const matchedCategory = categoryId
    ? existingCategories.find((c) => String(c.id) === categoryId)
    : null

  const colorTag = PRODUCT_COLOR_PALETTE.some((c) => c.id === payload?.color_tag)
    ? payload.color_tag
    : 'slate'
  const description = String(payload?.description || '').trim()
  const imageUrl = payload?.image_url ? String(payload.image_url).trim() : null

  // Validar lote inicial opcional ANTES de escribir nada en IndexedDB
  let initialLotRecord = null
  let initialMovementRecord = null
  const nowISO = new Date().toISOString()
  const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`

  const rawInitLot = payload?.initial_lot
  if (rawInitLot && rawInitLot.quantity !== undefined && rawInitLot.quantity !== '' && rawInitLot.quantity !== null) {
    const initQty = Number(rawInitLot.quantity)
    if (!Number.isFinite(initQty) || initQty < 0) {
      throw new Error('La cantidad inicial del lote debe ser 0 o mayor.')
    }
    if (initQty > 0) {
      const lotNumber = String(rawInitLot.lot_number || `L-${sku}-01`).trim().toUpperCase()
      const lotCost =
        rawInitLot.unit_cost !== undefined && rawInitLot.unit_cost !== '' && rawInitLot.unit_cost !== null
          ? Number(rawInitLot.unit_cost)
          : rawCost
      if (!Number.isFinite(lotCost) || lotCost < 0) {
        throw new Error('El costo unitario del lote inicial no puede ser negativo.')
      }
      const entryDate = String(rawInitLot.entry_date || getTodayISO()).trim().slice(0, 10)
      if (!isValidISODate(entryDate)) {
        throw new Error('La fecha de ingreso del lote inicial no es válida.')
      }
      const expirationDate = rawInitLot.expiration_date
        ? String(rawInitLot.expiration_date).trim().slice(0, 10)
        : null
      if (expirationDate && !isValidISODate(expirationDate)) {
        throw new Error('La fecha de vencimiento del lote inicial no es válida.')
      }

      const lotId = `lot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      initialLotRecord = {
        id: lotId,
        product_id: id,
        lot_number: lotNumber,
        initial_quantity: Number(initQty.toFixed(3)),
        available_quantity: Number(initQty.toFixed(3)),
        unit_cost: Number(lotCost.toFixed(2)),
        entry_date: entryDate,
        expiration_date: expirationDate,
        notes: String(rawInitLot.notes || 'Lote inicial de apertura').trim(),
        created_at: nowISO,
      }
      initialMovementRecord = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product_id: id,
        product_name: name,
        product_sku: sku,
        product_unit: unit,
        lot_id: lotId,
        lot_number: lotNumber,
        movement_type: 'ENTRADA',
        quantity: Number(initQty.toFixed(3)),
        previous_stock: 0,
        new_stock: Number(initQty.toFixed(3)),
        reason: initialLotRecord.notes || 'Lote inicial de apertura',
        user_name: actor.full_name || 'Dueño',
        created_at: nowISO,
      }
    }
  }

  const newProd = {
    id,
    sku,
    barcode,
    name,
    description,
    category_id: categoryId,
    category_name: matchedCategory ? matchedCategory.name : 'Sin categoría',
    unit,
    sale_price: Number(salePrice.toFixed(2)),
    unit_cost: Number(rawCost.toFixed(2)),
    min_stock: Number(minStock.toFixed(3)),
    color_tag: colorTag,
    is_active: true,
    image_url: imageUrl,
    created_at: nowISO,
    updated_at: nowISO,
  }

  // Persistencia atómica: producto + lote inicial + movimiento en una sola transacción
  const db = await openLocalDB()
  await new Promise((resolve, reject) => {
    const stores = initialLotRecord ? ['products', 'lots', 'movements'] : ['products']
    const tx = db.transaction(stores, 'readwrite')
    tx.objectStore('products').put(newProd)
    if (initialLotRecord) {
      tx.objectStore('lots').put(initialLotRecord)
      tx.objectStore('movements').put(initialMovementRecord)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el producto.'))
  })

  const [allProds, allSales] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('sales'),
  ])
  syncTourProgress(allProds.length, allSales.length)

  return newProd
}

export async function updateProductLocal(productId, payload, currentUser) {
  assertOwnerAccess(currentUser, 'editar productos')

  const [products, categories] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('categories'),
  ])
  const target = products.find((p) => p.id === productId)
  if (!target) throw new Error('Producto no encontrado.')

  const name =
    payload?.name !== undefined ? String(payload.name).trim() : String(target.name || '').trim()
  if (name.length < 2) {
    throw new Error('El nombre del producto es obligatorio (mínimo 2 caracteres).')
  }

  const sku =
    payload?.sku !== undefined
      ? String(payload.sku).trim().toUpperCase()
      : String(target.sku || '').trim().toUpperCase()
  if (!sku) {
    throw new Error('El código SKU no puede quedar vacío.')
  }
  if (
    products.some(
      (p) => p.id !== productId && String(p.sku || '').trim().toUpperCase() === sku
    )
  ) {
    throw new Error(`El SKU "${sku}" ya está asignado a otro producto.`)
  }

  let barcode = target.barcode ?? null
  if (payload?.barcode !== undefined) {
    const cleanBar = payload.barcode != null ? String(payload.barcode).trim() : ''
    barcode = cleanBar || null
  }
  if (
    barcode &&
    products.some(
      (p) =>
        p.id !== productId &&
        p.barcode &&
        String(p.barcode).trim().toLowerCase() === barcode.toLowerCase()
    )
  ) {
    throw new Error(`El código de barras "${barcode}" ya pertenece a otro producto.`)
  }

  const unit =
    payload?.unit !== undefined
      ? String(payload.unit).trim().toLowerCase()
      : String(target.unit || 'und').trim().toLowerCase()
  if (!VALID_PRODUCT_UNITS.has(unit)) {
    throw new Error('La unidad de medida seleccionada no es válida.')
  }

  const salePrice =
    payload?.sale_price !== undefined ? Number(payload.sale_price) : Number(target.sale_price)
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('El precio de venta debe ser mayor a $0.')
  }

  const unitCost =
    payload?.unit_cost !== undefined && payload?.unit_cost !== '' && payload?.unit_cost !== null
      ? Number(payload.unit_cost)
      : Number(target.unit_cost ?? 0)
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error('El costo unitario no puede ser negativo.')
  }

  const minStock =
    payload?.min_stock !== undefined && payload?.min_stock !== '' && payload?.min_stock !== null
      ? Number(payload.min_stock)
      : Number(target.min_stock ?? 5)
  if (!Number.isFinite(minStock) || minStock < 0) {
    throw new Error('La alerta de stock mínimo no puede ser negativa.')
  }

  let categoryId = target.category_id ?? null
  if (payload?.category_id !== undefined) {
    categoryId =
      payload.category_id !== null && String(payload.category_id).trim() !== ''
        ? String(payload.category_id).trim()
        : null
  }
  const matchedCategory = categoryId
    ? categories.find((c) => String(c.id) === categoryId)
    : null

  const colorTag =
    payload?.color_tag !== undefined && PRODUCT_COLOR_PALETTE.some((c) => c.id === payload.color_tag)
      ? payload.color_tag
      : target.color_tag || 'slate'

  const description =
    payload?.description !== undefined
      ? String(payload.description || '').trim()
      : target.description || ''

  const imageUrl =
    payload?.image_url !== undefined
      ? payload.image_url
        ? String(payload.image_url).trim()
        : null
      : target.image_url ?? null

  const isActive =
    payload?.is_active !== undefined ? Boolean(payload.is_active) : Boolean(target.is_active)

  // Preserva id y created_at sin alterar ventas históricas (snapshot inmutable) ni lotes asociados (FK product_id)
  const updated = {
    ...target,
    id: target.id,
    created_at: target.created_at,
    name,
    sku,
    barcode,
    description,
    category_id: categoryId,
    category_name: matchedCategory ? matchedCategory.name : 'Sin categoría',
    unit,
    sale_price: Number(salePrice.toFixed(2)),
    unit_cost: Number(unitCost.toFixed(2)),
    min_stock: Number(minStock.toFixed(3)),
    color_tag: colorTag,
    image_url: imageUrl,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }

  await putInStore('products', updated)
  return updated
}

export async function createLotLocal(payload, currentUser) {
  const actor = assertOwnerAccess(currentUser, 'registrar lotes de inventario')

  const [products, existingLots] = await Promise.all([
    getAllFromStore('products'),
    getAllFromStore('lots'),
  ])
  const prod = products.find((p) => p.id === payload?.product_id)
  if (!prod) throw new Error('Producto no encontrado para asignar lote.')

  const nowISO = new Date().toISOString()
  const qty = Number(payload?.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('La cantidad del lote debe ser mayor a cero.')
  }

  const lotNumber = String(payload?.lot_number || `L-${Date.now()}`)
    .trim()
    .toUpperCase()
  if (!lotNumber) {
    throw new Error('El código de lote es obligatorio.')
  }
  if (
    existingLots.some(
      (l) =>
        l.product_id === prod.id &&
        String(l.lot_number || '').trim().toUpperCase() === lotNumber
    )
  ) {
    throw new Error(`El lote "${lotNumber}" ya existe para "${prod.name}". Usa otro código de lote.`)
  }

  const unitCost =
    payload?.unit_cost !== undefined && payload?.unit_cost !== '' && payload?.unit_cost !== null
      ? Number(payload.unit_cost)
      : Number(prod.unit_cost || 0)
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error('El costo unitario del lote no puede ser negativo.')
  }

  const entryDate = String(payload?.entry_date || getTodayISO()).trim().slice(0, 10)
  if (!isValidISODate(entryDate)) {
    throw new Error('La fecha de ingreso del lote no es válida.')
  }
  const expirationDate = payload?.expiration_date
    ? String(payload.expiration_date).trim().slice(0, 10)
    : null
  if (expirationDate && !isValidISODate(expirationDate)) {
    throw new Error('La fecha de vencimiento del lote no es válida.')
  }

  const cleanQty = Number(qty.toFixed(3))
  const lot = {
    id: `lot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: prod.id,
    lot_number: lotNumber,
    initial_quantity: cleanQty,
    available_quantity: cleanQty,
    unit_cost: Number(unitCost.toFixed(2)),
    entry_date: entryDate,
    expiration_date: expirationDate,
    notes: String(payload?.notes || '').trim(),
    created_at: nowISO,
  }

  const movement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: prod.id,
    product_name: prod.name,
    product_sku: prod.sku,
    product_unit: prod.unit,
    lot_id: lot.id,
    lot_number: lot.lot_number,
    movement_type: 'ENTRADA',
    quantity: cleanQty,
    previous_stock: 0,
    new_stock: cleanQty,
    reason: lot.notes || 'Ingreso de nuevo lote de inventario',
    user_name: actor.full_name || 'Dueño',
    created_at: nowISO,
  }

  const db = await openLocalDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['lots', 'movements'], 'readwrite')
    tx.objectStore('lots').put(lot)
    tx.objectStore('movements').put(movement)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('No se pudo guardar el lote.'))
  })

  return lot
}

export async function adjustLotLocal(lotId, payload, currentUser) {
  const actor = assertOwnerAccess(currentUser, 'ajustar lotes de inventario')

  const [lots, products] = await Promise.all([
    getAllFromStore('lots'),
    getAllFromStore('products'),
  ])
  const existingLot = lots.find((l) => l.id === lotId)
  if (!existingLot) throw new Error('Lote no encontrado.')
  const prod = products.find((p) => p.id === existingLot.product_id) || {}

  const operation = String(payload?.operation || 'AJUSTE_DIRECTO').trim().toUpperCase()
  const reason = String(payload?.reason || '').trim()
  if (reason.length < 3) {
    throw new Error('Debes indicar un motivo claro (mínimo 3 caracteres) para el movimiento.')
  }

  const prev = Number(existingLot.available_quantity || 0)
  const q = Number(payload?.quantity)
  if (!Number.isFinite(q)) {
    throw new Error('La cantidad ingresada no es válida.')
  }

  let next = prev
  if (operation === 'ENTRADA_AJUSTE') {
    if (q <= 0) throw new Error('La cantidad de entrada debe ser mayor a cero.')
    next = Number((prev + q).toFixed(3))
  } else if (operation === 'SALIDA_MERMA') {
    if (q <= 0) throw new Error('La cantidad de salida debe ser mayor a cero.')
    if (q > prev + 1e-6) {
      throw new Error(`La salida (${q}) supera el saldo disponible del lote (${prev}).`)
    }
    next = Number(Math.max(0, prev - q).toFixed(3))
  } else if (operation === 'AJUSTE_DIRECTO') {
    if (q < 0) throw new Error('El saldo físico del lote no puede ser negativo.')
    next = Number(q.toFixed(3))
  } else {
    throw new Error('Tipo de operación de inventario no válido.')
  }

  const unitCost =
    payload?.unit_cost !== undefined && payload?.unit_cost !== '' && payload?.unit_cost !== null
      ? Number(payload.unit_cost)
      : Number(existingLot.unit_cost || 0)
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new Error('El costo unitario no puede ser negativo.')
  }

  let expirationDate = existingLot.expiration_date ?? null
  if (payload?.expiration_date !== undefined) {
    expirationDate = payload.expiration_date
      ? String(payload.expiration_date).trim().slice(0, 10)
      : null
    if (expirationDate && !isValidISODate(expirationDate)) {
      throw new Error('La fecha de vencimiento del lote no es válida.')
    }
  }

  const nowISO = new Date().toISOString()
  const updatedLot = {
    ...existingLot,
    available_quantity: next,
    unit_cost: Number(unitCost.toFixed(2)),
    expiration_date: expirationDate,
    updated_at: nowISO,
  }

  const delta = Number((next - prev).toFixed(3))
  const movement = {
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    product_id: updatedLot.product_id,
    product_name: prod.name || 'Producto',
    product_sku: prod.sku || '—',
    product_unit: prod.unit || 'und',
    lot_id: updatedLot.id,
    lot_number: updatedLot.lot_number,
    movement_type: operation,
    quantity: delta,
    previous_stock: prev,
    new_stock: next,
    reason,
    user_name: actor.full_name || 'Dueño',
    created_at: nowISO,
  }

  const db = await openLocalDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['lots', 'movements'], 'readwrite')
    tx.objectStore('lots').put(updatedLot)
    tx.objectStore('movements').put(movement)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('No se pudo registrar el movimiento del lote.'))
  })

  return updatedLot
}

export async function getFilteredSalesLocal(filters = {}, currentUser = null) {
  const actor = currentUser || getActiveSessionSync()
  if (!actor) {
    throw new Error('Debes iniciar sesión para consultar ventas.')
  }

  const sales = await getAllFromStore('sales')
  const sorted = sales.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  // Un Tendero únicamente puede consultar sus propias ventas operativas
  const effectiveUserId = actor.role === 'dueno' ? filters.user_id || '' : actor.id

  const filtered = sorted.filter((s) => {
    const sDate = s.date_iso || String(s.created_at).slice(0, 10)
    if (filters.date_from && sDate < filters.date_from) return false
    if (filters.date_to && sDate > filters.date_to) return false
    if (effectiveUserId && s.seller_id !== effectiveUserId) return false
    if (filters.payment_method && s.payment_method !== filters.payment_method) return false
    if (filters.product_id) {
      const hasProd = (s.items || []).some((i) => i.product_id === filters.product_id)
      if (!hasProd) return false
    }
    return true
  })

  const byMethod = { efectivo: 0, nequi: 0, bancolombia: 0, daviplata: 0 }
  let grandTotal = 0
  for (const s of filtered) {
    grandTotal += Number(s.total || 0)
    byMethod[s.payment_method] = (byMethod[s.payment_method] || 0) + Number(s.total || 0)
  }

  return {
    sales: filtered,
    summary: {
      count: filtered.length,
      grand_total: grandTotal,
      by_payment_method: byMethod,
    },
  }
}

export async function findQuickLoginOwnerLocal() {
  const users = await getAllFromStore('users')
  return users.find((u) => u.role === 'dueno' && u.is_active) || null
}

export async function getUsersLocal(currentUser) {
  assertOwnerAccess(currentUser, 'consultar los usuarios del sistema')
  const [users, sales] = await Promise.all([
    getAllFromStore('users'),
    getAllFromStore('sales'),
  ])
  return users.map((u) => ({
    ...u,
    total_sales_count: sales.filter((s) => s.seller_id === u.id).length,
  }))
}

export async function createUserLocal(payload, currentUser) {
  assertOwnerAccess(currentUser, 'crear usuarios')
  const users = await getAllFromStore('users')
  const username = String(payload?.username || '').trim().toLowerCase()
  const fullName = String(payload?.full_name || '').trim()
  const password = String(payload?.password || '')
  if (username.length < 3 || /\s/.test(username)) {
    throw new Error('El nombre de usuario debe tener al menos 3 caracteres sin espacios.')
  }
  if (fullName.length < 2) {
    throw new Error('El nombre completo es obligatorio.')
  }
  if (password.length < 8) {
    throw new Error('La contraseña debe tener mínimo 8 caracteres.')
  }
  if (users.some((u) => String(u.username || '').toLowerCase() === username)) {
    throw new Error(`El usuario @${username} ya existe.`)
  }
  const role = payload?.role === 'dueno' ? 'dueno' : 'tendero'
  const newUser = {
    id: `usr-${Date.now()}`,
    username,
    full_name: fullName,
    document_id: String(payload?.document_id || '').trim(),
    role,
    role_name: role === 'dueno' ? 'Dueño' : 'Tendero',
    password,
    is_active: true,
    created_at: new Date().toISOString(),
  }
  await putInStore('users', newUser)
  return newUser
}

export async function updateUserLocal(userId, payload, currentUser) {
  assertOwnerAccess(currentUser, 'editar usuarios')
  const users = await getAllFromStore('users')
  const target = users.find((u) => u.id === userId)
  if (!target) throw new Error('Usuario no encontrado.')

  const nextRole = payload?.role ? (payload.role === 'dueno' ? 'dueno' : 'tendero') : target.role
  const nextActive = payload?.is_active !== undefined ? Boolean(payload.is_active) : Boolean(target.is_active)

  if (target.role === 'dueno' && (!nextActive || nextRole !== 'dueno')) {
    const otherActiveOwners = users.filter(
      (u) => u.id !== userId && u.role === 'dueno' && u.is_active
    )
    if (otherActiveOwners.length === 0) {
      throw new Error('No puedes desactivar ni degradar al único Dueño activo del sistema.')
    }
  }

  if (payload?.full_name !== undefined) {
    const cleanName = String(payload.full_name).trim()
    if (cleanName.length < 2) throw new Error('El nombre completo es obligatorio.')
    target.full_name = cleanName
  }
  target.role = nextRole
  target.role_name = nextRole === 'dueno' ? 'Dueño' : 'Tendero'
  target.is_active = nextActive
  if (payload?.password) {
    if (String(payload.password).length < 8) {
      throw new Error('La nueva contraseña debe tener mínimo 8 caracteres.')
    }
    target.password = String(payload.password)
  }

  await putInStore('users', target)
  return target
}

export async function authenticateLocalUser(username, password) {
  const users = await getAllFromStore('users')
  const cleanUser = String(username || '').trim().toLowerCase()
  const found = users.find((u) => u.username.toLowerCase() === cleanUser)

  if (!found) {
    throw new Error('Usuario o contraseña incorrectos.')
  }
  if (!found.is_active) {
    throw new Error('Esta cuenta de usuario se encuentra desactivada.')
  }
  if (found.password !== String(password)) {
    throw new Error('Usuario o contraseña incorrectos.')
  }

  const profile = getStoredProfileSync()
  const sessionUser = {
    id: found.id,
    username: found.username,
    full_name: found.full_name,
    document_id: found.document_id || '',
    role: found.role,
    role_name: found.role_name,
    store: profile,
  }
  setActiveSessionSync(sessionUser)
  return sessionUser
}

/**
 * Sistema de Reseñas Privado ("Muro de Reseñas" exclusivo para usuarios logueados en /app)
 */
export async function getPrivateReviewsLocal() {
  const reviews = await getAllFromStore('reviews')
  return reviews.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
}

export async function createPrivateReviewLocal(payload, currentUser) {
  const comment = String(payload.comment || '').trim()
  const rating = Math.min(5, Math.max(1, Number(payload.rating || 5)))
  const category = String(payload.category || 'General').trim()

  if (comment.length < 4) {
    throw new Error('Escribe una reseña de al menos 4 caracteres.')
  }

  const storeProfile = getStoredProfileSync()
  const review = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author_name: currentUser?.full_name || 'Usuario Autenticado',
    author_role: currentUser?.role_name || 'Dueño',
    store_name: storeProfile?.store_name || 'Mi Tienda',
    rating,
    category,
    comment,
    created_at: new Date().toISOString(),
  }

  await putInStore('reviews', review)
  return review
}
