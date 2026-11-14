import {
  getCatalogWithStock,
  createOrUpdateCategoryLocal,
  createProductLocal,
  updateProductLocal,
} from '../core/localStore.js'
import { getState } from '../state.js'

export async function fetchCategories() {
  const { categories } = await getCatalogWithStock()
  return categories || []
}

export async function createCategoryRequest(payload) {
  return createOrUpdateCategoryLocal(payload)
}

export async function fetchProducts() {
  const { products } = await getCatalogWithStock()
  return products || []
}

export async function createProductRequest(payload) {
  const currentUser = getState().user
  return createProductLocal(payload, currentUser)
}

export async function updateProductRequest(productId, payload) {
  return updateProductLocal(productId, payload)
}
