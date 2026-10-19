import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Building2,
  Plus,
  UserCheck,
  UserX,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  X,
  Shield,
  Loader2,
} from 'lucide-react'
import usuarioService from '../services/usuarioService'
import authService from '../services/authService'

const BASE = import.meta.env.VITE_API_URL || '/api'
const MAX_CAJEROS_BASIC = 3

export default function Configuracion() {
  const navigate = useNavigate()
  const [tabActiva, setTabActiva] = useState('equipo') // 'equipo' | 'negocio'

  // Estado Empresa
  const [empresa, setEmpresa] = useState(null)
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true)

  // Estado Empleados
  const [empleados, setEmpleados] = useState([])
  const [cargandoEmpleados, setCargandoEmpleados] = useState(true)
  const [errorEmpleados, setErrorEmpleados] = useState(null)

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [modalDesactivar, setModalDesactivar] = useState(null) // empleado a desactivar
  const [modalUpsellAbierto, setModalUpsellAbierto] = useState(false)

  // Formulario Crear Cajero
  const [formCajero, setFormCajero] = useState({
    nombre: '',
    email: '',
    password: '',
  })
  const [guardandoCajero, setGuardandoCajero] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [mensajeExito, setMensajeExito] = useState(null)

  // Cargar datos de la empresa
  const cargarEmpresa = useCallback(async () => {
    try {
      const res = await authService.fetchAuth(`${BASE}/empresas/mi-empresa`)
      if (res.ok) {
        setEmpresa(await res.json())
      }
    } catch {
      // manejo silencioso
    } finally {
      setCargandoEmpresa(false)
    }
  }, [])

  // Cargar empleados
  const cargarEmpleados = useCallback(async () => {
    setCargandoEmpleados(true)
    setErrorEmpleados(null)
    try {
      const data = await usuarioService.listarEmpleados()
      setEmpleados(data)
    } catch (err) {
      setErrorEmpleados(err.message || 'Error al cargar la lista de cajeros')
    } finally {
      setCargandoEmpleados(false)
    }
  }, [])

  useEffect(() => {
    cargarEmpresa()
    cargarEmpleados()
  }, [cargarEmpresa, cargarEmpleados])

  // Conteo de cajeros activos
  const cajerosActivos = empleados.filter((e) => e.is_active).length
  const esPlanBasico = (empresa?.plan || 'basic').toLowerCase() === 'basic'
  const cuposRestantes = Math.max(0, MAX_CAJEROS_BASIC - cajerosActivos)
  const limiteAlcanzado = esPlanBasico && cajerosActivos >= MAX_CAJEROS_BASIC

  // Manejador del botón "+ Agregar Cajero"
  const handleAbrirCrear = () => {
    setErrorForm(null)
    setFormCajero({ nombre: '', email: '', password: '' })
    if (limiteAlcanzado) {
      setModalUpsellAbierto(true)
      return
    }
    setModalCrearAbierto(true)
  }

  // Guardar nuevo cajero
  const handleCrearCajero = async (e) => {
    e.preventDefault()
    setGuardandoCajero(true)
    setErrorForm(null)

    try {
      await usuarioService.crearEmpleado(formCajero)
      setModalCrearAbierto(false)
      setFormCajero({ nombre: '', email: '', password: '' })
      setMensajeExito('Cajero registrado exitosamente')
      setTimeout(() => setMensajeExito(null), 4000)
      await cargarEmpleados()
    } catch (err) {
      if (err.isLimitReached || err.code === 'LIMIT_CAJEROS_REACHED' || (err.message && err.message.toLowerCase().includes('límite de 3 cajeros'))) {
        setModalCrearAbierto(false)
        setModalUpsellAbierto(true)
      } else {
        setErrorForm(err.message)
      }
    } finally {
      setGuardandoCajero(false)
    }
  }

  // Solicitar confirmación de desactivación
  const handleToggleEstado = (empleado) => {
    if (empleado.is_active) {
      // Desactivar: requiere confirmación para evitar toques accidentales
      setModalDesactivar(empleado)
    } else {
      // Reactivar: intentar directamente en el backend
      ejecutarCambioEstado(empleado.id, true)
    }
  }

  // Ejecutar cambio de estado (activar o desactivar)
  const ejecutarCambioEstado = async (cajeroId, nuevoEstado) => {
    try {
      await usuarioService.cambiarEstadoEmpleado(cajeroId, nuevoEstado)
      setModalDesactivar(null)
      await cargarEmpleados()
    } catch (err) {
      if (err.isLimitReached || err.code === 'LIMIT_CAJEROS_REACHED' || (err.message && err.message.toLowerCase().includes('límite de 3 cajeros'))) {
        setModalDesactivar(null)
        setModalUpsellAbierto(true)
      } else {
        alert(err.message || 'No se pudo actualizar el estado del cajero')
      }
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Administra el equipo de trabajo de tu tienda y los datos de tu negocio
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTabActiva('equipo')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tabActiva === 'equipo'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users size={18} />
          Equipo de Trabajo ({empleados.length})
        </button>
        <button
          onClick={() => setTabActiva('negocio')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tabActiva === 'negocio'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 size={18} />
          Datos de Negocio
        </button>
      </div>

      {mensajeExito && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: EQUIPO DE TRABAJO */}
      {/* ======================================================== */}
      {tabActiva === 'equipo' && (
        <div className="space-y-6">
          {/* Card de Cupos y Límite */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Cajeros en Mostrador</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Plan {empresa?.plan ? empresa.plan.toUpperCase() : 'BÁSICO'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {esPlanBasico ? (
                    <>
                      Tienes{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {cajerosActivos} de {MAX_CAJEROS_BASIC}
                      </strong>{' '}
                      cajeros activos.{' '}
                      {cuposRestantes > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          ({cuposRestantes} {cuposRestantes === 1 ? 'cupo libre' : 'cupos libres'})
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          (Límite alcanzado)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Tienes <strong className="text-slate-700 dark:text-slate-200">{cajerosActivos}</strong> cajeros activos.{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cupos ilimitados</span>
                    </>
                  )}
                </p>
              </div>

              <button
                onClick={handleAbrirCrear}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-[0.98]"
              >
                <Plus size={18} />
                Agregar Cajero
              </button>
            </div>

            {/* Barra de progreso accesible */}
            {esPlanBasico && (
              <div className="mt-4">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      cajerosActivos >= MAX_CAJEROS_BASIC ? 'bg-amber-500' : 'bg-slate-900 dark:bg-white'
                    }`}
                    style={{ width: `${Math.min(100, (cajerosActivos / MAX_CAJEROS_BASIC) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Listado de Empleados */}
          {cargandoEmpleados ? (
            <div className="flex items-center justify-center h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                <Loader2 size={22} className="animate-spin text-slate-600 dark:text-slate-300" />
                Cargando equipo de trabajo...
              </div>
            </div>
          ) : errorEmpleados ? (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-5 rounded-2xl text-center space-y-3">
              <p className="text-sm font-medium">{errorEmpleados}</p>
              <button
                onClick={cargarEmpleados}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : empleados.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={28} />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-base">Sin cajeros registrados</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                Agrega a tus cajeros o colaboradores para que puedan registrar ventas en el mostrador
                con su propio usuario.
              </p>
              <button
                onClick={handleAbrirCrear}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2"
              >
                <Plus size={18} />
                Agregar Primer Cajero
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
              {empleados.map((emp) => (
                <div
                  key={emp.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base ${
                        emp.is_active
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {emp.nombre ? emp.nombre.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                          {emp.nombre || 'Cajero sin nombre'}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            emp.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {emp.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{emp.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {emp.is_active ? 'Puede registrar ventas' : 'Acceso bloqueado'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleEstado(emp)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                        emp.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={emp.is_active}
                      title={emp.is_active ? 'Desactivar cajero' : 'Activar cajero'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          emp.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: DATOS DE NEGOCIO */}
      {/* ======================================================== */}
      {tabActiva === 'negocio' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white text-base">Información del Negocio</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Datos registrados para facturación, tickets y control multi-tenant
            </p>
          </div>

          {cargandoEmpresa ? (
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm py-8">
              <Loader2 size={20} className="animate-spin text-slate-600 dark:text-slate-300" />
              Cargando información...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Nombre Comercial
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {empresa?.nombre_comercial || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  NIT o Cédula
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-base font-mono">
                  {empresa?.nit_o_cedula || '—'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Plan Activo
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white text-base uppercase">
                    {empresa?.plan || 'BASIC'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                    Activo
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Fecha de Registro
                </span>
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {empresa?.created_at
                    ? new Date(empresa.created_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ¿Deseas cambiar tu razón social o actualizar NIT?
            </p>
            <button
              onClick={() => navigate('/soporte')}
              className="text-xs text-slate-900 dark:text-slate-200 hover:underline font-semibold"
            >
              Contactar Soporte
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CREAR CAJERO */}
      {/* ======================================================== */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Agregar Cajero</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nuevo acceso al mostrador</p>
                </div>
              </div>
              <button
                onClick={() => setModalCrearAbierto(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {errorForm && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs p-3.5 rounded-xl flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                <span className="flex-1 font-medium">{errorForm}</span>
              </div>
            )}

            <form onSubmit={handleCrearCajero} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Cajero / Empleado
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ej: Paula Andrea"
                  value={formCajero.nombre}
                  onChange={(e) => setFormCajero({ ...formCajero, nombre: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Correo Electrónico (Login)
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="paula@tutienda.com"
                  value={formCajero.email}
                  onChange={(e) => setFormCajero({ ...formCajero, email: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña Temporal
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres (Mayús, núm, símbolo)"
                  value={formCajero.password}
                  onChange={(e) => setFormCajero({ ...formCajero, password: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Debe incluir 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial (ej: Abc12345!)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCajero}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  {guardandoCajero ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cajero'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CONFIRMAR DESACTIVACIÓN (Anti-toques accidentales) */}
      {/* ======================================================== */}
      {modalDesactivar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                ¿Desactivar a {modalDesactivar.nombre || 'este cajero'}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Al desactivarlo, se anulará de inmediato su acceso al punto de venta y no podrá registrar
                nuevas ventas. Podrás reactivarlo cuando lo necesites.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalDesactivar(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => ejecutarCambioEstado(modalDesactivar.id, false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors"
              >
                Sí, Desactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: UPSELLING A PLAN PRO */}
      {/* ======================================================== */}
      {modalUpsellAbierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-14 h-14 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
              <Sparkles size={28} className="text-amber-400" />
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-widest text-slate-600 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                Crecimiento de Negocio
              </span>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xl mt-2">
                ¡Tu equipo está creciendo!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Has alcanzado el límite de <strong>3 cajeros activos</strong> incluidos en tu Plan
                Básico. Desbloquea la potencia total de Tiendapp con el <strong>Plan Pro</strong>.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 text-left space-y-2 text-xs text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span><strong>Cajeros ilimitados</strong> en mostrador</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-slate-400 shrink-0" />
                <span><strong>Agente de Voz con IA</strong> para cobrar con voz en mostrador</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span><strong>Reportes de rentabilidad y COGS</strong> detallados</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-500 shrink-0" />
                <span>Soporte prioritario para tu tienda</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalUpsellAbierto(false)}
                className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalUpsellAbierto(false)
                  navigate('/planes')
                }}
                className="w-full sm:w-1/2 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm transition-all"
              >
                Ver Plan Pro →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
