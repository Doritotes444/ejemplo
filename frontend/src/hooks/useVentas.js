import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import {
  encolarOperacionOffline,
  descontarStockCacheLocal,
  generarClientOperationId,
} from '../services/offlineDB'

const BASE = import.meta.env.VITE_API_URL || '/api'

export function useVentas() {
  const { usuario } = useAuth()
  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!usuario?.empresa_id) return
    setCargando(true)
    setError(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/ventas/${usuario.empresa_id}`)
      if (!res.ok) throw new Error('Error cargando ventas')
      setVentas(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [usuario])

  useEffect(() => {
    cargar()
  }, [cargar])

  const registrar = async (detalles, opciones = {}) => {
    const clientOpId = opciones.client_operation_id || generarClientOperationId('vta')
    const payload = {
      detalles,
      metodo_pago: opciones.metodo_pago || 'Efectivo',
      monto_recibido: opciones.monto_recibido ?? null,
      cliente_nombre: opciones.cliente_nombre || null,
      notas: opciones.notas || null,
      client_operation_id: clientOpId,
    }

    const totalCalculado = opciones.total_estimado || 0

    // Si estamos sin conexión, encolar inmediatamente en IndexedDB
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await encolarOperacionOffline('venta', payload, usuario?.empresa_id)
      await descontarStockCacheLocal(usuario?.empresa_id, detalles)
      return {
        id: clientOpId,
        offline: true,
        total: totalCalculado,
        metodo_pago: payload.metodo_pago,
        cambio_entregado:
          payload.monto_recibido != null
            ? Math.max(0, Number(payload.monto_recibido) - totalCalculado)
            : 0,
      }
    }

    try {
      const res = await authService.fetchAuth(`${BASE}/ventas/${usuario.empresa_id}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error registrando venta')
      }
      const resultado = await res.json()
      await descontarStockCacheLocal(usuario?.empresa_id, detalles)
      cargar().catch(() => {})
      return resultado
    } catch (e) {
      // Si es un fallo de red puro (offline repentino), encolar localmente
      if (e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
        await encolarOperacionOffline('venta', payload, usuario?.empresa_id)
        await descontarStockCacheLocal(usuario?.empresa_id, detalles)
        return {
          id: clientOpId,
          offline: true,
          total: totalCalculado,
          metodo_pago: payload.metodo_pago,
          cambio_entregado:
            payload.monto_recibido != null
              ? Math.max(0, Number(payload.monto_recibido) - totalCalculado)
              : 0,
        }
      }
      throw e
    }
  }

  const anular = async (ventaId, motivo) => {
    const res = await authService.fetchAuth(
      `${BASE}/ventas/${usuario.empresa_id}/${ventaId}/anular`,
      {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'No se pudo anular la venta')
    }
    const data = await res.json()
    await cargar()
    return data
  }

  return { ventas, cargando, error, cargar, registrar, anular }
}
