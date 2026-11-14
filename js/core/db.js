/**
 * Almacenamiento local con IndexedDB nativo (y respaldo en memoria para pruebas aisladas).
 * Esquema rediseñado con soporte explícito para:
 * - productos (definición del artículo, sin stock fijo)
 * - lotes (existencias por entrada, costo unitario y fecha de vencimiento opcional)
 * - ventas (cabecera, detalle y asignaciones por lote para reversión exacta)
 * - movimientos (kardex auditable por lote y usuario)
 */

const DB_NAME = 'tiendapp_vanilla_db'
const DB_VERSION = 1

export const STORES = {
  PRODUCTOS: 'productos',
  LOTES: 'lotes',
  VENTAS: 'ventas',
  MOVIMIENTOS: 'movimientos',
}

let dbPromise = null
const memoryStore = {
  [STORES.PRODUCTOS]: new Map(),
  [STORES.LOTES]: new Map(),
  [STORES.VENTAS]: new Map(),
  [STORES.MOVIMIENTOS]: new Map(),
}
let forceMemory = false

export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function setForceMemoryDB(flag) {
  forceMemory = Boolean(flag)
}

export function openDB() {
  if (forceMemory || typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result

        if (!db.objectStoreNames.contains(STORES.PRODUCTOS)) {
          const prodStore = db.createObjectStore(STORES.PRODUCTOS, { keyPath: 'id' })
          prodStore.createIndex('by_tienda', 'tienda_id', { unique: false })
          prodStore.createIndex('by_codigo', ['tienda_id', 'codigo_barras'], { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.LOTES)) {
          const loteStore = db.createObjectStore(STORES.LOTES, { keyPath: 'id' })
          loteStore.createIndex('by_tienda', 'tienda_id', { unique: false })
          loteStore.createIndex('by_producto', 'producto_id', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.VENTAS)) {
          const ventaStore = db.createObjectStore(STORES.VENTAS, { keyPath: 'id' })
          ventaStore.createIndex('by_tienda', 'tienda_id', { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.MOVIMIENTOS)) {
          const movStore = db.createObjectStore(STORES.MOVIMIENTOS, { keyPath: 'id' })
          movStore.createIndex('by_tienda', 'tienda_id', { unique: false })
          movStore.createIndex('by_producto', 'producto_id', { unique: false })
          movStore.createIndex('by_lote', 'lote_id', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

export async function getAllFromStore(storeName, tiendaId = null) {
  const db = await openDB()
  let items = []

  if (db) {
    items = await new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
  } else {
    items = Array.from(memoryStore[storeName]?.values() || []).map((x) => structuredClone(x))
  }

  if (tiendaId) {
    return items.filter((item) => item.tienda_id === tiendaId)
  }
  return items
}

export async function getById(storeName, id) {
  const db = await openDB()
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).get(id)
        req.onsuccess = () => resolve(req.result || null)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  const found = memoryStore[storeName]?.get(id)
  return found ? structuredClone(found) : null
}

export async function putInStore(storeName, record) {
  const copy = structuredClone(record)
  memoryStore[storeName]?.set(copy.id, copy)

  const db = await openDB()
  if (db) {
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).put(copy)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error || new Error(`Error guardando en ${storeName}`))
      } catch (err) {
        reject(err)
      }
    })
  }
  return copy
}

export async function putManyInStores(operations = []) {
  // operations: Array<{ store: string, record: object }>
  for (const op of operations) {
    const copy = structuredClone(op.record)
    memoryStore[op.store]?.set(copy.id, copy)
  }

  const db = await openDB()
  if (db && operations.length > 0) {
    const storeNames = [...new Set(operations.map((o) => o.store))]
    await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeNames, 'readwrite')
        for (const op of operations) {
          tx.objectStore(op.store).put(structuredClone(op.record))
        }
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => reject(tx.error || new Error('Error en transacción múltiple'))
      } catch (err) {
        reject(err)
      }
    })
  }
  return true
}

export async function deleteFromStore(storeName, id) {
  memoryStore[storeName]?.delete(id)
  const db = await openDB()
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).delete(id)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  }
}

export async function clearAllStores() {
  for (const key of Object.values(STORES)) {
    memoryStore[key]?.clear()
  }
  const db = await openDB()
  if (db) {
    const storeNames = Object.values(STORES)
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(storeNames, 'readwrite')
        for (const name of storeNames) {
          tx.objectStore(name).clear()
        }
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  }
}
