import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Play,
  X,
  TrendingUp,
  TrendingDown,
  Zap,
  Wallet,
  QrCode,
  Calculator,
  AlertTriangle,
} from 'lucide-react'
import OnboardingModal from '../components/onboarding/OnboardingModal'
import GuiaPrimerosPasos from '../components/onboarding/GuiaPrimerosPasos'

const BASE = import.meta.env.VITE_API_URL || '/api'
const PALETA = ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']

function TooltipVentas({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-slate-800 mb-0.5">{payload[0].payload.nombre}</p>
      <p className="text-violet-600">
        {Number(payload[0].value).toLocaleString('es-CO')} vendidos
      </p>
    </div>
  )
}

function BadgeDias({ dias }) {
  if (dias < 0)
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        Vencido
      </span>
    )
  if (dias === 0)
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        Vence hoy
      </span>
    )
  if (dias <= 7)
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
        {dias}d
      </span>
    )
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      {dias}d
    </span>
  )
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [mostrarBienvenida, setMostrarBienvenida] = useState(false)
  const [videoModalAbierto, setVideoModalAbierto] = useState(false)

  useEffect(() => {
    const esBienvenidaUrl =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('bienvenida') === '1'
    const esPendienteStorage =
      typeof window !== 'undefined' &&
      localStorage.getItem('onboarding_pendiente') === 'true'

    if (esBienvenidaUrl || esPendienteStorage) {
      setMostrarBienvenida(true)
    }
  }, [])

  const cerrarBienvenida = () => {
    setMostrarBienvenida(false)
    localStorage.removeItem('onboarding_pendiente')
  }

  const verVideoTutorial = () => {
    cerrarBienvenida()
    setVideoModalAbierto(true)
  }

  useEffect(() => {
    if (!usuario?.empresa_id) return
    const cargar = async () => {
      try {
        const res = await authService.fetchAuth(`${BASE}/dashboard/${usuario.empresa_id}`)
        if (res.ok) setDatos(await res.json())
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [usuario])

  const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
  const topProductos = datos?.top_productos ?? []
  const alertasVenc = datos?.alertas_vencimiento ?? []
  const fin360 = datos?.finanzas_360 ?? null
  const masRentables = datos?.productos_mas_rentables ?? []
  const bajaRotacion = datos?.productos_baja_rotacion ?? []

  return (
    <div className="space-y-6">
      <OnboardingModal
        isOpen={mostrarBienvenida}
        onClose={cerrarBienvenida}
        onVerVideo={verVideoTutorial}
      />

      {videoModalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-4 sm:p-6 relative shadow-2xl space-y-4">
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-emerald-500" />
                <h3 className="font-bold text-sm sm:text-base">
                  Guía: ¿Cómo funciona Tiendapp?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalAbierto(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Cerrar video"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video controls autoPlay className="w-full h-full object-contain">
                <source src="/Grabación de pantalla 2026-06-03 115051.mp4" type="video/mp4" />
                Tu navegador no soporta la reproducción de video HTML5.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Encabezado y Accesos Rápidos de Operación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Visión 360° de la Tienda
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Bienvenido{usuario?.email ? `, ${usuario.email}` : ''} — estado operativo y financiero en tiempo real
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/ventas"
            className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm min-h-[42px]"
          >
            <Zap size={15} /> Venta Rápida (&lt;3s)
          </Link>
          <Link
            to="/caja"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1.5 min-h-[42px]"
          >
            <Wallet size={15} className="text-violet-600" /> Caja ({datos?.caja_abierta ? 'Abierta' : 'Cerrada'})
          </Link>
          <Link
            to="/comprobantes"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1.5 min-h-[42px]"
          >
            <QrCode size={15} className="text-violet-600" /> QR Pagos
          </Link>
          <Link
            to="/simulador"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-1.5 min-h-[42px]"
          >
            <Calculator size={15} className="text-violet-600" /> Simulador
          </Link>
        </div>
      </div>

      <GuiaPrimerosPasos
        totalProductos={datos?.total_productos ?? 0}
        ventasHoy={datos?.ventas_hoy ?? 0}
        onVerTutorial={() => setVideoModalAbierto(true)}
      />

      {/* Diagnóstico inmediato: ¿Estoy ganando o perdiendo dinero? (Sección 11) */}
      {!cargando && fin360 && (
        <div
          className={`rounded-2xl p-5 border shadow-sm space-y-4 ${
            fin360.estado_resultado === 'GANANCIA'
              ? 'bg-emerald-50/70 border-emerald-200'
              : fin360.estado_resultado === 'PERDIDA'
              ? 'bg-red-50/70 border-red-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  fin360.estado_resultado === 'GANANCIA'
                    ? 'bg-emerald-600 text-white'
                    : fin360.estado_resultado === 'PERDIDA'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}
              >
                {fin360.estado_resultado === 'PERDIDA' ? (
                  <TrendingDown size={22} />
                ) : (
                  <TrendingUp size={22} />
                )}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Diagnóstico Financiero ({fin360.periodo})
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {fin360.estado_resultado === 'GANANCIA'
                    ? `¡Tu tienda está ganando dinero! Utilidad neta: $${fmt(fin360.utilidad_neta)}`
                    : fin360.estado_resultado === 'PERDIDA'
                    ? `Atención: Los costos y egresos superan las ventas en $${fmt(Math.abs(fin360.utilidad_neta))}`
                    : 'Tu tienda está en punto de equilibrio ($0 utilidad neta acumulada)'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Margen bruto promedio: <strong>{fin360.margen_bruto_pct}%</strong> · Margen neto real:{' '}
                  <strong>{fin360.margen_neto_pct}%</strong>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right bg-white/90 px-4 py-2.5 rounded-xl border border-slate-200/80 shrink-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Efectivo Esperado en Caja
              </span>
              <span className="text-lg font-extrabold text-violet-700">
                ${fmt(datos?.saldo_caja_esperado ?? 0)}
              </span>
            </div>
          </div>

          {/* Distinción clara entre Ventas, Cobros, Costos, Egresos y Utilidad (Sección 11) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                1. Ventas Totales
              </span>
              <span className="text-base font-extrabold text-slate-900">
                ${fmt(fin360.ventas_totales)}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                2. Cobros Recibidos
              </span>
              <span className="text-base font-extrabold text-emerald-700">
                ${fmt(fin360.cobros_efectivo + fin360.cobros_digital)}
              </span>
              <span className="text-[10px] text-slate-400 block">
                Fiado: ${fmt(fin360.ventas_fiado)}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                3. Costo Mercancía
              </span>
              <span className="text-base font-extrabold text-slate-700">
                −${fmt(fin360.costo_mercancia_vendida)}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                4. Utilidad Bruta
              </span>
              <span className="text-base font-extrabold text-violet-700">
                ${fmt(fin360.utilidad_bruta)}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                5. Gastos / Egresos
              </span>
              <span className="text-base font-extrabold text-red-600">
                −${fmt(fin360.egresos_operativos)}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                6. Utilidad Neta
              </span>
              <span
                className={`text-base font-extrabold ${
                  fin360.utilidad_neta >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                ${fmt(fin360.utilidad_neta)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards del día */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ventas hoy</p>
          <p className="text-3xl font-bold text-slate-800">
            {cargando ? '…' : fmt(datos?.ventas_hoy ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ingresos hoy</p>
          <p className="text-3xl font-bold text-violet-600">
            {cargando ? '…' : `$${fmt(datos?.ingresos_hoy ?? 0)}`}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            Productos activos
          </p>
          <p className="text-3xl font-bold text-slate-800">
            {cargando ? '…' : fmt(datos?.total_productos ?? 0)}
          </p>
        </div>
      </div>

      {/* Gráfica top 5 + panel vencimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Top 5 productos más vendidos
          </h2>
          {cargando ? (
            <div className="flex items-center justify-center h-52">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
            </div>
          ) : topProductos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 text-slate-400 text-sm gap-2">
              <span className="text-3xl">📊</span>
              Aún no hay ventas registradas
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topProductos}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={100}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v.length > 12 ? `${v.slice(0, 12)}…` : v)}
                />
                <Tooltip content={<TooltipVentas />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="total_vendido" radius={[0, 6, 6, 0]} maxBarSize={30}>
                  {topProductos.map((_, i) => (
                    <Cell key={i} fill={PALETA[i % PALETA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Panel de alertas de vencimiento */}
        <div
          className={`rounded-xl border p-5 ${
            alertasVenc.length > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <h2
            className={`text-sm font-semibold mb-3 ${
              alertasVenc.length > 0 ? 'text-red-700' : 'text-green-700'
            }`}
          >
            Próximos a vencer
          </h2>

          {cargando ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 bg-red-100 rounded-lg" />
              ))}
            </div>
          ) : alertasVenc.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-3xl mb-2">✅</span>
              <p className="text-green-700 text-sm font-semibold">Todo en orden</p>
              <p className="text-green-600 text-xs mt-1">
                Ningún producto vence en los próximos 15 días
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-52">
              {alertasVenc.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg px-3 py-2 flex items-center justify-between gap-2 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-slate-400">{p.fecha_vencimiento}</p>
                  </div>
                  <BadgeDias dias={p.dias_restantes} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Productos más rentables y Productos de baja rotación */}
      {!cargando && (masRentables.length > 0 || bajaRotacion.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">
              🏆 Productos que más ganancia neta dejan (30 días)
            </h2>
            {masRentables.length === 0 ? (
              <p className="text-xs text-slate-400">Registra ventas para ver rentabilidad por producto.</p>
            ) : (
              <div className="space-y-2">
                {masRentables.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{p.nombre}</span>
                      <span className="text-slate-400 ml-2">
                        ({p.unidades} vendidas · margen {p.margen_pct}%)
                      </span>
                    </div>
                    <span className="font-extrabold text-emerald-600">
                      +${fmt(p.utilidad_generada)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-amber-500" />
              Productos con capital estancado (Sin ventas en 30 días)
            </h2>
            {bajaRotacion.length === 0 ? (
              <p className="text-xs text-emerald-600 font-medium">
                Todos tus productos con inventario han tenido rotación reciente.
              </p>
            ) : (
              <div className="space-y-2">
                {bajaRotacion.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-amber-50/50 border border-amber-100"
                  >
                    <span className="font-semibold text-slate-800">{p.nombre}</span>
                    <span className="text-amber-800 font-bold">
                      {p.stock_actual} uds (${fmt(p.capital_estancado)} en estante)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock bajo */}
      {!cargando && datos?.stock_bajo?.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <h2 className="text-sm font-semibold text-amber-700 mb-3">
            Alerta de Reabastecimiento — {datos.stock_bajo.length} producto
            {datos.stock_bajo.length === 1 ? '' : 's'} en stock mínimo o agotado
          </h2>
          <div className="space-y-2">
            {datos.stock_bajo.map((p) => (
              <div key={p.id} className="flex justify-between text-sm text-gray-700">
                <span>{p.nombre}</span>
                <span className="font-semibold text-amber-600">{p.cantidad} uds</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
