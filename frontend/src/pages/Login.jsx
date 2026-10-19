import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ArrowLeft, KeyRound, Store, Sun, Moon, Monitor } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'

export default function Login() {
  const { login } = useAuth()
  const { tema, setTema } = useTheme()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // Estado modal recuperación de contraseña
  const [modalRecuperar, setModalRecuperar] = useState(false)
  const [pasoRecuperar, setPasoRecuperar] = useState(1) // 1 = solicitar | 2 = confirmar
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [tokenRecuperar, setTokenRecuperar] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [msgRecuperar, setMsgRecuperar] = useState(null)
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false)

  const sesionExpirada =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('expirado') === '1'

  const cambiar = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError(null)
    try {
      const data = await login(form.email.trim(), form.password)
      // Enrutamiento canónico estricto según permisos validados en servidor
      if (data?.usuario?.es_superadmin) {
        navigate('/superadmin', { replace: true })
      } else {
        navigate('/ventas', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Credenciales inválidas')
    } finally {
      setCargando(false)
    }
  }

  const solicitarToken = async (e) => {
    e.preventDefault()
    setEnviandoRecuperar(true)
    setMsgRecuperar(null)
    try {
      const res = await fetch(`${BASE}/auth/solicitar-recuperacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailRecuperar.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(data.detail || 'Error al solicitar recuperación')
      if (data.token_desarrollo) {
        setTokenRecuperar(data.token_desarrollo)
      }
      setMsgRecuperar({
        tipo: 'ok',
        texto: data.mensaje || 'Código generado. Ingresa tu nueva contraseña.',
      })
      setPasoRecuperar(2)
    } catch (err) {
      setMsgRecuperar({ tipo: 'error', texto: err.message })
    } finally {
      setEnviandoRecuperar(false)
    }
  }

  const confirmarNuevaPassword = async (e) => {
    e.preventDefault()
    setEnviandoRecuperar(true)
    setMsgRecuperar(null)
    try {
      const res = await fetch(`${BASE}/auth/confirmar-recuperacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenRecuperar.trim(),
          nueva_password: nuevaPassword,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || 'Código inválido o vencido')
      setMsgRecuperar({
        tipo: 'ok',
        texto: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.',
      })
      setTimeout(() => {
        setModalRecuperar(false)
        setPasoRecuperar(1)
        setMsgRecuperar(null)
      }, 1800)
    } catch (err) {
      setMsgRecuperar({ tipo: 'error', texto: err.message })
    } finally {
      setEnviandoRecuperar(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 font-sans transition-colors">
      {/* Barra superior con volver y toggle de tema */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Inicio</span>
        </Link>

        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setTema('light')}
            className={`p-1.5 rounded-md ${
              tema === 'light'
                ? 'bg-white dark:bg-slate-700 text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Modo claro"
          >
            <Sun size={13} />
          </button>
          <button
            type="button"
            onClick={() => setTema('dark')}
            className={`p-1.5 rounded-md ${
              tema === 'dark'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Modo oscuro"
          >
            <Moon size={13} />
          </button>
          <button
            type="button"
            onClick={() => setTema('sistema')}
            className={`p-1.5 rounded-md ${
              tema === 'sistema'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Automático"
          >
            <Monitor size={13} />
          </button>
        </div>
      </div>

      {/* Tarjeta de Inicio de Sesión Canónica */}
      <div className="w-full max-w-sm mx-auto my-auto py-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xs mb-3">
              <Store size={26} strokeWidth={2.4} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Tiendapp
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ingresa con tu correo y contraseña
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {sesionExpirada && !error && (
              <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 p-3 rounded-xl text-xs text-center font-medium border border-amber-200 dark:border-amber-800">
                Tu sesión expiró. Inicia sesión para continuar.
              </div>
            )}

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 p-3 rounded-xl text-xs text-center font-medium border border-rose-200 dark:border-rose-800">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={cambiar}
                required
                autoComplete="email"
                placeholder="correo@tutienda.com"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEmailRecuperar(form.email)
                    setModalRecuperar(true)
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={cambiar}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={cargando}
                className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl transition shadow-xs active:scale-98"
              >
                {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
            ¿No tienes cuenta?{' '}
            <Link
              to="/registro"
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
            >
              Registra tu tienda
            </Link>
          </div>
        </div>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {modalRecuperar && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                <KeyRound size={18} className="text-emerald-600" />
                <span>Recuperar Contraseña</span>
              </div>
              <button
                type="button"
                onClick={() => setModalRecuperar(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {msgRecuperar && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  msgRecuperar.tipo === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {msgRecuperar.texto}
              </div>
            )}

            {pasoRecuperar === 1 ? (
              <form onSubmit={solicitarToken} className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ingresa tu correo para generar tu código de restablecimiento.
                </p>
                <input
                  type="email"
                  required
                  placeholder="correo@tutienda.com"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={enviandoRecuperar}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {enviandoRecuperar ? 'Generando...' : 'Generar Código'}
                </button>
              </form>
            ) : (
              <form onSubmit={confirmarNuevaPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Código de verificación
                  </label>
                  <input
                    type="text"
                    required
                    value={tokenRecuperar}
                    onChange={(e) => setTokenRecuperar(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nueva contraseña (mín. 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={enviandoRecuperar}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
                >
                  {enviandoRecuperar ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Pie de página */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-3">
        Tiendapp · Plataforma de gestión y ventas para el comercio local
      </div>
    </div>
  )
}
