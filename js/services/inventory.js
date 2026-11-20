import { getInventoryMovements } from '../core/localStore.js'
import { getState } from '../state.js'

export async function fetchInventoryMovements() {
  return getInventoryMovements(getState().user)
}
