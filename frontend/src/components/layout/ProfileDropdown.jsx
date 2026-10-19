import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  User,
  Sun,
  Moon,
  Monitor,
  Store,
  Shield,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
  Check,
} from 'lucide-react'

export default function ProfileDropdown() {
  const { usuario, logout } = useAuth()
  const { tema, setTema } = useTheme()
  const [abierto, setAbierto] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAbierto(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAbierto(false)
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [abierto])

  if (!usuario) return null

  const nombre = usuario.nombre?.trim() || usuario.email?.split('@')[0] || 'Usuario'
  const iniciales = nombre
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || 'U'

  const rolLabel = usuario.es_superadmin
    ? 'SuperAdmin'
    : usuario.rol === 'admin'
    ? 'Dueño / Admin'
    : 'Cajero'

  const handleCerrarSesion = () => {
    setAbierto(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Botón Avatar Interactivo */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={abierto}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        title="Menú de perfil y configuración"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-700 dark:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center select-none shadow-sm">
          {iniciales}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px]">
            {nombre}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            {rolLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-150 ${
            abierto ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable */}
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Cabecera del usuario */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {nombre}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {usuario.email}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Store size={10} />
                {rolLabel}
              </span>
              {usuario.es_superadmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <Shield size={10} />
                  Plataforma
                </span>
              )}
            </div>
          </div>

          {/* Selector de Tema: Claro / Oscuro / Sistema */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
              Apariencia
            </span>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px]">
              <button
                type="button"
                onClick={() => setTema('light')}
                className={`flex items-center justify-center gap-1 py-1 rounded-lg font-medium transition ${
                  tema === 'light'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Sun size={12} />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setTema('dark')}
                className={`flex items-center justify-center gap-1 py-1 rounded-lg font-medium transition ${
                  tema === 'dark'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Moon size={12} />
                <span>Oscuro</span>
              </button>
              <button
                type="button"
                onClick={() => setTema('sistema')}
                className={`flex items-center justify-center gap-1 py-1 rounded-lg font-medium transition ${
                  tema === 'sistema'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Monitor size={12} />
                <span>Auto</span>
              </button>
            </div>
          </div>

          {/* Enlaces según rol */}
          <div className="py-1">
            {usuario.es_superadmin && (
              <Link
                to="/superadmin"
                onClick={() => setAbierto(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-emerald-700 dark:text-emerald-400"
              >
                <Shield size={14} />
                <span>Panel SuperAdmin</span>
              </Link>
            )}

            {usuario.rol === 'admin' && (
              <>
                <Link
                  to="/configuracion"
                  onClick={() => setAbierto(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
                >
                  <Settings size={14} />
                  <span>Configuración y Cajeros</span>
                </Link>
                <Link
                  to="/planes"
                  onClick={() => setAbierto(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
                >
                  <Store size={14} />
                  <span>Planes de Suscripción</span>
                </Link>
              </>
            )}

            <Link
              to="/soporte"
              onClick={() => setAbierto(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-slate-700 dark:text-slate-300"
            >
              <HelpCircle size={14} />
              <span>Soporte y Ayuda</span>
            </Link>
          </div>

          {/* Cerrar Sesión */}
          <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={handleCerrarSesion}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium transition-colors"
            >
              <LogOut size={14} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
