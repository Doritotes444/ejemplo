/**
 * Sistema de Temas Nativo (Claro / Oscuro).
 * Detecta inicialmente la preferencia del sistema operativo (prefers-color-scheme)
 * y persiste la elección explícita del usuario en localStorage.
 */

const THEME_STORAGE_KEY = 'kairo_theme_preference'

let currentTheme = 'dark'

function detectSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

export function initTheme() {
  let saved = null
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    saved = null
  }

  if (saved === 'dark' || saved === 'light') {
    currentTheme = saved
  } else {
    currentTheme = detectSystemTheme()
  }

  applyTheme(currentTheme)

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', (e) => {
      try {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          currentTheme = e.matches ? 'dark' : 'light'
          applyTheme(currentTheme)
        }
      } catch {
        // ignore
      }
    })
  }

  return currentTheme
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const normalized = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', normalized)
}

export function getTheme() {
  return currentTheme
}

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme)
  } catch {
    // ignore
  }
  applyTheme(currentTheme)
  return currentTheme
}
