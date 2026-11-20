import { createLocalSale, getFilteredSalesLocal } from '../core/localStore.js'
import { getState } from '../state.js'

export function generateClientOpId() {
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function registerSaleRequest(payload) {
  const currentUser = getState().user
  return createLocalSale(payload, currentUser)
}

export async function fetchSales(filters = {}) {
  return getFilteredSalesLocal(filters, getState().user)
}
