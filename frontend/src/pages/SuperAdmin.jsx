import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ArrowLeft, Shield, Sun, Moon, LogOut } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || '/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiFetch(path, clave, options = {}) {
  const opts = (clave && typeof clave === 'object') ? clave : options
  const keyHeader = typeof clave === 'string' && clave ? { 'x-superadmin-key': clave } : {}
  const token = localStorage.getItem('access_token')
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...keyHeader,
      ...(opts.headers || {}),
    },
  })
}

function formatFecha(iso) {
  if (!iso) return 'Sin trial'
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function formatError(detail) {
  if (!detail) return 'Ocurrió un error inesperado.'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((err) => {
      let msg = err.msg || 'Error de validación'
      if (msg.startsWith('Value error, ')) {
        msg = msg.replace('Value error, ', '')
      }
      if (err.loc && err.loc.length > 1) {
        const campo = err.loc[err.loc.length - 1]
        const campoFormateado = campo.charAt(0).toUpperCase() + campo.slice(1)
        return `${campoFormateado}: ${msg}`
      }
      return msg
    }).join(' | ')
  }
  if (typeof detail === 'object') {
    return detail.msg || JSON.stringify(detail)
  }
  return String(detail)
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const PLAN_COLORS = {
  basic: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  professional: 'bg-purple-100 text-purple-700',
}

function PlanBadge({ plan }) {
  const cls = PLAN_COLORS[plan] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}>
      {plan || 'sin plan'}
    </span>
  )
}

const ESTADO_COLORS = {
  abierto: 'bg-yellow-100 text-yellow-700',
  respondido: 'bg-blue-100 text-blue-700',
  cerrado: 'bg-slate-100 text-slate-500',
}

function EstadoBadge({ estado }) {
  const cls = ESTADO_COLORS[estado] || 'bg-slate-100 text-slate-500'
  const label = estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : '—'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function ActiveBadge({ activo }) {
  return activo ? (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">
      Activo
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
      Inactivo
    </span>
  )
}

// ─── Empresa Card ─────────────────────────────────────────────────────────────

function EmpresaCard({ empresa, clave, onRefresh }) {
  const [cargandoStatus, setCargandoStatus] = useState(false)
  const [mostrarTrial, setMostrarTrial] = useState(false)
  const [nuevaTrial, setNuevaTrial] = useState(toDatetimeLocalValue(empresa.trial_expires_at))
  const [cargandoTrial, setCargandoTrial] = useState(false)
  const [errorLocal, setErrorLocal] = useState('')
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [cargandoEliminar, setCargandoEliminar] = useState(false)
  const [mostrarPlan, setMostrarPlan] = useState(false)
  const [planSeleccionado, setPlanSeleccionado] = useState(empresa.plan || 'basic')
  const [cargandoPlan, setCargandoPlan] = useState(false)

  async function eliminarEmpresa() {
    setCargandoEliminar(true)
    setErrorLocal('')
    try {
      const res = await apiFetch(`/superadmin/empresas/${empresa.id}`, clave, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        onRefresh()
      } else {
        setErrorLocal('Error al eliminar')
        setConfirmandoEliminar(false)
      }
    } catch {
      setErrorLocal('Error de conexión')
      setConfirmandoEliminar(false)
    } finally {
      setCargandoEliminar(false)
    }
  }

  async function toggleStatus() {
    setCargandoStatus(true)
    setErrorLocal('')
    try {
      const res = await apiFetch(`/superadmin/empresas/${empresa.id}/status`, clave, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !empresa.is_active }),
      })
      if (res.ok) {
        onRefresh()
      } else {
        setErrorLocal('Error al cambiar estado')
      }
    } catch {
      setErrorLocal('Error de conexión')
    } finally {
      setCargandoStatus(false)
    }
  }

  async function confirmarTrial() {
    if (!nuevaTrial) return
    setCargandoTrial(true)
    setErrorLocal('')
    try {
      const res = await apiFetch(`/superadmin/empresas/${empresa.id}/trial`, clave, {
        method: 'PUT',
        body: JSON.stringify({ trial_expires_at: nuevaTrial }),
      })
      if (res.ok) {
        setMostrarTrial(false)
        onRefresh()
      } else {
        setErrorLocal('Error al extender trial')
      }
    } catch {
      setErrorLocal('Error de conexión')
    } finally {
      setCargandoTrial(false)
    }
  }

  async function confirmarPlan() {
    setCargandoPlan(true)
    setErrorLocal('')
    try {
      const res = await apiFetch(`/superadmin/empresas/${empresa.id}/plan`, clave, {
        method: 'PUT',
        body: JSON.stringify({ plan: planSeleccionado }),
      })
      if (res.ok) {
        setMostrarPlan(false)
        onRefresh()
      } else {
        const err = await res.json().catch(() => ({}))
        setErrorLocal(err?.detail || 'Error al actualizar el plan')
      }
    } catch {
      setErrorLocal('Error de conexión')
    } finally {
      setCargandoPlan(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-base leading-tight">{empresa.nombre_comercial}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{empresa.nit_o_cedula}</p>
        </div>
        <ActiveBadge activo={empresa.is_active} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <PlanBadge plan={empresa.plan} />
        <span className="text-xs text-slate-500">{empresa.total_usuarios} usuario{empresa.total_usuarios !== 1 ? 's' : ''}</span>
      </div>

      <div className="text-xs text-slate-600">
        <span className="font-medium">Trial:</span>{' '}
        {formatFecha(empresa.trial_expires_at)}
      </div>

      {errorLocal && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{errorLocal}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-1">
        <button
          onClick={toggleStatus}
          disabled={cargandoStatus}
          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
            empresa.is_active
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {cargandoStatus ? '...' : empresa.is_active ? 'Desactivar' : 'Activar'}
        </button>
        <button
          onClick={() => setMostrarTrial((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
        >
          Extender Trial
        </button>
        <button
          onClick={() => setMostrarPlan((v) => !v)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 transition-colors"
        >
          Cambiar Plan
        </button>
        {!confirmandoEliminar ? (
          <button
            onClick={() => setConfirmandoEliminar(true)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-700 transition-colors"
          >
            Eliminar
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={eliminarEmpresa}
              disabled={cargandoEliminar}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
            >
              {cargandoEliminar ? '...' : 'Si, borrar'}
            </button>
            <button
              onClick={() => setConfirmandoEliminar(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {mostrarPlan && (
        <div className="border border-violet-200 bg-violet-50 rounded-lg p-3 flex flex-col gap-2">
          <label className="text-xs font-medium text-violet-700">Seleccionar Plan</label>
          <div className="relative">
            <select
              value={planSeleccionado}
              onChange={(e) => setPlanSeleccionado(e.target.value)}
              className="w-full text-xs border border-violet-300 rounded px-2.5 py-1.5 bg-white focus:outline-none"
            >
              <option value="basic">Gratis / Basic (POS Esencial)</option>
              <option value="standard">Standard (Crecimiento Comercial)</option>
              <option value="pro">Pro (Gestión Inteligente IA)</option>
              <option value="premium">Premium (Acceso total)</option>
            </select>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={confirmarPlan}
              disabled={cargandoPlan}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 transition-colors"
            >
              {cargandoPlan ? 'Guardando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setMostrarPlan(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mostrarTrial && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-3 flex flex-col gap-2">
          <label className="text-xs font-medium text-indigo-700">Nueva fecha de trial</label>
          <input
            type="datetime-local"
            value={nuevaTrial}
            onChange={(e) => setNuevaTrial(e.target.value)}
            className="text-xs border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={confirmarTrial}
              disabled={cargandoTrial || !nuevaTrial}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              {cargandoTrial ? 'Guardando...' : 'Confirmar'}
            </button>
            <button
              onClick={() => setMostrarTrial(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modal Nueva Empresa ──────────────────────────────────────────────────────

function ModalNuevaEmpresa({ onClose, onCreada }) {
  const [form, setForm] = useState({
    nombre_comercial: '',
    nit_o_cedula: '',
    email: '',
    password: '',
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  function cambiar(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nombre_comercial.trim() || !form.nit_o_cedula.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Todos los campos son obligatorios.')
      return
    }
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/registro-completo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rol: 'admin' }),
      })
      if (res.status === 201 || res.ok) {
        setForm({ nombre_comercial: '', nit_o_cedula: '', email: '', password: '' })
        onCreada()
        onClose()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(formatError(data?.detail) || 'Error al crear la empresa.')
      }
    } catch {
      setError('Error de conexión.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          disabled={cargando}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors text-lg leading-none"
        >
          &times;
        </button>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Nueva Empresa</h2>
        <p className="text-sm text-slate-500 mb-5">
          Se creara un usuario administrador junto con la empresa.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          {[
            { name: 'nombre_comercial', label: 'Nombre comercial', type: 'text', placeholder: 'Ej: Tienda Don Pedro', autocomplete: 'off' },
            { name: 'nit_o_cedula', label: 'NIT o Cedula', type: 'text', placeholder: 'Ej: 900123456', autocomplete: 'off' },
            { name: 'email', label: 'Email del admin', type: 'email', placeholder: 'admin@empresa.com', autocomplete: 'new-email' },
            { name: 'password', label: 'Contrasena inicial', type: 'password', placeholder: 'Min. 8 caracteres', autocomplete: 'new-password' },
          ].map(({ name, label, type, placeholder, autocomplete }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={cambiar}
                placeholder={placeholder}
                autoFocus={name === 'nombre_comercial'}
                autoComplete={autocomplete}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={cargando}
              className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {cargando ? 'Creando...' : 'Crear Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tab Comercios ────────────────────────────────────────────────────────────

function TabComercios({ clave }) {
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)

  const cargarEmpresas = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await apiFetch('/superadmin/empresas', clave)
      if (res.ok) {
        const data = await res.json()
        setEmpresas(data)
      } else {
        setError('Error al cargar empresas')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }, [clave])

  useEffect(() => {
    cargarEmpresas()
  }, [cargarEmpresas])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Cargando comercios...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={cargarEmpresas} className="text-sm text-indigo-600 hover:underline">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{empresas.length} comercio{empresas.length !== 1 ? 's' : ''} registrado{empresas.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={cargarEmpresas}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Actualizar
          </button>
          <button
            onClick={() => setMostrarModal(true)}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nueva Empresa
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map((empresa) => (
          <EmpresaCard
            key={empresa.id}
            empresa={empresa}
            clave={clave}
            onRefresh={cargarEmpresas}
          />
        ))}
      </div>
      {mostrarModal && (
        <ModalNuevaEmpresa
          onClose={() => setMostrarModal(false)}
          onCreada={cargarEmpresas}
        />
      )}
    </div>
  )
}

// ─── Tab Soporte ──────────────────────────────────────────────────────────────

const FILTROS = ['todos', 'abierto', 'respondido', 'cerrado']

function TicketListItem({ ticket, seleccionado, onClick }) {
  const fecha = ticket.created_at
    ? new Date(ticket.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
    : '—'
  const empresaCorta = ticket.empresa_id
    ? String(ticket.empresa_id).substring(0, 8) + '...'
    : '—'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
        seleccionado ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold leading-tight ${seleccionado ? 'text-indigo-700' : 'text-slate-800'} line-clamp-1`}>
          {ticket.asunto || 'Sin asunto'}
        </p>
        <EstadoBadge estado={ticket.estado} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-slate-400">{fecha}</span>
        <span className="text-xs text-slate-400">·</span>
        <span className="text-xs text-slate-400 font-mono">{empresaCorta}</span>
      </div>
    </button>
  )
}

function TicketDetalle({ ticket, clave, onRefresh }) {
  const [respuesta, setRespuesta] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  // Reset state when ticket changes
  useEffect(() => {
    setRespuesta('')
    setError('')
    setExito(false)
  }, [ticket?.id])

  async function enviarRespuesta() {
    if (!respuesta.trim()) return
    setCargando(true)
    setError('')
    setExito(false)
    try {
      const res = await apiFetch(`/superadmin/tickets/${ticket.id}/responder`, clave, {
        method: 'POST',
        body: JSON.stringify({ mensaje: respuesta.trim() }),
      })
      if (res.ok) {
        setRespuesta('')
        setExito(true)
        onRefresh()
        setTimeout(() => setExito(false), 3000)
      } else {
        setError('Error al enviar respuesta')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-full py-16 text-slate-400 text-sm">
        Selecciona un ticket para ver el detalle
      </div>
    )
  }

  const fechaCreado = ticket.created_at
    ? new Date(ticket.created_at).toLocaleString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'
  const fechaActualizado = ticket.updated_at
    ? new Date(ticket.updated_at).toLocaleString('es-CO', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-slate-800 text-base leading-tight">{ticket.asunto || 'Sin asunto'}</h3>
          <EstadoBadge estado={ticket.estado} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
          <dt className="font-medium text-slate-600">Empresa ID</dt>
          <dd className="font-mono">{ticket.empresa_id || '—'}</dd>
          <dt className="font-medium text-slate-600">Creado</dt>
          <dd>{fechaCreado}</dd>
          <dt className="font-medium text-slate-600">Actualizado</dt>
          <dd>{fechaActualizado}</dd>
        </dl>
      </div>

      <div className="p-4 bg-amber-50 border-b border-amber-100">
        <p className="text-xs text-amber-700">
          Los mensajes del hilo estan disponibles en la vista del cliente.
        </p>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3">
        <label className="text-sm font-semibold text-slate-700">Responder al ticket</label>
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder="Escribe tu respuesta al cliente..."
          rows={5}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
        )}
        {exito && (
          <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
            Respuesta enviada correctamente.
          </p>
        )}
        <button
          onClick={enviarRespuesta}
          disabled={cargando || !respuesta.trim()}
          className="self-start bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {cargando ? 'Enviando...' : 'Responder'}
        </button>
      </div>
    </div>
  )
}

function TabSoporte({ clave }) {
  const [tickets, setTickets] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null)

  const cargarTickets = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await apiFetch('/superadmin/tickets', clave)
      if (res.ok) {
        const data = await res.json()
        setTickets(data)
        // Keep selected ticket in sync after refresh
        if (ticketSeleccionado) {
          const actualizado = data.find((t) => t.id === ticketSeleccionado.id)
          setTicketSeleccionado(actualizado || null)
        }
      } else {
        setError('Error al cargar tickets')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }, [clave]) // intentionally omit ticketSeleccionado to avoid loop

  useEffect(() => {
    cargarTickets()
  }, [cargarTickets])

  const ticketsFiltrados = filtro === 'todos'
    ? tickets
    : tickets.filter((t) => t.estado === filtro)

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '600px' }}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold capitalize transition-colors ${
              filtro === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {f === 'todos' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'todos' && ` (${tickets.length})`}
            {f !== 'todos' && ` (${tickets.filter((t) => t.estado === f).length})`}
          </button>
        ))}
        <button
          onClick={cargarTickets}
          className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white">
        {/* Left: ticket list */}
        <div className="w-80 shrink-0 border-r border-slate-200 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              Cargando...
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : ticketsFiltrados.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              Sin tickets en este filtro
            </div>
          ) : (
            ticketsFiltrados.map((ticket) => (
              <TicketListItem
                key={ticket.id}
                ticket={ticket}
                seleccionado={ticketSeleccionado?.id === ticket.id}
                onClick={() => setTicketSeleccionado(ticket)}
              />
            ))
          )}
        </div>

        {/* Right: ticket detail */}
        <div className="flex-1 overflow-y-auto">
          <TicketDetalle
            ticket={ticketSeleccionado}
            clave={clave}
            onRefresh={cargarTickets}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Tab Planes Configurables ─────────────────────────────────────────────────

function TabPlanesConfig({ clave }) {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')

  const cargarPlanes = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`${API}/planes`)
      if (res.ok) setPlanes(await res.json())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarPlanes()
  }, [cargarPlanes])

  const guardarPlan = async (plan) => {
    setMensaje('')
    const res = await apiFetch(`/superadmin/planes/${plan.codigo}`, clave, {
      method: 'PUT',
      body: JSON.stringify(plan),
    })
    if (res.ok) {
      setMensaje(`Plan ${plan.nombre} actualizado correctamente.`)
      cargarPlanes()
    }
  }

  const actualizarCampo = (codigo, campo, valor) => {
    setPlanes((prev) =>
      prev.map((p) => (p.codigo === codigo ? { ...p, [campo]: valor } : p))
    )
  }

  if (cargando) return <p className="text-sm text-slate-500 py-8">Cargando planes...</p>

  return (
    <div className="space-y-4">
      {mensaje && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {mensaje}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planes.map((p) => (
          <div
            key={p.codigo}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800">{p.nombre}</span>
              <span className="font-mono uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                {p.codigo}
              </span>
            </div>
            <div>
              <label className="block text-slate-500 mb-0.5">Precio Mensual (COP)</label>
              <input
                type="number"
                value={p.precio_mensual_cop}
                onChange={(e) =>
                  actualizarCampo(p.codigo, 'precio_mensual_cop', Number(e.target.value))
                }
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-500 mb-0.5">Máx Prod.</label>
                <input
                  type="number"
                  value={p.max_productos}
                  onChange={(e) =>
                    actualizarCampo(p.codigo, 'max_productos', Number(e.target.value))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-0.5">Máx Usu.</label>
                <input
                  type="number"
                  value={p.max_usuarios}
                  onChange={(e) =>
                    actualizarCampo(p.codigo, 'max_usuarios', Number(e.target.value))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-0.5">Ventas/Mes</label>
                <input
                  type="number"
                  value={p.max_ventas_mes}
                  onChange={(e) =>
                    actualizarCampo(p.codigo, 'max_ventas_mes', Number(e.target.value))
                  }
                  className="w-full border border-slate-200 rounded-lg px-2 py-1"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => guardarPlan(p)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg"
            >
              Guardar Configuración
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab Métricas Globales ────────────────────────────────────────────────────

function TabMetricasGlobales({ clave }) {
  const [metricas, setMetricas] = useState(null)

  useEffect(() => {
    apiFetch('/superadmin/metricas-globales', clave)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetricas(d))
      .catch(() => {})
  }, [clave])

  if (!metricas) return <p className="text-sm text-slate-500 py-8">Cargando métricas globales...</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Tiendas Activas</span>
        <strong className="text-2xl text-slate-800">
          {metricas.empresas_activas} / {metricas.total_empresas}
        </strong>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Usuarios Totales</span>
        <strong className="text-2xl text-slate-800">{metricas.total_usuarios}</strong>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Productos Registrados</span>
        <strong className="text-2xl text-slate-800">{metricas.total_productos}</strong>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Transacciones POS</span>
        <strong className="text-2xl text-indigo-600">{metricas.total_ventas_registradas}</strong>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Volumen Transaccionado</span>
        <strong className="text-xl text-emerald-600">
          ${Number(metricas.volumen_transaccionado_cop || 0).toLocaleString('es-CO')}
        </strong>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <span className="text-xs text-slate-400 block">Tickets Abiertos</span>
        <strong className="text-2xl text-amber-600">{metricas.tickets_soporte_abiertos}</strong>
      </div>
    </div>
  )
}

// ─── Tab Auditoría ────────────────────────────────────────────────────────────

function TabAuditoria({ clave }) {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    apiFetch('/superadmin/auditoria?limit=60', clave)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLogs(d))
      .catch(() => {})
  }, [clave])

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
        Bitácora de Auditoría y Eventos Críticos ({logs.length})
      </div>
      <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto text-xs">
        {logs.map((l) => (
          <div key={l.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-indigo-700 mr-2">[{l.accion}]</span>
              <span className="font-semibold text-slate-700">{l.entidad}:</span>{' '}
              <span className="text-slate-600">{l.detalle}</span>
            </div>
            <div className="text-slate-400 shrink-0 font-mono text-[11px]">
              {l.usuario_email || 'sistema'} · {l.created_at ? new Date(l.created_at).toLocaleString('es-CO') : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

function PanelPrincipal({ clave = '', usuario, onLogout }) {
  const [tabActiva, setTabActiva] = useState('comercios')
  const { tema, setTema } = useTheme()

  const TABS = [
    { id: 'comercios', label: 'Tiendas y Comercios' },
    { id: 'planes', label: 'Planes Configurables' },
    { id: 'metricas', label: 'Métricas Globales' },
    { id: 'soporte', label: 'Tickets de Soporte' },
    { id: 'auditoria', label: 'Auditoría' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            to="/ventas"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mr-2"
            title="Volver al punto de venta"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Tienda</span>
          </Link>
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Shield size={18} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Plataforma SuperAdmin
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              Gobierno global de Tiendapp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle de tema */}
          <button
            type="button"
            onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cambiar tema"
          >
            {tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors"
          >
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 overflow-x-auto">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`py-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tabActiva === tab.id
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        {tabActiva === 'comercios' && <TabComercios clave={clave} />}
        {tabActiva === 'planes' && <TabPlanesConfig clave={clave} />}
        {tabActiva === 'metricas' && <TabMetricasGlobales clave={clave} />}
        {tabActiva === 'soporte' && <TabSoporte clave={clave} />}
        {tabActiva === 'auditoria' && <TabAuditoria clave={clave} />}
      </main>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return <PanelPrincipal clave="" usuario={usuario} onLogout={handleLogout} />
}
