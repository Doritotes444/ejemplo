import { apiRequest } from '../core/api.js'

/**
 * Servicio de Ventas y Comprobantes (Acceso a API Real).
 */

export function generateClientOpId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `vta-${crypto.randomUUID()}`
  }
  return `vta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function registerSaleRequest(payload) {
  const res = await apiRequest('/api/sales', {
    method: 'POST',
    body: payload,
  })
  return res.sale
}

export async function fetchSales(filters = {}) {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.user_id) params.set('user_id', filters.user_id)
  if (filters.product_id) params.set('product_id', filters.product_id)
  if (filters.payment_method) params.set('payment_method', filters.payment_method)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiRequest(`/api/sales${qs}`)
}

export async function fetchSaleDetail(saleId) {
  const res = await apiRequest(`/api/sales/${encodeURIComponent(saleId)}`)
  return res.sale
}
