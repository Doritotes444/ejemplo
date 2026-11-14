/**
 * Persistencia de Modo Oscuro / Claro / Sistema.
 * Escucha cambios del sistema operativo (prefers-color-scheme) y sincroniza
 * el atributo data-theme en <html> además de guardar en localStorage.
 */

const THEME_STORAGE_KEY = 'tiendapp_theme'

let currentPreference = 'sistema' // 'sistema' | 'light' | 'dark'
let mediaQuery = null
const listeners = new Set()

function getSystemDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveEffectiveTheme(pref = currentPreference) {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return getSystemDark() ? 'dark' : 'light'
}

function applyThemeToDOM() {
  if (typeof document === 'undefined') return
  const effective = resolveEffectiveTheme(currentPreference)
  const root = document.documentElement
  root.setAttribute('data-theme', effective)
  root.setAttribute('data-theme-pref', currentPreference)
  root.classList.toggle('dark', effective === 'dark')

  for (const fn of listeners) {
    try {
      fn({ preference: currentPreference, effective })
    } catch {
      // ignore listener errors
    }
  }
}

export function initTheme() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null
    if (saved === 'dark' || saved === 'light' || saved === 'sistema') {
      currentPreference = saved
    } else {
      currentPreference = 'sistema'
    }
  } catch {
    currentPreference = 'sistema'
  }

  if (typeof window !== 'undefined' && window.matchMedia && !mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (currentPreference === 'sistema') {
        applyThemeToDOM()
      }
    })
  }

  applyThemeToDOM()
  return { preference: currentPreference, effective: resolveEffectiveTheme() }
}

export function getTheme() {
  return {
    preference: currentPreference,
    effective: resolveEffectiveTheme(currentPreference),
  }
}

export function setTheme(newPref) {
  const valid = newPref === 'dark' || newPref === 'light' ? newPref : 'sistema'
  currentPreference = valid
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, valid)
    }
  } catch {
    // ignore storage errors
  }
  applyThemeToDOM()
  return getTheme()
}

export function cycleTheme() {
  const order = ['sistema', 'light', 'dark']
  const next = order[(order.indexOf(currentPreference) + 1) % order.length]
  return setTheme(next)
}

export function onThemeChange(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
