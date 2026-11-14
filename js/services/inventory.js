import { getInventoryMovements } from '../core/localStore.js'

export async function fetchInventoryMovements() {
  return getInventoryMovements()
}
