import { useState, useEffect, useCallback } from 'react'
import { useProductos } from '../hooks/useProductos'
import authService from '../services/authService'
import { Calculator, TrendingUp, Scale, PlusCircle, BookOpen } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

export default function Simulador() {
  const { productos } = useProductos()
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('')

  // Variables del escenario simulado
  const [precioCompra, setPrecioCompra] = useState(2500)
  const [precioVenta, setPrecioVenta] = useState(3800)
  const [volumenUnidades, setVolumenUnidades] = useState(120)
  const [gastosFijos, setGastosFijos] = useState(80000)
  const [gastoVariableUnitario, setGastoVariableUnitario] = useState(100)
  const [descuentoPct, setDescuentoPct] = useState(0)

  // Variables base para comparación
  const [precioVentaBase, setPrecioVentaBase] = useState(3500)
  const [costoCompraBase, setCostoCompraBase] = useState(2500)
  const [volumenBase, setVolumenBase] = useState(100)

  const [resultado, setResultado] = useState(null)
  const [escenariosGuardados, setEscenariosGuardados] = useState([])

  // Seleccionar producto del catálogo para precargar datos reales
  const handleSelectProducto = (id) => {
    setProductoSeleccionadoId(id)
    const p = productos.find((item) => item.id === id)
    if (p) {
      const costo = Number(p.precio_costo || p.costo_unitario || p.precio_venta * 0.7 || 1000)
      const venta = Number(p.precio_venta || 1500)
      setPrecioCompra(costo)
      setPrecioVenta(venta)
      setCostoCompraBase(costo)
      setPrecioVentaBase(venta)
    }
  }

  const ejecutarSimulacion = useCallback(async () => {
    const payload = {
      precio_venta: Number(precioVenta) || 0,
      precio_compra: Number(precioCompra) || 0,
      volumen_unidades: Number(volumenUnidades) || 0,
      gastos_fijos: Number(gastosFijos) || 0,
      gasto_variable_unitario: Number(gastoVariableUnitario) || 0,
      descuento_porcentaje: Number(descuentoPct) || 0,
      precio_venta_base: Number(precioVentaBase) || 0,
      costo_compra_base: Number(costoCompraBase) || 0,
      volumen_base: Number(volumenBase) || 0,
    }

    try {
      const res = await authService.fetchAuth(`${BASE}/reportes/simulador`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setResultado(await res.json())
        return
      }
    } catch {
      // Cálculo local si está offline
    }

    // Cálculo local de respaldo (Offline-first)
    const pFinal = payload.precio_venta * (1 - payload.descuento_porcentaje / 100)
    const cTotalUnit = payload.precio_compra + payload.gasto_variable_unitario
    const margenUnit = pFinal - cTotalUnit
    const margenPct = pFinal > 0 ? (margenUnit / pFinal) * 100 : 0
    const ingresos = pFinal * payload.volumen_unidades
    const utilidadBruta = margenUnit * payload.volumen_unidades
    const utilidadNeta = utilidadBruta - payload.gastos_fijos
    const peUnidades = margenUnit > 0 ? Math.ceil(payload.gastos_fijos / margenUnit) : null
    const pePesos = peUnidades !== null ? peUnidades * pFinal : null

    const margenBaseUnit = payload.precio_venta_base - payload.costo_compra_base
    const utilidadNetaBase = margenBaseUnit * payload.volumen_base - payload.gastos_fijos
    const difUtilidad = utilidadNeta - utilidadNetaBase

    setResultado({
      escenario_simulado: {
        precio_venta_efectivo: pFinal,
        margen_unitario: margenUnit,
        margen_porcentual: Number(margenPct.toFixed(1)),
        ingresos_estimados: ingresos,
        utilidad_bruta_estimada: utilidadBruta,
        utilidad_neta_estimada: utilidadNeta,
        punto_equilibrio_unidades: peUnidades,
        punto_equilibrio_pesos: pePesos,
      },
      comparacion_escenario_base: {
        utilidad_neta_base: utilidadNetaBase,
        diferencia_utilidad_neta: difUtilidad,
        recomendacion:
          difUtilidad >= 0
            ? 'El escenario proyecta mayor ganancia neta que el punto de partida.'
            : 'Atención: esta combinación reduce tu utilidad neta en comparación con la base actual.',
      },
    })
  }, [
    precioCompra,
    precioVenta,
    volumenUnidades,
    gastosFijos,
    gastoVariableUnitario,
    descuentoPct,
    precioVentaBase,
    costoCompraBase,
    volumenBase,
  ])

  useEffect(() => {
    ejecutarSimulacion()
  }, [ejecutarSimulacion])

  const guardarEscenarioComparativo = () => {
    if (!resultado?.escenario_simulado) return
    const prod = productos.find((p) => p.id === productoSeleccionadoId)
    setEscenariosGuardados((prev) => [
      {
        id: Date.now(),
        nombre: prod ? prod.nombre : `Escenario #${prev.length + 1}`,
        precioVenta,
        descuentoPct,
        volumenUnidades,
        ...resultado.escenario_simulado,
      },
      ...prev.slice(0, 3),
    ])
  }

  const sim = resultado?.escenario_simulado
  const comp = resultado?.comparacion_escenario_base

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calculator size={24} className="text-slate-900 dark:text-slate-100" />
            Simulador de precios y márgenes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Evalúa el impacto de descuentos, costos y punto de equilibrio antes de cambiar precios
          </p>
        </div>

        <button
          type="button"
          onClick={guardarEscenarioComparativo}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 min-h-[44px] self-start transition-colors"
        >
          <PlusCircle size={15} /> Guardar escenario
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Panel de Controles */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
            Variables de proyección
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cargar producto de tu catálogo (opcional)
            </label>
            <select
              value={productoSeleccionadoId}
              onChange={(e) => handleSelectProducto(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option value="">— Simulación libre / personalizada —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (Venta: ${fmt(p.precio_venta)} | Costo: ${fmt(p.precio_costo)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Costo de compra ($)
              </label>
              <input
                type="number"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Precio de venta propuesto ($)
              </label>
              <input
                type="number"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Volumen estimado (uds)
              </label>
              <input
                type="number"
                min="1"
                value={volumenUnidades}
                onChange={(e) => setVolumenUnidades(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Descuento / Promo (%)
              </label>
              <input
                type="number"
                min="0"
                max="95"
                value={descuentoPct}
                onChange={(e) => setDescuentoPct(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gastos fijos asignados ($)
              </label>
              <input
                type="number"
                min="0"
                value={gastosFijos}
                onChange={(e) => setGastosFijos(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gasto variable unitario ($)
              </label>
              <input
                type="number"
                min="0"
                value={gastoVariableUnitario}
                onChange={(e) => setGastoVariableUnitario(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Escenario base actual (para contraste)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Precio actual</span>
                <input
                  type="number"
                  value={precioVentaBase}
                  onChange={(e) => setPrecioVentaBase(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Costo actual</span>
                <input
                  type="number"
                  value={costoCompraBase}
                  onChange={(e) => setCostoCompraBase(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Volumen actual</span>
                <input
                  type="number"
                  value={volumenBase}
                  onChange={(e) => setVolumenBase(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg px-2 py-1 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Resultados */}
        <div className="lg:col-span-7 space-y-4">
          {sim && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase block">
                    Margen unitario
                  </span>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      sim.margen_unitario > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    ${fmt(sim.margen_unitario)}
                  </p>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                    Precio final: ${fmt(sim.precio_venta_efectivo)}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase block">
                    Margen porcentual
                  </span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {sim.margen_porcentual}%
                  </p>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                    Sobre precio efectivo
                  </span>
                </div>

                <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1 border border-slate-800 dark:border-slate-700">
                  <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                    Utilidad neta estimada
                  </span>
                  <p className="text-2xl font-bold mt-1">
                    ${fmt(sim.utilidad_neta_estimada)}
                  </p>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Ingresos: ${fmt(sim.ingresos_estimados)}
                  </span>
                </div>
              </div>

              {/* Punto de Equilibrio y Comparación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                    <Scale size={16} />
                    <span>Punto de equilibrio</span>
                  </div>
                  {sim.punto_equilibrio_unidades !== null ? (
                    <>
                      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {fmt(sim.punto_equilibrio_unidades)} unidades
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Debes vender al menos{' '}
                        <strong className="text-slate-800 dark:text-slate-200">
                          ${fmt(sim.punto_equilibrio_pesos)}
                        </strong>{' '}
                        para cubrir los ${fmt(gastosFijos)} de gastos fijos.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Con este precio se genera pérdida unitaria. Imposible alcanzar punto de equilibrio.
                    </p>
                  )}
                </div>

                {comp && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-2">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
                      <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Comparación vs actual</span>
                    </div>
                    <p
                      className={`text-xl font-bold ${
                        comp.diferencia_utilidad_neta >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {comp.diferencia_utilidad_neta >= 0 ? '+' : ''}$
                      {fmt(comp.diferencia_utilidad_neta)} vs base (${fmt(comp.utilidad_neta_base)})
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{comp.recomendacion}</p>
                  </div>
                )}
              </div>

              {/* Escenarios guardados */}
              {escenariosGuardados.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    Escenarios guardados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {escenariosGuardados.map((e) => (
                      <div
                        key={e.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                      >
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{e.nombre}</p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Precio: ${fmt(e.precio_venta_efectivo)} ({e.descuentoPct}% dcto) · Vol: {e.volumenUnidades} uds
                        </p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          Margen: ${fmt(e.margen_unitario)} ({e.margen_porcentual}%) · Neta:{' '}
                          <span
                            className={
                              e.utilidad_neta_estimada >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            ${fmt(e.utilidad_neta_estimada)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fórmulas y supuestos */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <BookOpen size={14} />
                  <span>Fórmulas financieras aplicadas</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>
                    <strong>Precio efectivo:</strong> <code>P_efectivo = P_venta × (1 − Descuento / 100)</code>
                  </li>
                  <li>
                    <strong>Margen unitario:</strong> <code>M_u = P_efectivo − (Costo_compra + Gasto_variable)</code>
                  </li>
                  <li>
                    <strong>Margen porcentual:</strong> <code>M_% = (M_u / P_efectivo) × 100</code>
                  </li>
                  <li>
                    <strong>Utilidad neta:</strong> <code>U_neta = (M_u × Volumen) − Gastos_fijos</code>
                  </li>
                  <li>
                    <strong>Punto de equilibrio:</strong> <code>PE_u = ⌈Gastos_fijos / M_u⌉</code>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
