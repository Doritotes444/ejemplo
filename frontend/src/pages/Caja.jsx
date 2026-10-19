import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import { encolarOperacionOffline, generarClientOperationId } from '../services/offlineDB'
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  History,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const CATEGORIAS_MOVIMIENTO = [
  'Pago proveedor',
  'Servicios públicos',
  'Transporte / Domicilio',
  'Gasto menor tienda',
  'Aporte de cambio / base',
  'Retiro propietario',
  'Otro',
]

export default function Caja() {
  const { usuario } = useAuth()
  const [estadoCaja, setEstadoCaja] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  // Formulario apertura
  const [montoInicial, setMontoInicial] = useState('')
  const [notasApertura, setNotasApertura] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  // Formulario movimiento ingreso/egreso
  const [tipoMov, setTipoMov] = useState('EGRESO')
  const [categoriaMov, setCategoriaMov] = useState('Pago proveedor')
  const [conceptoMov, setConceptoMov] = useState('')
  const [montoMov, setMontoMov] = useState('')
  const [metodoMov, setMetodoMov] = useState('Efectivo')
  const [guardandoMov, setGuardandoMov] = useState(false)

  // Modal cierre / arqueo
  const [modalCierre, setModalCierre] = useState(false)
  const [montoFisico, setMontoFisico] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    try {
      const [resEst, resHist] = await Promise.all([
        authService.fetchAuth(`${BASE}/caja/estado`),
        authService.fetchAuth(`${BASE}/caja/historial`),
      ])
      if (resEst.ok) {
        setEstadoCaja(await resEst.json())
      }
      if (resHist.ok) {
        setHistorial(await resHist.json())
      }
    } catch {
      // Silencioso en modo offline
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  const abrirCaja = async (e) => {
    e.preventDefault()
    setAbriendo(true)
    setMensaje(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/caja/abrir`, {
        method: 'POST',
        body: JSON.stringify({
          monto_inicial: Number(montoInicial) || 0,
          notas_apertura: notasApertura || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al abrir la caja')
      }
      setMontoInicial('')
      setNotasApertura('')
      setMensaje({ tipo: 'ok', texto: '✅ Caja abierta correctamente.' })
      await cargarDatos()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setAbriendo(false)
    }
  }

  const registrarMovimiento = async (e) => {
    e.preventDefault()
    if (!montoMov || Number(montoMov) <= 0 || !conceptoMov.trim()) return
    setGuardandoMov(true)
    setMensaje(null)
    const clientOpId = generarClientOperationId('caja')
    const payload = {
      tipo: tipoMov,
      categoria: categoriaMov,
      concepto: conceptoMov.trim(),
      monto: Number(montoMov),
      metodo_pago: metodoMov,
      client_operation_id: clientOpId,
    }

    try {
      if (!navigator.onLine) {
        await encolarOperacionOffline('movimiento_caja', payload, usuario?.empresa_id)
        setConceptoMov('')
        setMontoMov('')
        setMensaje({
          tipo: 'ok',
          texto: '📴 Movimiento guardado sin conexión. Se sincronizará automáticamente.',
        })
        return
      }

      const res = await authService.fetchAuth(`${BASE}/caja/movimiento`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al registrar movimiento')
      }
      setConceptoMov('')
      setMontoMov('')
      setMensaje({
        tipo: 'ok',
        texto: `✅ ${tipoMov === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado en caja.`,
      })
      await cargarDatos()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setGuardandoMov(false)
    }
  }

  const cerrarCaja = async (e) => {
    e.preventDefault()
    if (montoFisico === '') return
    setCerrando(true)
    setMensaje(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/caja/cerrar`, {
        method: 'POST',
        body: JSON.stringify({
          monto_fisico_contado: Number(montoFisico),
          notas_cierre: notasCierre || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al cerrar la caja')
      }
      const data = await res.json()
      setModalCierre(false)
      setMontoFisico('')
      setNotasCierre('')
      setMensaje({
        tipo: 'ok',
        texto: `✅ Cierre completado (${data.estado_arqueo}). Diferencia: $${fmt(data.diferencia)}`,
      })
      await cargarDatos()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCerrando(false)
    }
  }

  const sesion = estadoCaja?.sesion
  const abierta = Boolean(estadoCaja?.abierta && sesion)
  const saldoEsperado = Number(sesion?.saldo_esperado_efectivo || 0)
  const diferenciaPrevia =
    montoFisico !== '' ? Number(montoFisico) - saldoEsperado : 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="text-violet-600" size={24} />
            Caja, Ingresos, Egresos y Arqueo
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Controla el efectivo en cajón, pagos digitales, gastos del día y cierre de turno
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cargarDatos}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            title="Actualizar estado de caja"
          >
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>
          {abierta && (
            <button
              type="button"
              onClick={() => {
                setMontoFisico(String(Math.round(saldoEsperado)))
                setModalCierre(true)
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 min-h-[44px]"
            >
              <Lock size={16} /> Realizar Arqueo y Cerrar Caja
            </button>
          )}
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

      {/* Si no hay sesión abierta -> Tarjeta de Apertura */}
      {!abierta ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Unlock size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-900">Abrir Turno de Caja</h2>
              <p className="text-xs text-slate-500">
                Ingresa la base de efectivo inicial con la que arrancas el día
              </p>
            </div>
          </div>

          <form onSubmit={abrirCaja} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Base Inicial en Efectivo ($)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                placeholder="Ej: 50000"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Notas de apertura (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Turno mañana - Billetes sencillos para vueltas"
                value={notasApertura}
                onChange={(e) => setNotasApertura(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={abriendo}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white font-bold py-3.5 rounded-xl text-sm min-h-[48px]"
            >
              {abriendo ? 'Abriendo caja...' : 'Abrir Caja Ahora'}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Resumen de Caja Activa */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-violet-600 text-white rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-violet-200 block">
                Efectivo Esperado en Cajón
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1">
                ${fmt(saldoEsperado)}
              </p>
              <span className="text-[11px] text-violet-200 mt-1 block">
                Base: ${fmt(sesion.monto_inicial)} + Ventas Efectivo − Egresos
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Ventas en Efectivo
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1">
                +${fmt(sesion.total_ventas_efectivo)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Ingresos extras: +${fmt(sesion.total_ingresos_extra)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Pagos Digitales (Nequi/DaviPlata/Transf)
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-violet-700 mt-1">
                ${fmt(sesion.total_ventas_digital)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Fiado hoy: ${fmt(sesion.total_ventas_fiado)}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Salidas / Gastos / Proveedores
              </span>
              <p className="text-xl sm:text-2xl font-extrabold text-red-600 mt-1">
                −${fmt(sesion.total_egresos)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Descontados del efectivo
              </span>
            </div>
          </div>

          {/* Registro de Ingresos y Egresos + Lista de Movimientos del Turno */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-base text-slate-900">
                Registrar Entrada o Salida de Dinero
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMov('EGRESO')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all min-h-[44px] ${
                    tipoMov === 'EGRESO'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ArrowDownCircle size={16} /> Salida / Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov('INGRESO')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all min-h-[44px] ${
                    tipoMov === 'INGRESO'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ArrowUpCircle size={16} /> Entrada Extra
                </button>
              </div>

              <form onSubmit={registrarMovimiento} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Categoría
                  </label>
                  <select
                    value={categoriaMov}
                    onChange={(e) => setCategoriaMov(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                  >
                    {CATEGORIAS_MOVIMIENTO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Concepto / Descripción
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago camión de leche Alpina / Bolsas plásticas"
                    value={conceptoMov}
                    onChange={(e) => setConceptoMov(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Monto ($)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      placeholder="15000"
                      value={montoMov}
                      onChange={(e) => setMontoMov(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Medio
                    </label>
                    <select
                      value={metodoMov}
                      onChange={(e) => setMetodoMov(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Nequi">Nequi</option>
                      <option value="DaviPlata">DaviPlata</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={guardandoMov}
                  className={`w-full font-bold py-3 rounded-xl text-sm text-white min-h-[46px] transition-colors ${
                    tipoMov === 'EGRESO'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {guardandoMov
                    ? 'Guardando...'
                    : `Guardar ${tipoMov === 'EGRESO' ? 'Salida / Gasto' : 'Entrada'}`}
                </button>
              </form>
            </div>

            {/* Historial de movimientos de la sesión activa */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-base text-slate-900">
                Movimientos del Turno Actual ({estadoCaja?.movimientos?.length || 0})
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {!estadoCaja?.movimientos?.length ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    Aún no hay movimientos registrados en esta sesión.
                  </p>
                ) : (
                  estadoCaja.movimientos.map((m) => {
                    const esSalida = m.tipo === 'EGRESO'
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs sm:text-sm"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                esSalida
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {m.tipo}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {m.concepto}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {m.categoria} · {m.metodo_pago}
                          </p>
                        </div>
                        <span
                          className={`font-extrabold shrink-0 ${
                            esSalida ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {esSalida ? '−' : '+'}${fmt(m.monto)}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Historial de Arqueos y Cierres Anteriores */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <History size={18} className="text-violet-600" />
          <h2 className="font-bold text-base text-slate-900">
            Historial de Turnos y Arqueos de Caja
          </h2>
        </div>

        {historial.length === 0 ? (
          <p className="text-xs text-slate-400 py-4">Sin sesiones registradas todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {historial.slice(0, 8).map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    {new Date(h.fecha_apertura).toLocaleString('es-CO')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      h.estado === 'ABIERTA'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {h.estado}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Esperado</span>
                    <strong className="text-slate-800">
                      ${fmt(h.saldo_esperado_efectivo)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Contado físico</span>
                    <strong className="text-slate-800">
                      {h.monto_fisico_contado != null
                        ? `$${fmt(h.monto_fisico_contado)}`
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Diferencia</span>
                    <strong
                      className={
                        Number(h.diferencia) < 0
                          ? 'text-red-600'
                          : Number(h.diferencia) > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }
                    >
                      {h.diferencia != null ? `$${fmt(h.diferencia)}` : '—'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Cierre y Arqueo de Caja */}
      {modalCierre && sesion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Arqueo y Cierre de Caja
            </h3>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Base de apertura:</span>
                <strong>${fmt(sesion.monto_inicial)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ventas en efectivo (+):</span>
                <strong className="text-emerald-600">
                  +${fmt(sesion.total_ventas_efectivo)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ingresos extra (+):</span>
                <strong className="text-emerald-600">
                  +${fmt(sesion.total_ingresos_extra)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Salidas / Gastos (−):</span>
                <strong className="text-red-600">−${fmt(sesion.total_egresos)}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Saldo esperado en cajón:</span>
                <strong className="text-violet-700">${fmt(saldoEsperado)}</strong>
              </div>
            </div>

            <form onSubmit={cerrarCaja} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Efectivo físico contado en cajón ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={montoFisico}
                  onChange={(e) => setMontoFisico(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-base font-bold"
                />
              </div>

              {montoFisico !== '' && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                    diferenciaPrevia === 0
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : diferenciaPrevia > 0
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {diferenciaPrevia === 0 ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertTriangle size={16} />
                    )}
                    {diferenciaPrevia === 0
                      ? 'Cuadre Exacto'
                      : diferenciaPrevia > 0
                      ? 'Sobrante en caja'
                      : 'Faltante en caja'}
                  </span>
                  <span>Diferencia: ${fmt(diferenciaPrevia)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Observaciones de cierre
                </label>
                <textarea
                  rows={2}
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Ej: Se dejó base lista en monedas para mañana..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCierre(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cerrando}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                >
                  {cerrando ? 'Cerrando...' : 'Confirmar Cierre de Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
