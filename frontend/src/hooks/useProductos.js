import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import {
  guardarCatalogoLocal,
  obtenerCatalogoLocal,
  actualizarStockProductoLocal,
  encolarOperacionOffline,
} from '../services/offlineDB'

const BASE = import.meta.env.VITE_API_URL || '/api'

export function resolverUrlFotoProducto(fotoUrl, nombre = 'Producto') {
  if (!fotoUrl) {
    const ini = (nombre || 'PR')
      .split(' ')
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || 'PR'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="#F1F5F9"/><text x="100" y="112" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="44" font-weight="600" fill="#64748B">${ini}</text></svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }
  if (fotoUrl.startsWith('data:image/') || fotoUrl.startsWith('blob:')) {
    return fotoUrl
  }
  let finalUrl = fotoUrl
  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
    const hostBase = BASE.endsWith('/api') ? BASE.slice(0, -4) : BASE
    finalUrl = `${hostBase}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`
  }
  const token = authService.getToken()
  if (token && finalUrl.includes('/api/imagenes/') && !finalUrl.includes('token=')) {
    const sep = finalUrl.includes('?') ? '&' : '?'
    finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(token)}`
  }
  return finalUrl
}

export function useProductos() {
  const { usuario } = useAuth()
  const [productos, setProductos] = useState([])
  const [tienda, setTienda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [modoOffline, setModoOffline] = useState(false)

  const cargar = useCallback(async () => {
    if (!usuario) return
    setCargando(true)
    setError(null)
    try {
      // Precarga instantánea desde IndexedDB para velocidad < 50ms
      const cacheLocal = await obtenerCatalogoLocal()
      if (cacheLocal.length > 0 && productos.length === 0) {
        setProductos(cacheLocal)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setProductos(cacheLocal)
        setModoOffline(true)
        return
      }

      const res = await authService.fetchAuth(`${BASE}/productos`)
      if (!res.ok) throw new Error('Error cargando productos')
      const data = await res.json()
      setProductos(data.inventario || [])
      setTienda(data.tienda || 'Mi Tienda')
      setModoOffline(false)
      await guardarCatalogoLocal(data.inventario || [])
    } catch (e) {
      const respaldo = await obtenerCatalogoLocal()
      if (respaldo.length > 0) {
        setProductos(respaldo)
        setModoOffline(true)
      } else {
        setError(e.message)
      }
    } finally {
      setCargando(false)
    }
  }, [usuario])

  useEffect(() => {
    cargar()
  }, [cargar])

  const crear = async (payload) => {
    const res = await authService.fetchAuth(`${BASE}/productos`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        typeof err.detail === 'string'
          ? err.detail
          : Array.isArray(err.detail)
          ? err.detail.map((d) => d.msg).join(', ')
          : 'Error creando producto'
      )
    }
    const creado = await res.json()
    await cargar()
    return creado
  }

  const actualizar = async (id, payload) => {
    const res = await authService.fetchAuth(`${BASE}/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Error actualizando producto')
    }
    const act = await res.json()
    await cargar()
    return act
  }

  const eliminar = async (id) => {
    const res = await authService.fetchAuth(`${BASE}/productos/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Error eliminando producto')
    }
    await cargar()
  }

  const registrarMovimiento = async (productoId, payload) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await encolarOperacionOffline(
        'movimiento_inventario',
        { producto_id: productoId, ...payload },
        `Movimiento ${payload.tipo} (${payload.cantidad}): ${payload.motivo}`
      )
      const factor = payload.tipo === 'salida' ? -1 : 1
      if (payload.tipo !== 'ajuste') {
        const nuevos = await actualizarStockProductoLocal(
          productoId,
          factor * Number(payload.cantidad)
        )
        setProductos(nuevos)
      }
      return { offline: true }
    }

    const res = await authService.fetchAuth(`${BASE}/productos/${productoId}/movimiento`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo registrar el movimiento de stock')
    }
    const data = await res.json()
    await cargar()
    return data
  }

  return {
    productos,
    tienda,
    cargando,
    error,
    modoOffline,
    cargar,
    crear,
    actualizar,
    eliminar,
    registrarMovimiento,
  }
}
