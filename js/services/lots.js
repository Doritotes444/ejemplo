import { apiRequest } from '../core/api.js'

/**
 * Servicio de Lotes FEFO/FIFO (Acceso a API Real).
 */

export async function fetchLots(productId = null) {
  const q = productId ? `?product_id=${encodeURIComponent(productId)}` : ''
  const res = await apiRequest(`/api/lots${q}`)
  return res.lots || []
}

export async function createLotRequest(payload) {
  const res = await apiRequest('/api/lots', {
    method: 'POST',
    body: payload,
  })
  return res.lot
}

export async function adjustLotRequest(lotId, payload) {
  const res = await apiRequest(`/api/lots/${encodeURIComponent(lotId)}/adjust`, {
    method: 'POST',
    body: payload,
  })
  return res.lot
}
