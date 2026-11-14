import { apiRequest } from '../core/api.js'

/**
 * Servicio de Movimientos de Inventario / Kardex (Acceso a API Real).
 */

export async function fetchInventoryMovements(filters = {}) {
  const params = new URLSearchParams()
  if (filters.product_id) params.set('product_id', filters.product_id)
  if (filters.movement_type) params.set('movement_type', filters.movement_type)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await apiRequest(`/api/inventory/movements${qs}`)
  return res.movements || []
}
