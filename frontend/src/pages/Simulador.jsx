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
      const costo = Number(p.costo_unitario || p.precio_venta * 0.7 || 1000)
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
      // Cálculo local idéntico si está sin conexión
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

    const margenBaseUnit =
      payload.precio_venta_base - payload.costo_compra_base - payload.gasto_variable_unitario
    const utilidadNetaBase =
      margenBaseUnit * payload.volumen_base - payload.gastos_fijos

    setResultado({
      escenario_simulado: {
        precio_venta_efectivo: Math.round(pFinal),
        costo_total_unitario: Math.round(cTotalUnit),
        margen_unitario: Math.round(margenUnit),
        margen_porcentual: Number(margenPct.toFixed(2)),
        ingresos_estimados: Math.round(ingresos),
        utilidad_bruta_estimada: Math.round(utilidadBruta),
        utilidad_neta_estimada: Math.round(utilidadNeta),
        punto_equilibrio_unidades: peUnidades,
        punto_equilibrio_pesos: pePesos ? Math.round(pePesos) : null,
        es_rentable: utilidadNeta > 0 && margenUnit > 0,
      },
      comparacion_escenario_base: {
        utilidad_neta_base: Math.round(utilidadNetaBase),
        diferencia_utilidad_neta: Math.round(utilidadNeta - utilidadNetaBase),
        recomendacion:
          utilidadNeta >= utilidadNetaBase
            ? 'El escenario simulado mejora la utilidad neta frente al escenario base.'
            : 'Atención: El escenario simulado reduce la utilidad frente al escenario actual.',
      },
      formulas_documentadas: {
        precio_efectivo: 'P_efectivo = P_venta * (1 - Descuento/100)',
        margen_unitario: 'M_u = P_efectivo - (Costo_compra + Gasto_variable_unitario)',
        margen_porcentual: 'M_% = (M_u / P_efectivo) * 100',
        utilidad_neta: 'U_neta = (M_u * Volumen) - Gastos_fijos',
        punto_equilibrio: 'PE_unidades = ceil(Gastos_fijos / M_u)',
      },
    })
  }, [
    precioVenta,
    precioCompra,
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-violet-600" size={24} />
            Simulador Comercial de Precios, Costos y Punto de Equilibrio
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Evalúa el impacto de descuentos, alzas de proveedor o metas de volumen antes de cambiar tus precios
          </p>
        </div>

        <button
          type="button"
          onClick={guardarEscenarioComparativo}
          className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 min-h-[44px] self-start"
        >
          <PlusCircle size={16} /> Guardar Escenario para Comparar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Panel de Controles Interactivos */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-base text-slate-900">
            Variables del Escenario
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Cargar producto del catálogo (opcional)
            </label>
            <select
              value={productoSeleccionadoId}
              onChange={(e) => handleSelectProducto(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50"
            >
              <option value="">— Simulación libre / Personalizada —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (Venta: ${fmt(p.precio_venta)} | Costo: ${fmt(p.costo_unitario)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Costo de Compra Unit. ($)
              </label>
              <input
                type="number"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio de Venta Propuesto ($)
              </label>
              <input
                type="number"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className="w-full border border-violet-300 bg-violet-50/30 rounded-xl px-3 py-2 text-sm font-bold text-violet-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Volumen Estimado (Unidades)
              </label>
              <input
                type="number"
                min="1"
                value={volumenUnidades}
                onChange={(e) => setVolumenUnidades(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Promoción / Descuento (%)
              </label>
              <input
                type="number"
                min="0"
                max="95"
                value={descuentoPct}
                onChange={(e) => setDescuentoPct(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gastos Fijos Asignados ($)
              </label>
              <input
                type="number"
                min="0"
                value={gastosFijos}
                onChange={(e) => setGastosFijos(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gasto Variable Unitario ($)
              </label>
              <input
                type="number"
                min="0"
                value={gastoVariableUnitario}
                onChange={(e) => setGastoVariableUnitario(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Escenario Base Actual (Para Comparación)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 block">Precio Actual</span>
                <input
                  type="number"
                  value={precioVentaBase}
                  onChange={(e) => setPrecioVentaBase(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Costo Actual</span>
                <input
                  type="number"
                  value={costoCompraBase}
                  onChange={(e) => setCostoCompraBase(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Volumen Actual</span>
                <input
                  type="number"
                  value={volumenBase}
                  onChange={(e) => setVolumenBase(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Resultados e Impacto */}
        <div className="lg:col-span-7 space-y-4">
          {sim && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-400 uppercase block">
                    Margen Unitario
                  </span>
                  <p
                    className={`text-2xl font-extrabold mt-1 ${
                      sim.margen_unitario > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    ${fmt(sim.margen_unitario)}
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Precio final: ${fmt(sim.precio_venta_efectivo)}
                  </span>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-400 uppercase block">
                    Margen Porcentual
                  </span>
                  <p className="text-2xl font-extrabold text-violet-700 mt-1">
                    {sim.margen_porcentual}%
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Sobre precio efectivo
                  </span>
                </div>

                <div
                  className={`rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1 border ${
                    sim.utilidad_neta_estimada >= 0
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-red-600 text-white border-red-600'
                  }`}
                >
                  <span className="text-[11px] font-bold uppercase opacity-80 block">
                    Utilidad Neta Estimada
                  </span>
                  <p className="text-2xl font-extrabold mt-1">
                    ${fmt(sim.utilidad_neta_estimada)}
                  </p>
                  <span className="text-xs opacity-90 mt-1 block">
                    Ingresos: ${fmt(sim.ingresos_estimados)}
                  </span>
                </div>
              </div>

              {/* Punto de Equilibrio y Comparación contra Escenario Base */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-violet-700 font-bold text-sm">
                    <Scale size={18} />
                    <span>Punto de Equilibrio</span>
                  </div>
                  {sim.punto_equilibrio_unidades !== null ? (
                    <>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {fmt(sim.punto_equilibrio_unidades)} unidades
                      </p>
                      <p className="text-xs text-slate-500">
                        Debes vender al menos{' '}
                        <strong>${fmt(sim.punto_equilibrio_pesos)}</strong> para cubrir los{' '}
                        <strong>${fmt(gastosFijos)}</strong> de gastos fijos.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-red-600">
                      ⚠️ Con este precio vendes a pérdida unitaria. No es posible alcanzar punto de equilibrio.
                    </p>
                  )}
                </div>

                {comp && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                      <TrendingUp size={18} className="text-emerald-600" />
                      <span>Comparación vs Escenario Actual</span>
                    </div>
                    <p
                      className={`text-xl font-extrabold ${
                        comp.diferencia_utilidad_neta >= 0
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {comp.diferencia_utilidad_neta >= 0 ? '+' : ''}$
                      {fmt(comp.diferencia_utilidad_neta)} vs base ($
                      {fmt(comp.utilidad_neta_base)})
                    </p>
                    <p className="text-xs text-slate-600">{comp.recomendacion}</p>
                  </div>
                )}
              </div>

              {/* Tabla comparativa de escenarios guardados */}
              {escenariosGuardados.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                  <h3 className="font-bold text-sm text-slate-900">
                    Comparación de Escenarios Guardados
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {escenariosGuardados.map((e) => (
                      <div
                        key={e.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                      >
                        <p className="font-bold text-slate-900">{e.nombre}</p>
                        <p className="text-slate-600">
                          Precio: ${fmt(e.precio_venta_efectivo)} ({e.descuentoPct}% dcto) · Vol:{' '}
                          {e.volumenUnidades} uds
                        </p>
                        <p className="font-bold text-violet-700">
                          Margen: ${fmt(e.margen_unitario)} ({e.margen_porcentual}%) · Utilidad Neta:{' '}
                          <span
                            className={
                              e.utilidad_neta_estimada >= 0
                                ? 'text-emerald-600'
                                : 'text-red-600'
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

              {/* Documentación de Fórmulas y Supuestos (Sección 12) */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <BookOpen size={15} className="text-violet-600" />
                  <span>Fórmulas Matemáticas y Supuestos del Simulador</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li>
                    <strong>Precio Efectivo:</strong>{' '}
                    <code>P_efectivo = P_venta × (1 − Descuento / 100)</code>
                  </li>
                  <li>
                    <strong>Margen Unitario de Contribución:</strong>{' '}
                    <code>M_u = P_efectivo − (Costo_compra + Gasto_variable_unitario)</code>
                  </li>
                  <li>
                    <strong>Margen Porcentual Bruto:</strong>{' '}
                    <code>M_% = (M_u / P_efectivo) × 100</code>
                  </li>
                  <li>
                    <strong>Utilidad Neta Estimada:</strong>{' '}
                    <code>U_neta = (M_u × Volumen_unidades) − Gastos_fijos</code>
                  </li>
                  <li>
                    <strong>Punto de Equilibrio (Unidades):</strong>{' '}
                    <code>PE_u = ⌈Gastos_fijos / M_u⌉</code> (asumiendo costos fijos constantes en el período).
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
