import { apiRequest } from '../core/api.js'

/**
 * Servicio de Productos y Categorías (Acceso a API Real).
 */

export async function fetchCategories() {
  const res = await apiRequest('/api/categories')
  return res.categories || []
}

export async function createCategoryRequest(payload) {
  const res = await apiRequest('/api/categories', {
    method: 'POST',
    body: payload,
  })
  return res.category
}

export async function fetchProducts(includeInactive = false) {
  const q = includeInactive ? '?include_inactive=1' : ''
  const res = await apiRequest(`/api/products${q}`)
  return res.products || []
}

export async function createProductRequest(payload) {
  const res = await apiRequest('/api/products', {
    method: 'POST',
    body: payload,
  })
  return res.product
}

export async function updateProductRequest(productId, payload) {
  const res = await apiRequest(`/api/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: payload,
  })
  return res.product
}
