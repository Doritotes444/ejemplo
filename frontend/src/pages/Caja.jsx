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
  X,
  CreditCard,
  Banknote,
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
        authService.fetchAuth(`${BASE}/caja/sesiones?limit=15`),
      ])
      if (resEst.ok) {
        const est = await resEst.json()
        setEstadoCaja(est)
      }
      if (resHist.ok) {
        const hist = await resHist.json()
        setHistorial(hist)
      }
    } catch {
      // Ignorar offline
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
    const clientOpId = generarClientOperationId('caja_open')
    const payload = {
      monto_inicial: Number(montoInicial) || 0,
      notas_apertura: notasApertura || null,
      client_operation_id: clientOpId,
    }

    try {
      if (!navigator.onLine) {
        await encolarOperacionOffline('apertura_caja', payload, usuario?.empresa_id)
        setEstadoCaja({
          caja_abierta: true,
          sesion: {
            id: clientOpId,
            monto_inicial: payload.monto_inicial,
            total_ventas_efectivo: 0,
            total_ventas_digital: 0,
            total_ingresos_extra: 0,
            total_egresos: 0,
            saldo_esperado_efectivo: payload.monto_inicial,
            fecha_apertura: new Date().toISOString(),
          },
          movimientos: [],
        })
        setMensaje({
          tipo: 'ok',
          texto: 'Caja abierta en modo offline. Se sincronizará al volver la conexión.',
        })
      } else {
        const res = await authService.fetchAuth(`${BASE}/caja/apertura`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al abrir caja')
        }
        await cargarDatos()
        setMensaje({ tipo: 'ok', texto: 'Turno de caja abierto correctamente.' })
      }
      setMontoInicial('')
      setNotasApertura('')
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setAbriendo(false)
    }
  }

  const registrarMovimiento = async (e) => {
    e.preventDefault()
    if (!estadoCaja?.sesion?.id) {
      setMensaje({ tipo: 'error', texto: 'Debes abrir caja antes de registrar movimientos.' })
      return
    }
    setGuardandoMov(true)
    setMensaje(null)
    const clientOpId = generarClientOperationId('caja_mov')
    const payload = {
      tipo: tipoMov,
      categoria: categoriaMov,
      concepto: conceptoMov.trim(),
      monto: Number(montoMov) || 0,
      metodo_pago: metodoMov,
      client_operation_id: clientOpId,
    }

    try {
      if (!navigator.onLine) {
        await encolarOperacionOffline('movimiento_caja', payload, usuario?.empresa_id)
        setMensaje({
          tipo: 'ok',
          texto: 'Movimiento de caja respaldado localmente (Offline).',
        })
      } else {
        const res = await authService.fetchAuth(`${BASE}/caja/movimiento`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al registrar movimiento')
        }
        await cargarDatos()
        setMensaje({
          tipo: 'ok',
          texto: `${tipoMov === 'EGRESO' ? 'Salida' : 'Entrada'} registrada correctamente.`,
        })
      }
      setConceptoMov('')
      setMontoMov('')
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setGuardandoMov(false)
    }
  }

  const cerrarCaja = async (e) => {
    e.preventDefault()
    setCerrando(true)
    setMensaje(null)
    const payload = {
      monto_fisico_contado: Number(montoFisico) || 0,
      notas_cierre: notasCierre || null,
      client_operation_id: generarClientOperationId('caja_close'),
    }

    try {
      const res = await authService.fetchAuth(`${BASE}/caja/cierre`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al cerrar caja')
      }
      const data = await res.json()
      setModalCierre(false)
      setMontoFisico('')
      setNotasCierre('')
      await cargarDatos()
      setMensaje({
        tipo: 'ok',
        texto: `Caja cerrada. Arqueo: ${data.estado_arqueo} (Diferencia: $${fmt(data.diferencia)})`,
      })
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setCerrando(false)
    }
  }

  const abierta = Boolean(estadoCaja?.caja_abierta && estadoCaja?.sesion)
  const sesion = estadoCaja?.sesion
  const saldoEsperado = sesion?.saldo_esperado_efectivo ?? 0
  const diferenciaPrevia = montoFisico !== '' ? Number(montoFisico) - saldoEsperado : 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet size={24} className="text-slate-900 dark:text-slate-100" />
            Caja y control de turno
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Efectivo en cajón, pagos digitales, ingresos, gastos y arqueo de turno
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cargarDatos}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors"
            title="Actualizar estado de caja"
          >
            <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
          </button>
          {abierta && (
            <button
              type="button"
              onClick={() => {
                setMontoFisico(String(Math.round(saldoEsperado)))
                setModalCierre(true)
              }}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 min-h-[44px] transition-colors"
            >
              <Lock size={15} /> Cerrar turno y arquear
            </button>
          )}
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium border flex items-start gap-2 ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
          }`}
        >
          {mensaje.tipo === 'ok' ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      {/* Si no hay sesión abierta -> Tarjeta de Apertura */}
      {!abierta ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center">
              <Unlock size={22} />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                Abrir turno de caja
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ingresa la base inicial en efectivo con la que arrancas
              </p>
            </div>
          </div>

          <form onSubmit={abrirCaja} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Base inicial en efectivo ($)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                placeholder="50000"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas de apertura (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Turno mañana - Base lista para cambio"
                value={notasApertura}
                onChange={(e) => setNotasApertura(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={abriendo}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 text-white font-semibold py-3.5 rounded-xl text-sm min-h-[48px] transition-colors"
            >
              {abriendo ? 'Abriendo caja...' : 'Abrir caja ahora'}
            </button>
          </form>
        </div>
      ) : (
        <>
          {/* Resumen de Caja Activa */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-4 shadow-xs col-span-2 lg:col-span-1 border border-slate-800 dark:border-slate-700">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Efectivo esperado en cajón
              </span>
              <p className="text-2xl sm:text-3xl font-bold mt-1">
                ${fmt(saldoEsperado)}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Base: ${fmt(sesion.monto_inicial)} + Ventas − Egresos
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Ventas en efectivo
              </span>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                +${fmt(sesion.total_ventas_efectivo)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Extras: +${fmt(sesion.total_ingresos_extra)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Pagos digitales
              </span>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                ${fmt(sesion.total_ventas_digital)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Fiado hoy: ${fmt(sesion.total_ventas_fiado)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Gastos y salidas
              </span>
              <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                −${fmt(sesion.total_egresos)}
              </p>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
                Descontados del efectivo
              </span>
            </div>
          </div>

          {/* Registro de Movimiento + Movimientos del Turno */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                Registrar entrada o salida
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMov('EGRESO')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all min-h-[42px] ${
                    tipoMov === 'EGRESO'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <ArrowDownCircle size={15} /> Gasto / Salida
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMov('INGRESO')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all min-h-[42px] ${
                    tipoMov === 'INGRESO'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <ArrowUpCircle size={15} /> Entrada extra
                </button>
              </div>

              <form onSubmit={registrarMovimiento} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoría
                  </label>
                  <select
                    value={categoriaMov}
                    onChange={(e) => setCategoriaMov(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {CATEGORIAS_MOVIMIENTO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Descripción / Concepto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago camión leche / Bolsas"
                    value={conceptoMov}
                    onChange={(e) => setConceptoMov(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Medio
                    </label>
                    <select
                      value={metodoMov}
                      onChange={(e) => setMetodoMov(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
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
                  className="w-full font-semibold py-3 rounded-xl text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white min-h-[44px] transition-colors disabled:opacity-50"
                >
                  {guardandoMov
                    ? 'Guardando...'
                    : `Guardar ${tipoMov === 'EGRESO' ? 'gasto / salida' : 'entrada'}`}
                </button>
              </form>
            </div>

            {/* Historial del turno */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
              <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                Movimientos del turno ({estadoCaja?.movimientos?.length || 0})
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {!estadoCaja?.movimientos?.length ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">
                    Aún no hay ingresos ni gastos en esta sesión.
                  </p>
                ) : (
                  estadoCaja.movimientos.map((m) => {
                    const esSalida = m.tipo === 'EGRESO'
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs sm:text-sm"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                esSalida
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              {m.tipo}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {m.concepto}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {m.categoria} · {m.metodo_pago}
                          </p>
                        </div>
                        <span
                          className={`font-bold shrink-0 ${
                            esSalida
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
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

      {/* Historial de Turnos y Arqueos Anteriores */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-500 dark:text-slate-400" />
          <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
            Historial de turnos y arqueos
          </h2>
        </div>

        {historial.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 py-4">Sin turnos registrados todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {historial.slice(0, 8).map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between gap-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(h.fecha_apertura).toLocaleString('es-CO')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${
                      h.estado === 'ABIERTA'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {h.estado}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Esperado</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      ${fmt(h.saldo_esperado_efectivo)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Contado</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {h.monto_fisico_contado != null
                        ? `$${fmt(h.monto_fisico_contado)}`
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block">Diferencia</span>
                    <strong
                      className={
                        Number(h.diferencia) < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : Number(h.diferencia) > 0
                          ? 'text-amber-500 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-none z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Arqueo y cierre de caja
            </h3>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Base de apertura:</span>
                <strong className="text-slate-900 dark:text-slate-100">${fmt(sesion.monto_inicial)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ventas en efectivo (+):</span>
                <strong className="text-emerald-600 dark:text-emerald-400">
                  +${fmt(sesion.total_ventas_efectivo)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ingresos extra (+):</span>
                <strong className="text-emerald-600 dark:text-emerald-400">
                  +${fmt(sesion.total_ingresos_extra)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Salidas / Gastos (−):</span>
                <strong className="text-rose-600 dark:text-rose-400">−${fmt(sesion.total_egresos)}</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Saldo esperado en cajón:</span>
                <strong className="text-slate-900 dark:text-slate-100">${fmt(saldoEsperado)}</strong>
              </div>
            </div>

            <form onSubmit={cerrarCaja} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Efectivo físico contado en cajón ($)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={montoFisico}
                  onChange={(e) => setMontoFisico(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 text-base font-bold focus:outline-none"
                />
              </div>

              {montoFisico !== '' && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
                    diferenciaPrevia === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                      : diferenciaPrevia > 0
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {diferenciaPrevia === 0 ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <AlertTriangle size={15} />
                    )}
                    {diferenciaPrevia === 0
                      ? 'Cuadre exacto'
                      : diferenciaPrevia > 0
                      ? 'Sobrante en caja'
                      : 'Faltante en caja'}
                  </span>
                  <span>Diferencia: ${fmt(diferenciaPrevia)}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones de cierre
                </label>
                <textarea
                  rows={2}
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Ej: Base lista para mañana..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl p-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalCierre(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cerrando}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
