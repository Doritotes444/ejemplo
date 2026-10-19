import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({
  tema: 'sistema',
  esOscuro: false,
  setTema: () => {},
})

const THEME_STORAGE_KEY = 'tiendapp_theme'

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    if (typeof window === 'undefined') return 'sistema'
    return localStorage.getItem(THEME_STORAGE_KEY) || 'sistema'
  })

  const [esOscuro, setEsOscuro] = useState(() => {
    if (typeof window === 'undefined') return false
    const guardado = localStorage.getItem(THEME_STORAGE_KEY)
    if (guardado === 'dark') return true
    if (guardado === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const aplicarTema = () => {
      const darkActivo =
        tema === 'dark' ||
        (tema === 'sistema' && mediaQuery.matches)

      setEsOscuro(darkActivo)
      if (darkActivo) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    aplicarTema()

    const listener = () => {
      if (tema === 'sistema') {
        aplicarTema()
      }
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [tema])

  const setTema = (nuevoTema) => {
    setTemaState(nuevoTema)
    try {
      if (nuevoTema === 'sistema') {
        localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, nuevoTema)
      }
    } catch {
      // ignore
    }
  }

  return (
    <ThemeContext.Provider value={{ tema, esOscuro, setTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}
