import {
  getUsersLocal,
  createUserLocal,
  updateUserLocal,
} from '../core/localStore.js'

export async function fetchUsers() {
  return getUsersLocal()
}

export async function createUserRequest(payload) {
  return createUserLocal(payload)
}

export async function updateUserRequest(userId, payload) {
  return updateUserLocal(userId, payload)
}
