import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import { 
  BarChart3, 
  TrendingUp, 
  Coins, 
  Package2, 
  RefreshCw, 
  Download, 
  ArrowUpRight, 
  AlertTriangle,
  Info,
  CheckCircle2,
  Zap,
  Award,
  Lightbulb
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'

export default function Reportes() {
  const { usuario } = useAuth()
  const [descargando, setDescargando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)
  const [resumen, setResumen] = useState({
    inversion_activa: 0,
    ingresos_totales: 0,
    cogs_total: 0,
    ganancia_neta: 0,
    costo_reposicion_bajo_stock: 0,
    costo_reposicion_total_sugerido: 0
  })

  // Cargar resumen financiero
  const cargarResumen = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = authService.getToken()
      const res = await fetch(`${BASE}/reportes/financieros/${usuario.empresa_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar el resumen financiero')
      const data = await res.json()
      setResumen(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (usuario?.empresa_id) {
      cargarResumen()
    }
  }, [usuario])

  const descargarExcel = async () => {
    setDescargando(true)
    setError(null)
    setExito(false)
    try {
      const token = authService.getToken()
      const res = await fetch(`${BASE}/reportes/ventas/excel/${usuario.empresa_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error generando el reporte Excel')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExito(true)
      setTimeout(() => setExito(false), 4000)
    } catch (e) {
      setError(e.message)
    } finally {
      setDescargando(false)
    }
  }

  // Formateador de moneda en Pesos Colombianos (COP)
  const formatearCOP = (valor) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor)
  }

  // Calcular porcentaje de recuperacion de capital
  const capitalComprometido = resumen.inversion_activa + resumen.cogs_total
  const porcentajeRecuperado = capitalComprometido > 0 
    ? Math.min(100, Math.round((resumen.ingresos_totales / capitalComprometido) * 100))
    : 0

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-slate-700 dark:text-slate-300 w-6 h-6" />
            Reportes Financieros e Inteligencia de Negocio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Visualiza el retorno de tu inversión, las ganancias netas y estima tu reinversión de inventario.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={cargarResumen}
            className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          
          <button
            onClick={descargarExcel}
            disabled={descargando}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 disabled:opacity-50 font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm text-sm"
          >
            <Download className="w-4 h-4" />
            {descargando ? 'Generando...' : 'Exportar Ventas Excel'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <div>
            <span className="font-semibold">Hubo un error:</span> {error}
          </div>
        </div>
      )}

      {exito && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
          <span><strong>¡Historial descargado con éxito!</strong> Se ha descargado tu archivo ventas.xlsx.</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-slate-400" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Calculando balance financiero e inventario...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas KPI Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Inversion Activa */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Package2 className="w-24 h-24 text-slate-800 dark:text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Package2 className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Inversión en Estanterías</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatearCOP(resumen.inversion_activa)}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Valor del stock actual a precio de costo.
              </p>
            </div>

            {/* Recaudo Bruto */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-24 h-24 text-slate-800 dark:text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Recaudo Bruto</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatearCOP(resumen.ingresos_totales)}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Total cobrado en ventas acumuladas.
              </p>
            </div>

            {/* Ganancia Neta Realizada */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Coins className="w-24 h-24 text-slate-800 dark:text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Coins className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Ganancia Neta Realizada</span>
                </div>
                <h3 className={`text-2xl font-bold tracking-tight ${resumen.ganancia_neta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatearCOP(resumen.ganancia_neta)}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Recaudo de ventas menos costo de mercancía.
              </p>
            </div>

            {/* Presupuesto de Reinversion */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <RefreshCw className="w-24 h-24 text-slate-800 dark:text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <RefreshCw className="w-5 h-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Presupuesto Reinversión</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {formatearCOP(resumen.costo_reposicion_total_sugerido)}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Capital sugerido para reabastecimiento.
              </p>
            </div>
          </div>

          {/* Visualizador de Recuperación de Capital */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ArrowUpRight className="text-slate-700 dark:text-slate-300 w-5 h-5" />
                    Estado de Recuperación de Capital
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Mide qué tanto de tu capital total invertido (inventario actual + lo vendido) ya has recuperado en la caja registradora.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{porcentajeRecuperado}%</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block">de capital recuperado</span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${porcentajeRecuperado}%` }}
                />
              </div>

              {/* Mensajes de negocio interactivos basados en ROI */}
              <div className="flex flex-col md:flex-row justify-between text-xs text-slate-500 dark:text-slate-400 gap-4 pt-2">
                <div className="flex gap-4">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">Capital Total Comprometido:</span>
                    <span>{formatearCOP(capitalComprometido)}</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">Recaudo de Ventas:</span>
                    <span>{formatearCOP(resumen.ingresos_totales)}</span>
                  </div>
                </div>
                
                <div className="flex items-center">
                  {porcentajeRecuperado < 50 ? (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full font-medium border border-amber-500/30 flex items-center gap-1.5">
                      <AlertTriangle size={14} /> Recuperando capital inicial
                    </span>
                  ) : porcentajeRecuperado < 100 ? (
                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-medium border border-blue-500/30 flex items-center gap-1.5">
                      <Zap size={14} /> Más de la mitad del capital recuperado
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full font-medium border border-emerald-500/30 flex items-center gap-1.5">
                      <Award size={14} /> ¡Inversión recuperada al 100%! Todo es utilidad neta
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Desglose de Presupuesto e Inteligencia de Reinversion */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel de Reinversion Desglosado */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
                <RefreshCw className="text-amber-500 w-5 h-5" />
                Desglose Presupuestario de Surtido
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Aproximación inteligente de los montos que deberías presupuestar para rellenar tus productos.
              </p>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="py-3 flex justify-between">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">A. Reposición de Productos Vendidos:</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Capital exacto para volver a comprar la cantidad que ya vendiste.</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">{formatearCOP(resumen.cogs_total)}</span>
                </div>

                <div className="py-3 flex justify-between">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">B. Abastecimiento de Stock Crítico:</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Costo para llevar los productos con stock bajo (≤ 5) a un nivel saludable (15 unidades).</span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">{formatearCOP(resumen.costo_reposicion_bajo_stock)}</span>
                </div>

                <div className="py-4 flex justify-between text-base bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                  <div>
                    <span className="font-black text-amber-900 dark:text-amber-200 block">Total de Reinversión Sugerido (A + B):</span>
                    <span className="text-xs text-amber-700 dark:text-amber-400">Monto total estimado para rellenar estantes y recuperar stock vendido.</span>
                  </div>
                  <span className="font-black text-amber-950 dark:text-amber-100 text-lg">{formatearCOP(resumen.costo_reposicion_total_sugerido)}</span>
                </div>
              </div>
            </div>

            {/* Panel Informativo de Utilidad en Estantes */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2">
                  <Info className="text-blue-500 w-5 h-5" />
                  ¿Cómo usar estos reportes en tu tienda?
                </h3>
                
                <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Inversión en Estanterías:</strong> Te ayuda a entender cuánto capital tienes quieto en mercancía. Si este número es muy alto y tus ventas son bajas, podrías tener exceso de stock.
                  </p>
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Ganancia Neta Realizada:</strong> Es tu rentabilidad líquida real. Es el dinero total de tus ventas tras restar el precio que pagaste por comprar esos productos. ¡Esta es tu ganancia de bolsillo!
                  </p>
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Presupuesto de Reinversión:</strong> ¡No te gastes todo el recaudo! Utiliza este presupuesto sugerido para pagarle a tus proveedores y reabastecer las mercancías más vendidas y las que están a punto de agotarse.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 mt-4 flex items-start gap-2.5">
                <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Consejo del Asistente:</strong> Revisa estos reportes al final de cada semana para cuadrar tu caja y planificar las compras con tus proveedores.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
