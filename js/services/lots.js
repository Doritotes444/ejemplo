import {
  getEnrichedLots,
  createLotLocal,
  adjustLotLocal,
} from '../core/localStore.js'
import { getState } from '../state.js'

export async function fetchLots() {
  return getEnrichedLots()
}

export async function createLotRequest(payload) {
  return createLotLocal(payload, getState().user)
}

export async function adjustLotRequest(lotId, payload) {
  return adjustLotLocal(lotId, payload, getState().user)
}
