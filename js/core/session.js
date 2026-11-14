import {
  getStoredProfileSync,
  getActiveSessionSync,
  setActiveSessionSync,
  registerStoreOnboarding,
  authenticateLocalUser,
  ensureSeed400Products,
} from './localStore.js'

/**
 * Gestión de Autenticación, Onboarding de Tienda y Sesión en LocalStorage / IndexedDB.
 */

export async function fetchAuthStatus() {
  const profile = getStoredProfileSync()
  const activeUser = getActiveSessionSync()
  if (profile) {
    await ensureSeed400Products()
  }
  return {
    initialized: Boolean(profile),
    needs_setup: !profile,
    store_profile: profile,
    user: activeUser ? { ...activeUser, store: profile } : null,
  }
}

export async function setupOwnerAccount(payload) {
  const { profile, user } = await registerStoreOnboarding(payload)
  return {
    store_profile: profile,
    user,
  }
}

export async function loginWithCredentials(username, password) {
  const user = await authenticateLocalUser(username, password)
  return { user }
}

export async function logoutSession() {
  setActiveSessionSync(null)
}
