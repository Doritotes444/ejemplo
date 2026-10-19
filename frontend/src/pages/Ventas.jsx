import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useProductos, resolverUrlFotoProducto } from '../hooks/useProductos'
import { useVentas } from '../hooks/useVentas'
import authService from '../services/authService'
import usuarioService from '../services/usuarioService'
import { isAdmin, canExportReports } from '../utils/permissions'
import EscanerModal from '../components/EscanerModal'
import ModalProducto from '../components/ModalProducto'
import {
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  ScanBarcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Ban,
  Star,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  BookOpen,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'

const TABS_HISTORICO = [
  { id: 'hoy', label: 'Hoy', labelCorto: 'Hoy' },
  { id: 'semana', label: 'Esta Semana', labelCorto: 'Semana' },
  { id: 'historico', label: 'Histórico y Reportes', labelCorto: 'Histórico' },
]

const METODOS_PAGO = [
  { id: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'Nequi', label: 'Nequi', icon: Smartphone },
  { id: 'DaviPlata', label: 'DaviPlata', icon: Smartphone },
  { id: 'Transferencia', label: 'Transf.', icon: Building2 },
  { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'Fiado', label: 'Fiado', icon: BookOpen },
]

const BILLETES_RAPIDOS = [2000, 5000, 10000, 20000, 50000, 100000]

function getHoyColombia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function sumarDias(fechaStr, dias) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().split('T')[0]
}

function formatearFechaCabecera(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const esHoy = fechaStr === getHoyColombia()
  const texto = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fecha)
  return esHoy ? `Hoy · ${texto}` : texto
}

function formatearHoraBogota(isoString) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoString))
  } catch {
    return ''
  }
}

const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

function ExcelExport({ empresaId }) {
  const [descargando, setDescargando] = useState(false)
  const [estado, setEstado] = useState(null)

  const descargar = async () => {
    setDescargando(true)
    setEstado(null)
    try {
      const token = authService.getToken()
      const res = await fetch(`${BASE}/reportes/ventas/excel/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error generando el reporte')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ventas_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setEstado('ok')
      setTimeout(() => setEstado(null), 4000)
    } catch {
      setEstado('error')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mt-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Exportar a Excel</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Descarga el historial completo de ventas (.xlsx)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {estado === 'ok' && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={16} /> Descargado
            </span>
          )}
          {estado === 'error' && (
            <span className="text-sm text-red-600 font-medium flex items-center gap-1">
              <AlertCircle size={16} /> Error al generar
            </span>
          )}
          <button
            onClick={descargar}
            disabled={descargando}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2"
          >
            {descargando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando...
              </>
            ) : (
              '⬇ Exportar Excel'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function VentaTimelineItem({ venta, onAnularClick }) {
  const [expandido, setExpandido] = useState(false)
  const hora = formatearHoraBogota(venta.fecha_venta)
  const vendedor = venta.vendedor_nombre_snapshot || 'Vendedor'
  const codigo = venta.id ? `#${String(venta.id).split('-')[0]}` : ''
  const esAnulada = venta.estado === 'ANULADA'

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
        esAnulada ? 'border-red-200 bg-red-50/20 opacity-80' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div
        onClick={() => setExpandido(!expandido)}
        className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              esAnulada ? 'bg-red-100 text-red-600' : 'bg-violet-50 text-violet-700'
            }`}
          >
            {esAnulada ? <Ban size={18} /> : <Clock size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-sm">{hora}</span>
              <span className="text-xs font-mono text-slate-400">{codigo}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 truncate max-w-[140px]">
                👤 {vendedor}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-violet-50 text-violet-700">
                {venta.metodo_pago || 'Efectivo'}
              </span>
              {esAnulada && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                  ANULADA
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {venta.detalles?.length || 0} {venta.detalles?.length === 1 ? 'producto' : 'productos'}
              {venta.cliente_nombre ? ` · Cliente: ${venta.cliente_nombre}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-bold text-base sm:text-lg ${
              esAnulada ? 'line-through text-red-500' : 'text-violet-700'
            }`}
          >
            ${fmt(venta.total)}
          </span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 transition-transform"
            aria-label={expandido ? 'Colapsar detalles' : 'Ver productos'}
          >
            {expandido ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Detalle de la Venta
            </h4>
            {!esAnulada && onAnularClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAnularClick(venta)
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Ban size={14} /> Anular venta (auditable)
              </button>
            )}
          </div>

          {esAnulada && venta.motivo_anulacion && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg">
              <strong>Motivo de anulación:</strong> {venta.motivo_anulacion}
            </div>
          )}

          <div className="space-y-2">
            {venta.detalles?.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between text-xs sm:text-sm text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100"
              >
                <div className="truncate mr-3">
                  <span className="font-medium text-slate-800">{d.producto_nombre || 'Producto'}</span>
                  <span className="text-slate-400 ml-2">
                    × {Number(d.cantidad).toLocaleString('es-CO', { maximumFractionDigits: 3 })}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-semibold text-slate-800">${fmt(d.subtotal)}</span>
                  {d.cantidad > 1 && (
                    <span className="block text-[10px] text-slate-400">
                      (${fmt(d.precio_unitario)} c/u)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Ventas() {
  const { usuario } = useAuth()
  const esAdmin = isAdmin(usuario)
  const {
    carrito,
    agregar,
    restar,
    setCantidad,
    eliminar,
    vaciar,
    total,
  } = useCart()
  const {
    productos,
    cargar: recargarProductos,
    crear: crearProducto,
    buscarPorCodigo,
  } = useProductos()
  const { registrar, anular } = useVentas()

  // Pestaña activa: 'pos' (Venta rápida < 3s) | 'actividad' | 'historico'
  const [modoVista, setModoVista] = useState('pos')

  // Estado Caja Rápida (< 3s POS)
  const [busquedaPos, setBusquedaPos] = useState('')
  const [soloFrecuentes, setSoloFrecuentes] = useState(false)
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [procesandoVenta, setProcesandoVenta] = useState(false)
  const [feedbackPos, setFeedbackPos] = useState(null)
  const [escanerAbierto, setEscanerAbierto] = useState(false)
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState(null)
  const [modalProvisionalAbierto, setModalProvisionalAbierto] = useState(false)
  const inputCodigoRef = useRef(null)

  // Modal de Anulación Auditable
  const [ventaAAnular, setVentaAAnular] = useState(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')
  const [anulando, setAnulando] = useState(false)

  // Estado para "Actividad del Día"
  const [fechaActividad, setFechaActividad] = useState(getHoyColombia)
  const [cajeroFiltro, setCajeroFiltro] = useState('')
  const [cajerosDisponibles, setCajerosDisponibles] = useState([])
  const [ventasActividad, setVentasActividad] = useState([])
  const [cargandoActividad, setCargandoActividad] = useState(false)
  const [errorActividad, setErrorActividad] = useState(null)

  // Estado para "Histórico"
  const [tabHistorico, setTabHistorico] = useState('hoy')
  const [ventasHistorico, setVentasHistorico] = useState([])
  const [cargandoHistorico, setCargandoHistorico] = useState(false)
  const [errorHistorico, setErrorHistorico] = useState(null)

  // Filtrado de productos para la cuadrícula rápida
  const productosMostrador = useMemo(() => {
    const q = busquedaPos.trim().toLowerCase()
    let lista = productos.filter((p) => p.is_active !== false)
    if (soloFrecuentes) {
      const frec = lista.filter((p) => p.es_frecuente)
      if (frec.length > 0) lista = frec
    }
    if (!q) {
      // Ordenar frecuentes primero
      return [...lista].sort((a, b) => Number(Boolean(b.es_frecuente)) - Number(Boolean(a.es_frecuente)))
    }
    return lista.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo_barras?.toLowerCase().includes(q) ||
        p.categoria?.toLowerCase().includes(q)
    )
  }, [productos, busquedaPos, soloFrecuentes])

  // Procesar lectura de código de barras (USB o cámara)
  const procesarCodigoEscaneado = useCallback(
    async (codigoRaw) => {
      const codigo = String(codigoRaw || '').trim()
      if (!codigo) return
      setCodigoNoEncontrado(null)
      const prod = await buscarPorCodigo(codigo)
      if (prod) {
        if (prod.cantidad_actual <= 0) {
          setFeedbackPos({
            tipo: 'error',
            texto: `⚠️ "${prod.nombre}" está agotado en inventario.`,
          })
          return
        }
        agregar(prod)
        setBusquedaPos('')
        setFeedbackPos({
          tipo: 'ok',
          texto: `⚡ Añadido: ${prod.nombre} ($${fmt(prod.precio_venta)})`,
        })
      } else {
        setCodigoNoEncontrado(codigo)
      }
    },
    [buscarPorCodigo, agregar]
  )

  const handleKeyDownScanner = (e) => {
    if (e.key === 'Enter' && busquedaPos.trim()) {
      e.preventDefault()
      // Si hay coincidencia exacta de código de barras o un único resultado, añadir inmediato
      const exacto = productos.find(
        (p) =>
          p.codigo_barras &&
          p.codigo_barras.trim().toLowerCase() === busquedaPos.trim().toLowerCase()
      )
      if (exacto) {
        procesarCodigoEscaneado(exacto.codigo_barras)
      } else if (productosMostrador.length === 1) {
        agregar(productosMostrador[0])
        setBusquedaPos('')
      } else {
        procesarCodigoEscaneado(busquedaPos.trim())
      }
    }
  }

  const cambio =
    metodoPago === 'Efectivo' && montoRecibido !== ''
      ? Math.max(0, Number(montoRecibido) - total)
      : 0

  const confirmarVentaRapida = async () => {
    if (!carrito.length || procesandoVenta) return
    setProcesandoVenta(true)
    setFeedbackPos(null)
    const t0 = performance.now()
    try {
      const detalles = carrito.map((i) => ({
        producto_id: i.id,
        cantidad: i.cantidad,
      }))
      const resultado = await registrar(detalles, {
        metodo_pago: metodoPago,
        monto_recibido:
          metodoPago === 'Efectivo' && montoRecibido !== '' ? Number(montoRecibido) : total,
        cliente_nombre: clienteNombre || null,
        total_estimado: total,
      })
      const duracionSeg = ((performance.now() - t0) / 1000).toFixed(2)
      setFeedbackPos({
        tipo: 'ok',
        texto: `${
          resultado.offline ? '📴 Venta guardada sin conexión' : '✅ Venta completada'
        } en ${duracionSeg}s · Total: $${fmt(resultado.total || total)}${
          cambio > 0 ? ` · Cambio: $${fmt(cambio)}` : ''
        }`,
      })
      vaciar()
      setMontoRecibido('')
      setClienteNombre('')
      recargarProductos().catch(() => {})
      window.dispatchEvent(new Event('venta-completada'))
      inputCodigoRef.current?.focus()
    } catch (err) {
      setFeedbackPos({
        tipo: 'error',
        texto: err.message || 'Error al procesar la venta',
      })
    } finally {
      setProcesandoVenta(false)
    }
  }

  // Atajos de teclado en el punto de venta (POS)
  useEffect(() => {
    if (modoVista !== 'pos') return
    const onKey = (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        if (carrito.length > 0 && !procesandoVenta) {
          confirmarVentaRapida()
        }
      } else if (e.key === 'Escape') {
        if (codigoNoEncontrado) {
          setCodigoNoEncontrado(null)
        } else if (escanerCamaraAbierto) {
          setEscanerCamaraAbierto(false)
        } else if (modalCrearAbierto) {
          setModalCrearAbierto(false)
        } else if (carrito.length > 0) {
          vaciar()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    modoVista,
    carrito.length,
    procesandoVenta,
    confirmarVentaRapida,
    codigoNoEncontrado,
    escanerCamaraAbierto,
    modalCrearAbierto,
    vaciar,
  ])

  const guardarProductoProvisionalYAnadir = async (form) => {
    const creado = await crearProducto({
      ...form,
      es_provisional: true,
    })
    if (creado) {
      agregar(creado)
      setCodigoNoEncontrado(null)
      setBusquedaPos('')
      setFeedbackPos({
        tipo: 'ok',
        texto: `✅ Producto "${creado.nombre}" creado y añadido al carrito.`,
      })
    }
  }

  // Cargar cajeros disponibles (solo Admin)
  useEffect(() => {
    if (esAdmin) {
      usuarioService
        .listarEmpleados()
        .then((data) => setCajerosDisponibles(data))
        .catch(() => {})
    }
  }, [esAdmin])

  const cargarActividad = useCallback(async () => {
    if (!esAdmin) return
    setCargandoActividad(true)
    setErrorActividad(null)

    try {
      const url = new URL(`${BASE}/ventas/actividad`, window.location.origin)
      if (fechaActividad) url.searchParams.set('fecha', fechaActividad)
      if (cajeroFiltro) url.searchParams.set('usuario_id', cajeroFiltro)

      const res = await authService.fetchAuth(url.toString())
      if (!res.ok) throw new Error('Error al cargar la actividad del día')
      const data = await res.json()
      setVentasActividad(data || [])
    } catch (err) {
      setErrorActividad(err.message || 'Error al conectar con el servidor')
    } finally {
      setCargandoActividad(false)
    }
  }, [esAdmin, fechaActividad, cajeroFiltro])

  useEffect(() => {
    if (modoVista === 'actividad') {
      cargarActividad()
    }
  }, [modoVista, cargarActividad])

  const cargarHistorico = useCallback(
    async (tabActual) => {
      if (!usuario?.empresa_id) return
      setCargandoHistorico(true)
      setErrorHistorico(null)

      try {
        const ahora = new Date()
        const fin = ahora.toISOString()
        const inicio = new Date(ahora)

        if (tabActual === 'hoy') {
          inicio.setHours(0, 0, 0, 0)
        } else if (tabActual === 'semana') {
          const dayOfWeek = inicio.getDay() || 7
          inicio.setDate(inicio.getDate() - (dayOfWeek - 1))
          inicio.setHours(0, 0, 0, 0)
        } else {
          inicio.setDate(inicio.getDate() - 30)
          inicio.setHours(0, 0, 0, 0)
        }

        const url = new URL(`${BASE}/ventas/${usuario.empresa_id}`, window.location.origin)
        url.searchParams.set('fecha_inicio', inicio.toISOString())
        url.searchParams.set('fecha_fin', fin)

        const res = await authService.fetchAuth(url.toString())
        if (!res.ok) throw new Error('Error cargando ventas')
        const data = await res.json()
        setVentasHistorico(data || [])
      } catch (e) {
        setErrorHistorico(e.message)
      } finally {
        setCargandoHistorico(false)
      }
    },
    [usuario]
  )

  useEffect(() => {
    if (modoVista === 'historico') {
      cargarHistorico(tabHistorico)
    }
  }, [modoVista, tabHistorico, cargarHistorico])

  const ejecutarAnulacion = async (e) => {
    e.preventDefault()
    if (!ventaAAnular || motivoAnulacion.trim().length < 3) return
    setAnulando(true)
    try {
      await anular(ventaAAnular.id, motivoAnulacion.trim())
      setVentaAAnular(null)
      setMotivoAnulacion('')
      if (modoVista === 'actividad') cargarActividad()
      if (modoVista === 'historico') cargarHistorico(tabHistorico)
      recargarProductos().catch(() => {})
    } catch (err) {
      alert(err.message)
    } finally {
      setAnulando(false)
    }
  }

  const esHoy = fechaActividad === getHoyColombia()
  const irDiaAnterior = () => setFechaActividad((prev) => sumarDias(prev, -1))
  const irDiaSiguiente = () => setFechaActividad((prev) => sumarDias(prev, 1))
  const irAHoy = () => setFechaActividad(getHoyColombia())

  const totalActividad = useMemo(
    () =>
      ventasActividad
        .filter((v) => v.estado !== 'ANULADA')
        .reduce((acc, v) => acc + (v.total || 0), 0),
    [ventasActividad]
  )

  const desgloseVendedores = useMemo(() => {
    const mapa = {}
    ventasActividad
      .filter((v) => v.estado !== 'ANULADA')
      .forEach((v) => {
        const nombre = v.vendedor_nombre_snapshot || 'Admin'
        if (!mapa[nombre]) {
          mapa[nombre] = { conteo: 0, total: 0 }
        }
        mapa[nombre].conteo += 1
        mapa[nombre].total += v.total || 0
      })
    return Object.entries(mapa).map(([nombre, stats]) => ({
      nombre,
      ...stats,
    }))
  }, [ventasActividad])

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Encabezado y Selector de Modo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Caja Rápida y Ventas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registra una venta en menos de 3 segundos con lector USB, cámara o toque rápido
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModoVista('pos')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all min-h-[40px] ${
              modoVista === 'pos'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap size={16} />
            Venta Rápida (&lt;3s)
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setModoVista('actividad')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[40px] ${
                modoVista === 'actividad'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Clock size={16} />
              Actividad Hoy
            </button>
          )}
          <button
            type="button"
            onClick={() => setModoVista('historico')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all min-h-[40px] ${
              modoVista === 'historico'
                ? 'bg-white text-violet-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Calendar size={16} />
            Histórico
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODO 0: CAJA RÁPIDA (< 3 SEGUNDOS POS)                   */}
      {/* ======================================================== */}
      {modoVista === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Columna izquierda: Escáner + Cuadrícula de Productos con Foto */}
          <div className="lg:col-span-7 space-y-4">
            {/* Barra de escaneo y búsqueda instantánea */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    ref={inputCodigoRef}
                    type="text"
                    value={busquedaPos}
                    onChange={(e) => {
                      setBusquedaPos(e.target.value)
                      setCodigoNoEncontrado(null)
                    }}
                    onKeyDown={handleKeyDownScanner}
                    placeholder="Escanea código de barras (USB) o escribe nombre y presiona Enter..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[46px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEscanerAbierto(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2 shrink-0 min-h-[46px]"
                >
                  <ScanBarcode size={18} />
                  <span>Cámara</span>
                </button>
              </div>

              {/* Filtros rápidos */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSoloFrecuentes(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      !soloFrecuentes
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos ({productos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSoloFrecuentes(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                      soloFrecuentes
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Star size={13} /> Frecuentes
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  Toca cualquier producto para sumar +1 al carrito
                </span>
              </div>

              {/* Alerta de código desconocido sin perder la venta actual */}
              {codigoNoEncontrado && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-amber-900">
                    <strong>Código &ldquo;{codigoNoEncontrado}&rdquo; no reconocido.</strong>{' '}
                    Puedes registrarlo ahora mismo sin perder el carrito actual.
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalProvisionalAbierto(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-lg"
                    >
                      + Crear y añadir al carrito
                    </button>
                    <button
                      type="button"
                      onClick={() => setCodigoNoEncontrado(null)}
                      className="text-xs text-slate-500 px-2 py-1"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cuadrícula de Acceso Rápido con Fotografía Obligatoria */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {productosMostrador.slice(0, 24).map((p) => {
                const agotado = p.cantidad_actual <= 0
                const enCarrito = carrito.find((c) => c.id === p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={agotado}
                    onClick={() => agregar(p)}
                    className={`group text-left bg-white dark:bg-slate-900 rounded-2xl border p-2.5 transition-all flex flex-col justify-between relative min-h-[148px] ${
                      agotado
                        ? 'opacity-50 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : enCarrito
                        ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900/10 dark:ring-slate-100/10 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 active:scale-[0.99]'
                    }`}
                  >
                    {enCarrito && (
                      <span className="absolute top-2 right-2 z-10 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
                        {enCarrito.cantidad}
                      </span>
                    )}
                    <div className="w-full h-24 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2 border border-slate-100 dark:border-slate-800">
                      <img
                        src={resolverUrlFotoProducto(p.foto_url, p.nombre)}
                        alt={p.nombre}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                        {p.nombre}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          ${fmt(p.precio_venta)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Stock: {Number(p.cantidad_actual).toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna derecha: Ticket Activo + Pago en 1 Toque */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Cuenta actual ({carrito.reduce((s, i) => s + i.cantidad, 0)} ítems)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total e inventario sincronizados al instante
                </p>
              </div>
              {carrito.length > 0 && (
                <button
                  type="button"
                  onClick={vaciar}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <Trash2 size={14} /> Vaciar (Esc)
                </button>
              )}
            </div>

            {/* Lista de ítems en el carrito */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {carrito.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Escanea un código de barras o toca un producto para iniciar la venta.
                </div>
              ) : (
                carrito.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {item.foto_url && (
                        <img
                          src={resolverUrlFotoProducto(item.foto_url, item.nombre)}
                          alt={item.nombre}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {item.nombre}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          ${fmt(item.precio_venta)} × {item.cantidad} ={' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            ${fmt(item.precio_venta * item.cantidad)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => restar(item.id)}
                        className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300"
                        aria-label="Restar unidad"
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={item.cantidad}
                        onChange={(e) => setCantidad(item.id, e.target.value)}
                        className="w-12 text-center text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg py-2"
                      />
                      <button
                        type="button"
                        onClick={() => agregar(item)}
                        className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300"
                        aria-label="Sumar unidad"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Selección de método de pago en 1 toque */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                Método de pago rápido
              </label>
              <div className="grid grid-cols-3 gap-2">
                {METODOS_PAGO.map((m) => {
                  const Icon = m.icon
                  const activo = metodoPago === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all min-h-[44px] flex items-center justify-center gap-1.5 ${
                        activo
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Controles de efectivo y cálculo automático de vueltas */}
            {metodoPago === 'Efectivo' && carrito.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMontoRecibido(String(Math.round(total)))}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    Exacto
                  </button>
                  {BILLETES_RAPIDOS.map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() => setMontoRecibido(String(billete))}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                    >
                      ${fmt(billete)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 items-center pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      Efectivo recibido ($)
                    </span>
                    <input
                      type="number"
                      placeholder={String(Math.round(total))}
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-2.5 py-1.5 text-sm font-bold"
                    />
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg px-3 py-1.5 text-right">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
                      Cambio / Vueltas
                    </span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                      ${fmt(cambio)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {metodoPago === 'Fiado' && carrito.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-amber-800 dark:text-amber-300 block mb-1">
                  Nombre del cliente (Cuenta por cobrar / Fiado)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Doña Marta - Casa esquinera"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  className="w-full border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/40 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            {feedbackPos && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  feedbackPos.tipo === 'ok'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                {feedbackPos.texto}
              </div>
            )}

            {/* Total y Botón Principal de Confirmación */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                  Total a cobrar
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                  ${fmt(total)}
                </span>
              </div>

              <button
                type="button"
                disabled={!carrito.length || procesandoVenta}
                onClick={confirmarVentaRapida}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-semibold py-4 rounded-xl text-base shadow-xs transition-all min-h-[52px] flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Zap size={18} />
                <span>
                  {procesandoVenta
                    ? 'Procesando venta...'
                    : `Confirmar venta con ${metodoPago} [F2]`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODO 1: ACTIVIDAD DEL DÍA (Exclusivo Admin)              */}
      {/* ======================================================== */}
      {esAdmin && modoVista === 'actividad' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <button
                type="button"
                onClick={irDiaAnterior}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Día anterior"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-800 font-semibold text-xs sm:text-sm">
                <Calendar size={16} className="text-violet-600" />
                <span>{formatearFechaCabecera(fechaActividad)}</span>
              </div>

              <button
                type="button"
                onClick={irDiaSiguiente}
                disabled={esHoy}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors"
                title="Día siguiente"
              >
                <ChevronRight size={18} />
              </button>

              {!esHoy && (
                <button
                  type="button"
                  onClick={irAHoy}
                  className="text-xs text-violet-600 hover:text-violet-700 font-semibold px-2 py-1 underline ml-1"
                >
                  Ir a Hoy
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400 shrink-0 hidden sm:block" />
              <select
                value={cajeroFiltro}
                onChange={(e) => setCajeroFiltro(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-full sm:w-auto"
              >
                <option value="">Todos los cajeros</option>
                {cajerosDisponibles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre || c.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={cargarActividad}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
                title="Refrescar actividad"
              >
                <RefreshCw size={16} className={cargandoActividad ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Ingresos Vigentes ({formatearFechaCabecera(fechaActividad)})
                </span>
                <p className="text-3xl sm:text-4xl font-extrabold text-violet-700">
                  {cargandoActividad ? '…' : `$${fmt(totalActividad)}`}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-2xl font-bold text-slate-800">
                  {cargandoActividad ? '…' : ventasActividad.length}
                </p>
                <p className="text-xs text-slate-400">
                  {ventasActividad.length === 1 ? 'operación registrada' : 'operaciones registradas'}
                </p>
              </div>
            </div>

            {desgloseVendedores.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Ventas por Vendedor:
                </span>
                <div className="flex flex-wrap gap-2">
                  {desgloseVendedores.map((v) => (
                    <div
                      key={v.nombre}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center gap-2"
                    >
                      <span className="font-semibold text-slate-700">👤 {v.nombre}:</span>
                      <span className="text-violet-600 font-bold">${fmt(v.total)}</span>
                      <span className="text-slate-400 text-[11px]">({v.conteo})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errorActividad && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm flex items-center justify-between">
              <span>{errorActividad}</span>
              <button
                type="button"
                onClick={cargarActividad}
                className="text-xs bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg"
              >
                Reintentar
              </button>
            </div>
          )}

          {cargandoActividad ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 text-slate-500 text-sm">
                <Loader2 size={22} className="animate-spin text-violet-600" />
                Cargando ventas del día...
              </div>
            </div>
          ) : ventasActividad.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
                📋
              </div>
              <h3 className="font-semibold text-slate-800 text-base">
                Sin ventas registradas en esta fecha
              </h3>
            </div>
          ) : (
            <div className="space-y-3">
              {ventasActividad.map((venta) => (
                <VentaTimelineItem
                  key={venta.id}
                  venta={venta}
                  onAnularClick={(v) => {
                    setVentaAAnular(v)
                    setMotivoAnulacion('')
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODO 2: HISTÓRICO GENERAL                                */}
      {/* ======================================================== */}
      {modoVista === 'historico' && (
        <div className="space-y-5">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS_HISTORICO.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTabHistorico(t.id)}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-sm font-medium transition-all ${
                  tabHistorico === t.id
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="sm:hidden">{t.labelCorto}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {errorHistorico && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{errorHistorico}</div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">
                {tabHistorico === 'hoy'
                  ? 'Total ingresos hoy'
                  : tabHistorico === 'semana'
                  ? 'Total esta semana'
                  : 'Total últimos 30 días'}
              </p>
              <p className="text-3xl sm:text-4xl font-extrabold text-violet-600">
                {cargandoHistorico
                  ? '…'
                  : `$${fmt(
                      ventasHistorico
                        .filter((v) => v.estado !== 'ANULADA')
                        .reduce((s, v) => s + (v.total || 0), 0)
                    )}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">
                {cargandoHistorico ? '…' : ventasHistorico.length}
              </p>
              <p className="text-xs text-slate-400">
                {ventasHistorico.length === 1 ? 'venta' : 'ventas'}
              </p>
            </div>
          </div>

          {cargandoHistorico ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-slate-200">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-500" />
            </div>
          ) : ventasHistorico.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="text-5xl mb-3">📋</div>
              <p className="text-sm">Sin ventas en este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ventasHistorico.map((venta) => (
                <VentaTimelineItem
                  key={venta.id}
                  venta={venta}
                  onAnularClick={(v) => {
                    setVentaAAnular(v)
                    setMotivoAnulacion('')
                  }}
                />
              ))}
            </div>
          )}

          {canExportReports(usuario) && tabHistorico === 'historico' && (
            <ExcelExport empresaId={usuario?.empresa_id} />
          )}
        </div>
      )}

      {/* Modal Escáner de Cámara para Caja */}
      {escanerAbierto && (
        <EscanerModal
          onDetect={(codigo) => {
            setEscanerAbierto(false)
            procesarCodigoEscaneado(codigo)
          }}
          onClose={() => setEscanerAbierto(false)}
        />
      )}

      {/* Modal para crear producto desconocido sobre la marcha sin perder el carrito */}
      {modalProvisionalAbierto && (
        <ModalProducto
          producto={null}
          codigoInicial={codigoNoEncontrado || ''}
          onGuardar={guardarProductoProvisionalYAnadir}
          onCerrar={() => setModalProvisionalAbierto(false)}
        />
      )}

      {/* Modal de Confirmación de Anulación Auditable */}
      {ventaAAnular && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Anular Venta #{String(ventaAAnular.id).split('-')[0]}
            </h3>
            <p className="text-xs text-slate-600">
              Esta acción revertirá automáticamente las existencias al inventario, descontará el ingreso de la sesión de caja activa y dejará registro en auditoría.
            </p>
            <form onSubmit={ejecutarAnulacion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo de la anulación (obligatorio)
                </label>
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  placeholder="Ej: Cliente devolvió producto o error de digitación en cantidad..."
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setVentaAAnular(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={anulando || motivoAnulacion.trim().length < 3}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white text-xs font-bold"
                >
                  {anulando ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
