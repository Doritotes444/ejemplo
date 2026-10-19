import authService from './authService'

const BASE = import.meta.env.VITE_API_URL || '/api'
const DB_NAME = 'tiendapp_offline_db'
const DB_VERSION = 2
const FALLBACK_CATALOG_KEY = 'tiendapp_catalogo_cache'
const FALLBACK_QUEUE_KEY = 'tiendapp_sync_queue'
const FALLBACK_RECEIPTS_KEY = 'tiendapp_qr_receipts_local'

function generarOperationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function emitirEventoSync(detalle = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tiendapp:sync-update', { detail: detalle }))
  }
}

function abrirDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('catalogo')) {
        db.createObjectStore('catalogo', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('cola_sync')) {
        db.createObjectStore('cola_sync', { keyPath: 'client_operation_id' })
      }
      if (!db.objectStoreNames.contains('comprobantes_locales')) {
        db.createObjectStore('comprobantes_locales', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

export async function guardarCatalogoLocal(productos = []) {
  try {
    localStorage.setItem(FALLBACK_CATALOG_KEY, JSON.stringify(productos))
  } catch {
    // Si localStorage se llena por fotos, IndexedDB actúa como respaldo principal
  }
  const db = await abrirDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('catalogo', 'readwrite')
      const store = tx.objectStore('catalogo')
      store.clear()
      productos.forEach((p) => store.put(p))
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function obtenerCatalogoLocal() {
  const db = await abrirDB()
  if (db) {
    const items = await new Promise((resolve) => {
      try {
        const tx = db.transaction('catalogo', 'readonly')
        const req = tx.objectStore('catalogo').getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
    if (items.length > 0) return items
  }
  try {
    const raw = localStorage.getItem(FALLBACK_CATALOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function actualizarStockProductoLocal(productoId, delta) {
  const catalogo = await obtenerCatalogoLocal()
  const actualizado = catalogo.map((p) => {
    if (String(p.id) === String(productoId)) {
      const nuevo = Math.max(0, Number(p.cantidad_actual || 0) + Number(delta))
      return { ...p, cantidad_actual: nuevo }
    }
    return p
  })
  await guardarCatalogoLocal(actualizado)
  return actualizado
}

export async function obtenerColaOffline() {
  const db = await abrirDB()
  if (db) {
    const items = await new Promise((resolve) => {
      try {
        const tx = db.transaction('cola_sync', 'readonly')
        const req = tx.objectStore('cola_sync').getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
    if (items.length > 0) {
      return items.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    }
  }
  try {
    const raw = localStorage.getItem(FALLBACK_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function persistirColaCompleta(items) {
  try {
    localStorage.setItem(FALLBACK_QUEUE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota error
  }
  const db = await abrirDB()
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction('cola_sync', 'readwrite')
        const store = tx.objectStore('cola_sync')
        store.clear()
        items.forEach((i) => store.put(i))
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  }
}

export async function encolarOperacionOffline(tipo, payload, resumenHumano = '') {
  const client_operation_id = payload?.client_operation_id || generarOperationId()
  const entrada = {
    client_operation_id,
    tipo,
    payload: { ...payload, client_operation_id },
    resumen: resumenHumano || `${tipo} (${client_operation_id.slice(0, 8)})`,
    estado: 'PENDIENTE',
    detalle_error: null,
    created_at: new Date().toISOString(),
  }

  const cola = await obtenerColaOffline()
  const filtrada = cola.filter((x) => x.client_operation_id !== client_operation_id)
  filtrada.push(entrada)
  await persistirColaCompleta(filtrada)

  emitirEventoSync({ estado: 'GUARDADO_LOCAL', operacion: entrada })
  return entrada
}

export async function eliminarOperacionCola(clientOperationId) {
  const cola = await obtenerColaOffline()
  const nueva = cola.filter((x) => x.client_operation_id !== clientOperationId)
  await persistirColaCompleta(nueva)
  emitirEventoSync({ estado: 'COLA_ACTUALIZADA' })
}

let sincronizandoEnCurso = false

export async function sincronizarColaPendiente() {
  if (sincronizandoEnCurso) return { sincronizadas: 0, pendientes: 0 }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { sincronizadas: 0, pendientes: (await obtenerColaOffline()).length, offline: true }
  }

  const cola = await obtenerColaOffline()
  const pendientes = cola.filter((i) => i.estado === 'PENDIENTE' || i.estado === 'ERROR')
  if (pendientes.length === 0) {
    return { sincronizadas: 0, pendientes: 0 }
  }

  sincronizandoEnCurso = true
  emitirEventoSync({ estado: 'SINCRONIZANDO', total: pendientes.length })

  try {
    const res = await authService.fetchAuth(`${BASE}/sync/lote`, {
      method: 'POST',
      body: JSON.stringify({
        operaciones: pendientes.map((p) => ({
          client_operation_id: p.client_operation_id,
          tipo: p.tipo,
          payload: p.payload,
        })),
      }),
    })

    if (!res.ok) {
      throw new Error('No se pudo completar la sincronización con el servidor')
    }

    const data = await res.json()
    const mapaResultados = {}
    ;(data.resultados || []).forEach((r) => {
      mapaResultados[r.client_operation_id] = r
    })

    const colaActualizada = []
    for (const item of cola) {
      const r = mapaResultados[item.client_operation_id]
      if (!r) {
        colaActualizada.push(item)
        continue
      }
      if (r.estado === 'SINCRONIZADO' || r.estado === 'IDEMPOTENTE') {
        // Ya quedó sincronizado en el servidor, se retira de la cola pendiente
        continue
      } else {
        colaActualizada.push({
          ...item,
          estado: r.estado, // CONFLICTO o ERROR
          detalle_error: r.mensaje || 'Conflicto al sincronizar',
        })
      }
    }

    await persistirColaCompleta(colaActualizada)
    emitirEventoSync({
      estado: colaActualizada.some((i) => i.estado === 'CONFLICTO') ? 'CONFLICTO' : 'SINCRONIZADO',
      resultado: data,
    })
    return data
  } catch (err) {
    emitirEventoSync({ estado: 'ERROR_SYNC', mensaje: err.message })
    return { error: err.message }
  } finally {
    sincronizandoEnCurso = false
  }
}

export async function guardarComprobanteLocal(comprobante) {
  const id = comprobante.id || comprobante.client_operation_id || generarOperationId()
  const item = { ...comprobante, id, guardado_local_en: new Date().toISOString() }
  const db = await abrirDB()
  if (db) {
    await new Promise((resolve) => {
      try {
        const tx = db.transaction('comprobantes_locales', 'readwrite')
        tx.objectStore('comprobantes_locales').put(item)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      } catch {
        resolve(false)
      }
    })
  }
  try {
    const raw = localStorage.getItem(FALLBACK_RECEIPTS_KEY)
    const lista = raw ? JSON.parse(raw) : []
    const sinDuplicado = lista.filter((x) => x.id !== id).slice(0, 25)
    localStorage.setItem(FALLBACK_RECEIPTS_KEY, JSON.stringify([item, ...sinDuplicado]))
  } catch {
    // ignore storage quota
  }
  return item
}

export async function obtenerComprobantesLocales() {
  const db = await abrirDB()
  if (db) {
    const items = await new Promise((resolve) => {
      try {
        const tx = db.transaction('comprobantes_locales', 'readonly')
        const req = tx.objectStore('comprobantes_locales').getAll()
        req.onsuccess = () => resolve(req.result || [])
        req.onerror = () => resolve([])
      } catch {
        resolve([])
      }
    })
    if (items.length > 0) return items
  }
  try {
    const raw = localStorage.getItem(FALLBACK_RECEIPTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Optimiza y redimensiona una imagen en el navegador para reducir consumo de datos y memoria
 * en celulares Android económicos, retornando un Data URI JPEG compacto.
 */
export function comprimirImagenArchivo(file, maxWidth = 640, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height, 1))
        const w = Math.max(1, Math.round(img.width * ratio))
        const h = Math.max(1, Math.round(img.height * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve(dataUrl)
      }
      img.onerror = () => resolve(e.target.result)
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })
}

export function generarClientOperationId(prefijo = 'op') {
  return `${prefijo}-${generarOperationId()}`
}

export async function descontarStockCacheLocal(_empresaId, detalles = []) {
  for (const d of detalles) {
    if (d?.producto_id && d?.cantidad) {
      await actualizarStockProductoLocal(d.producto_id, -Math.abs(Number(d.cantidad)))
    }
  }
}

export async function listarComprobantesLocales(empresaId = null) {
  const todos = await obtenerComprobantesLocales()
  if (!empresaId) return todos
  return todos.filter((c) => !c.empresa_id || String(c.empresa_id) === String(empresaId))
}

export { generarOperationId }

