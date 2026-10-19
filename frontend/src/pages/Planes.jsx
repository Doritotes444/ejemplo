import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Check,
  Loader2,
  ShieldCheck,
  Zap,
  Layers,
} from 'lucide-react'
import authService from '../services/authService'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

export default function Planes() {
  const [planes, setPlanes] = useState([])
  const [suscripcion, setSuscripcion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cambiandoCodigo, setCambiandoCodigo] = useState(null)
  const [periodoFacturacion, setPeriodoFacturacion] = useState('mensual')
  const [mensaje, setMensaje] = useState(null)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [resPlanes, resSub] = await Promise.all([
        fetch(`${BASE}/planes`),
        authService.fetchAuth(`${BASE}/planes/mi-suscripcion`),
      ])

      if (resPlanes.ok) {
        setPlanes(await resPlanes.json())
      }
      if (resSub.ok) {
        setSuscripcion(await resSub.json())
      }
    } catch {
      // Manejo silencioso
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const cambiarPlan = async (codigoDestino) => {
    setCambiandoCodigo(codigoDestino)
    setMensaje(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/planes/cambiar`, {
        method: 'POST',
        body: JSON.stringify({ plan_codigo: codigoDestino }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo cambiar el plan')
      }
      setMensaje({
        tipo: 'ok',
        texto:
          data.mensaje ||
          `Plan actualizado a ${codigoDestino.toUpperCase()} conservando toda tu información histórica.`,
      })
      await cargarDatos()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCambiandoCodigo(null)
    }
  }

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500">
        <Loader2 size={32} className="animate-spin text-violet-600 mb-3" />
        <p className="text-sm font-medium">Cargando planes y uso de tu tienda...</p>
      </div>
    )
  }

  const planActualCodigo = suscripcion?.plan_actual?.codigo || 'basic'
  const uso = suscripcion?.uso || {
    productos_activos: 0,
    usuarios_activos: 1,
    ventas_mes_actual: 0,
  }
  const limites = suscripcion?.plan_actual || {}

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Encabezado y Uso Actual */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} /> Suscripción SaaS Multi-Tienda
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-2">
              Planes Comerciales Configurables
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Cambia de plan en cualquier momento sin perder productos, ventas ni historial financiero.
            </p>
          </div>

          <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center self-start">
            <button
              type="button"
              onClick={() => setPeriodoFacturacion('mensual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                periodoFacturacion === 'mensual'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setPeriodoFacturacion('anual')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                periodoFacturacion === 'anual'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600'
              }`}
            >
              Anual
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">
                -15%
              </span>
            </button>
          </div>
        </div>

        {/* Medidores de consumo frente a límites del plan actual */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Productos en catálogo</span>
              <span>
                {uso.productos_activos} /{' '}
                {limites.max_productos >= 99999 ? 'Ilimitados' : limites.max_productos || 50}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (uso.productos_activos / (limites.max_productos || 50)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Usuarios / Cajeros activos</span>
              <span>
                {uso.usuarios_activos} / {limites.max_usuarios || 2}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (uso.usuarios_activos / (limites.max_usuarios || 2)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Ventas registradas este mes</span>
              <span>
                {uso.ventas_mes_actual} /{' '}
                {limites.max_ventas_mes >= 999999
                  ? 'Ilimitadas'
                  : fmt(limites.max_ventas_mes || 500)}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (uso.ventas_mes_actual / (limites.max_ventas_mes || 500)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* 3 Tarjetas de Planes: Gratis (basic), Standard (standard), Pro (pro) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
        {planes.map((plan) => {
          const esActual = plan.codigo === planActualCodigo
          const esDestacado = plan.codigo === 'standard' || plan.codigo === 'pro'
          const precioMostrar =
            periodoFacturacion === 'mensual'
              ? plan.precio_mensual_cop
              : Math.round((plan.precio_anual_cop || plan.precio_mensual_cop * 10) / 12)

          return (
            <div
              key={plan.codigo}
              className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                plan.codigo === 'pro'
                  ? 'bg-slate-900 text-white border-violet-500 shadow-lg'
                  : plan.codigo === 'standard'
                  ? 'bg-white text-slate-900 border-violet-300 shadow-md ring-1 ring-violet-200'
                  : 'bg-white text-slate-900 border-slate-200 shadow-sm'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      plan.codigo === 'pro'
                        ? 'bg-violet-500/20 text-violet-300'
                        : plan.codigo === 'standard'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {plan.codigo === 'basic' ? 'Gratis' : plan.codigo.toUpperCase()}
                  </span>
                  {esActual && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                      Plan Actual
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-extrabold">{plan.nombre}</h2>
                  <p
                    className={`text-xs mt-1 ${
                      plan.codigo === 'pro' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {plan.descripcion}
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">${fmt(precioMostrar)}</span>
                    <span
                      className={`text-xs ${
                        plan.codigo === 'pro' ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      COP / mes
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 pt-3 border-t border-slate-200/20 text-xs">
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      Hasta{' '}
                      <strong>
                        {plan.max_productos >= 99999 ? 'Ilimitados' : plan.max_productos}
                      </strong>{' '}
                      productos con fotografía
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      Hasta <strong>{plan.max_usuarios}</strong> usuarios (Admin + Cajeros)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-500 shrink-0" />
                    <span>
                      <strong>
                        {plan.max_ventas_mes >= 999999
                          ? 'Ventas ilimitadas'
                          : `${fmt(plan.max_ventas_mes)} ventas/mes`}
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={15} className="text-emerald-500 shrink-0" />
                    <span>Escáner de códigos de barras, Caja y Bóveda QR</span>
                  </li>
                  {plan.tiene_simulador && (
                    <li className="flex items-center gap-2">
                      <Layers size={15} className="text-violet-500 shrink-0" />
                      <span>Simulador Comercial y Exportación Excel</span>
                    </li>
                  )}
                  {plan.tiene_ia_voz && (
                    <li className="flex items-center gap-2">
                      <Zap size={15} className="text-amber-400 shrink-0" />
                      <span>Asistente IA por Voz Bidireccional + Chatbot</span>
                    </li>
                  )}
                  {plan.tiene_soporte_prioritario && (
                    <li className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                      <span>Soporte prioritario VIP</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  disabled={esActual || cambiandoCodigo === plan.codigo}
                  onClick={() => cambiarPlan(plan.codigo)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-extrabold transition-all min-h-[44px] ${
                    esActual
                      ? 'bg-slate-200/20 text-slate-400 cursor-default border border-slate-300/30'
                      : esDestacado
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {esActual
                    ? 'Plan Activo'
                    : cambiandoCodigo === plan.codigo
                    ? 'Activando plan...'
                    : `Activar Plan ${plan.nombre}`}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
