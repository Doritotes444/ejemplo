import {
  getUsersLocal,
  createUserLocal,
  updateUserLocal,
} from '../core/localStore.js'
import { getState } from '../state.js'

export async function fetchUsers() {
  return getUsersLocal(getState().user)
}

export async function createUserRequest(payload) {
  return createUserLocal(payload, getState().user)
}

export async function updateUserRequest(userId, payload) {
  return updateUserLocal(userId, payload, getState().user)
}
