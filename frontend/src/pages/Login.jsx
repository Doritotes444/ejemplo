import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, KeyRound } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'

export default function Login() {
  const { login } = useAuth()
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

  const cambiar = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const enviar = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError(null)
    try {
      const data = await login(form.email, form.password)
      const rutaDestino = data?.usuario?.rol === 'admin' ? '/dashboard' : '/ventas'
      navigate(rutaDestino, { replace: true })
    } catch (e) {
      setError(e.message)
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
      if (!res.ok) throw new Error(data.detail || 'Error al solicitar recuperación')
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
        texto: '✅ Contraseña actualizada con éxito. Ya puedes iniciar sesión.',
      })
      setTimeout(() => {
        setModalRecuperar(false)
        setPasoRecuperar(1)
        setMsgRecuperar(null)
      }, 2000)
    } catch (err) {
      setMsgRecuperar({ tipo: 'error', texto: err.message })
    } finally {
      setEnviandoRecuperar(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col justify-between p-4 font-sans">
      <div className="w-full max-w-[360px] mx-auto pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          <span>Volver a la página principal</span>
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-3">📦</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              Tiendapp · Gestión Neiva
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Ingreso a tu tienda y punto de venta
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            {sesionExpirada && !error && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-2xl text-xs text-center font-medium border border-amber-200 leading-relaxed">
                ⚠️ Tu sesión terminó por seguridad o inactividad. Por favor inicia sesión nuevamente.
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-2xl text-xs text-center font-medium border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={cambiar}
                required
                autoComplete="email"
                placeholder="nombre@tutienda.com"
                className="w-full bg-[#fafaf9] border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setEmailRecuperar(form.email)
                    setModalRecuperar(true)
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline"
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
                className="w-full bg-[#fafaf9] border border-slate-200 rounded-xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-sm active:scale-98 min-h-[48px]"
              >
                {cargando ? 'Ingresando...' : 'Entrar a mi Tienda'}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500 space-y-2">
            <p>
              ¿Aún no has registrado tu tienda?{' '}
              <Link to="/registro" className="text-emerald-700 font-bold hover:underline">
                Crear cuenta aquí
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {modalRecuperar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <KeyRound size={18} className="text-emerald-600" />
                <span>Recuperar Contraseña</span>
              </div>
              <button
                type="button"
                onClick={() => setModalRecuperar(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {msgRecuperar && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  msgRecuperar.tipo === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {msgRecuperar.texto}
              </div>
            )}

            {pasoRecuperar === 1 ? (
              <form onSubmit={solicitarToken} className="space-y-3">
                <p className="text-xs text-slate-500">
                  Ingresa el correo registrado de tu tienda para generar tu código de restablecimiento.
                </p>
                <input
                  type="email"
                  required
                  placeholder="nombre@tutienda.com"
                  value={emailRecuperar}
                  onChange={(e) => setEmailRecuperar(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                />
                <button
                  type="submit"
                  disabled={enviandoRecuperar}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs"
                >
                  {enviandoRecuperar ? 'Solicitando...' : 'Generar código de recuperación'}
                </button>
              </form>
            ) : (
              <form onSubmit={confirmarNuevaPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código de recuperación
                  </label>
                  <input
                    type="text"
                    required
                    value={tokenRecuperar}
                    onChange={(e) => setTokenRecuperar(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nueva contraseña (mín. 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={enviandoRecuperar}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs"
                >
                  {enviandoRecuperar ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-slate-400 py-6">
        Tiendapp · Gestión Neiva · Punto de venta y administración para el comercio local
      </div>
    </div>
  )
}
