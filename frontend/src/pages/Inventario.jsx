import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  ScanBarcode,
  Package,
  History,
  BellRing,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  Truck,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProductos, resolverUrlFotoProducto } from '../hooks/useProductos'
import ProductoCard from '../components/ProductoCard'
import ModalProducto from '../components/ModalProducto'
import BarcodeScanner from '../components/BarcodeScanner'
import authService from '../services/authService'
import { canEditProducts } from '../utils/permissions'

const BASE = import.meta.env.VITE_API_URL || '/api'

export default function Inventario() {
  const { usuario } = useAuth()
  const {
    productos,
    tienda,
    cargando,
    error,
    modoOffline,
    cargar,
    crear,
    actualizar,
    eliminar,
    registrarMovimiento,
  } = useProductos()

  const esAdmin = canEditProducts(usuario)

  const [tabActiva, setTabActiva] = useState('catalogo') // catalogo | alertas | movimientos
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoEditar, setProductoEditar] = useState(null)
  const [codigoPrellenado, setCodigoPrellenado] = useState('')
  const [escanerInventarioAbierto, setEscanerInventarioAbierto] = useState(false)
  const [mensajeEscaner, setMensajeEscaner] = useState(null)

  // Modal de movimiento de stock (entrada / salida / ajuste)
  const [productoMovimiento, setProductoMovimiento] = useState(null)
  const [formMov, setFormMov] = useState({
    tipo: 'entrada',
    cantidad: '',
    motivo: 'Compra a proveedor',
    nuevo_precio_costo: '',
    nuevo_precio_venta: '',
  })
  const [guardandoMov, setGuardandoMov] = useState(false)
  const [errorMov, setErrorMov] = useState(null)

  // Datos de alertas inteligentes e historial
  const [alertasData, setAlertasData] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [cargandoExtra, setCargandoExtra] = useState(false)

  const cargarAlertasYMovimientos = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    setCargandoExtra(true)
    try {
      const [resAlertas, resMovs] = await Promise.all([
        authService.fetchAuth(`${BASE}/productos/alertas/inteligentes`),
        authService.fetchAuth(`${BASE}/productos/movimientos/historial?limit=100`),
      ])
      if (resAlertas.ok) setAlertasData(await resAlertas.json())
      if (resMovs.ok) setMovimientos(await resMovs.json())
    } catch {
      // silenciar en modo offline
    } finally {
      setCargandoExtra(false)
    }
  }, [])

  useEffect(() => {
    cargarAlertasYMovimientos()
  }, [cargarAlertasYMovimientos, productos.length])

  useEffect(() => {
    const recargarTodo = () => {
      cargar()
      cargarAlertasYMovimientos()
    }
    window.addEventListener('venta-completada', recargarTodo)
    return () => window.removeEventListener('venta-completada', recargarTodo)
  }, [cargar, cargarAlertasYMovimientos])

  const categoriasDisponibles = [
    'TODAS',
    ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean))),
  ]

  const filtrados = productos.filter((p) => {
    const coincideTexto =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_barras.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.proveedor || '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideCat =
      filtroCategoria === 'TODAS' || p.categoria === filtroCategoria
    return coincideTexto && coincideCat
  })

  // Escáner de Inventario (Sección 7A): busca código, evita duplicados o abre creación con código completado
  const manejarEscaneoInventario = (codigoLeido) => {
    const codigo = (codigoLeido || '').trim()
    if (!codigo) return
    setEscanerInventarioAbierto(false)

    const encontrado = productos.find((p) => p.codigo_barras === codigo)
    if (encontrado) {
      setMensajeEscaner({
        tipo: 'encontrado',
        texto: `Producto reconocido: "${encontrado.nombre}" (${encontrado.cantidad_actual} disponibles). Puedes registrar una entrada de stock o editarlo.`,
        producto: encontrado,
      })
      if (esAdmin) {
        abrirModalMovimiento(encontrado)
      } else {
        setBusqueda(codigo)
      }
    } else {
      setMensajeEscaner({
        tipo: 'nuevo',
        texto: `El código "${codigo}" no está en tu catálogo. Se abrió el formulario con el código listo para registrarlo.`,
      })
      if (esAdmin) {
        setProductoEditar(null)
        setCodigoPrellenado(codigo)
        setModalAbierto(true)
      }
    }
  }

  const guardarProducto = async (payload) => {
    if (productoEditar) {
      await actualizar(productoEditar.id, payload)
    } else {
      await crear(payload)
    }
    await cargarAlertasYMovimientos()
  }

  const abrirEditar = (producto) => {
    setProductoEditar(producto)
    setCodigoPrellenado('')
    setModalAbierto(true)
  }

  const abrirNuevo = (codigo = '') => {
    setProductoEditar(null)
    setCodigoPrellenado(codigo)
    setModalAbierto(true)
  }

  const abrirModalMovimiento = (producto) => {
    setProductoMovimiento(producto)
    setFormMov({
      tipo: 'entrada',
      cantidad: '',
      motivo: 'Compra a proveedor / Reabastecimiento',
      nuevo_precio_costo: producto.precio_costo ?? '',
      nuevo_precio_venta: producto.precio_venta ?? '',
    })
    setErrorMov(null)
  }

  const enviarMovimiento = async (e) => {
    e.preventDefault()
    if (!productoMovimiento) return
    setGuardandoMov(true)
    setErrorMov(null)
    try {
      await registrarMovimiento(productoMovimiento.id, {
        tipo: formMov.tipo,
        cantidad: parseFloat(formMov.cantidad) || 0,
        motivo: formMov.motivo.trim(),
        nuevo_precio_costo:
          formMov.nuevo_precio_costo !== ''
            ? parseFloat(formMov.nuevo_precio_costo)
            : null,
        nuevo_precio_venta:
          formMov.nuevo_precio_venta !== ''
            ? parseFloat(formMov.nuevo_precio_venta)
            : null,
      })
      setProductoMovimiento(null)
      await cargarAlertasYMovimientos()
    } catch (err) {
      setErrorMov(err.message)
    } finally {
      setGuardandoMov(false)
    }
  }

  const confirmarEliminar = async (id) => {
    if (
      !window.confirm(
        '¿Confirmas desactivar este producto del catálogo? El historial de ventas se conservará intacto.'
      )
    )
      return
    try {
      await eliminar(id)
      await cargarAlertasYMovimientos()
    } catch (e) {
      alert(e.message)
    }
  }

  const totalAlertas =
    (alertasData?.resumen?.total_agotados || 0) +
    (alertasData?.resumen?.total_stock_bajo || 0)

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {tienda || 'Catálogo e Inventario'}
            </h1>
            {modoOffline && (
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                Catálogo offline
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
            {productos.length} productos registrados · Escáner de código de barras y control de existencias
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEscanerInventarioAbierto((prev) => !prev)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <ScanBarcode size={16} />
            <span>Escáner de inventario</span>
          </button>

          {esAdmin && (
            <button
              type="button"
              onClick={() => abrirNuevo('')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={16} />
              <span>Nuevo producto</span>
            </button>
          )}
        </div>
      </div>

      {/* Escáner de Inventario desplegable */}
      {escanerInventarioAbierto && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Escáner de inventario (cámara o lector USB)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Si el código existe podrás sumar existencias; si no existe, se abrirá el registro con el código completado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEscanerInventarioAbierto(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
          <BarcodeScanner
            onScan={manejarEscaneoInventario}
            onClose={() => setEscanerInventarioAbierto(false)}
          />
        </div>
      )}

      {mensajeEscaner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
            mensajeEscaner.tipo === 'encontrado'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
          }`}
        >
          <span>{mensajeEscaner.texto}</span>
          <button
            type="button"
            onClick={() => setMensajeEscaner(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pestañas de navegación del módulo */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTabActiva('catalogo')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 transition-colors ${
            tabActiva === 'catalogo'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package size={16} />
          <span>Catálogo ({productos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('alertas')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 transition-colors ${
            tabActiva === 'alertas'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BellRing size={16} />
          <span>Alertas y reposición</span>
          {totalAlertas > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-bold">
              {totalAlertas}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTabActiva('movimientos')}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shrink-0 transition-colors ${
            tabActiva === 'movimientos'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={16} />
          <span>Movimientos / Kardex ({movimientos.length})</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: CATÁLOGO DE PRODUCTOS CON FOTOS */}
      {tabActiva === 'catalogo' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, código de barras o proveedor..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categoriasDisponibles.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoria(cat)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    filtroCategoria === cat
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {cargando && productos.length === 0 ? (
            <div className="flex items-center justify-center h-56">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center py-14 px-4">
              <Package size={40} className="mx-auto text-slate-400 dark:text-slate-500 mb-2 opacity-50" />
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {busqueda
                  ? 'No encontramos productos para esa búsqueda'
                  : 'Aún no hay productos registrados en tu tienda'}
              </p>
              {esAdmin && busqueda && /^\d{4,}$/.test(busqueda.trim()) && (
                <button
                  type="button"
                  onClick={() => abrirNuevo(busqueda.trim())}
                  className="mt-3 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
                >
                  Registrar producto con código &quot;{busqueda.trim()}&quot;
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filtrados.map((p) => (
                <ProductoCard
                  key={p.id}
                  producto={p}
                  onEditar={abrirEditar}
                  onEliminar={confirmarEliminar}
                  onMovimiento={abrirModalMovimiento}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALERTAS INTELIGENTES Y RECOMENDACIÓN DE COMPRA */}
      {tabActiva === 'alertas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Agotados
              </p>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {alertasData?.resumen?.total_agotados || 0}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Stock bajo
              </p>
              <p className="text-2xl font-bold text-amber-500 dark:text-amber-400 mt-1">
                {alertasData?.resumen?.total_stock_bajo || 0}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Pedido sugerido ($)
              </p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                $
                {Number(
                  alertasData?.resumen?.costo_total_reposicion_sugerida || 0
                ).toLocaleString('es-CO')}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Baja rotación (30d)
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {alertasData?.resumen?.total_baja_rotacion || 0}
              </p>
            </div>
          </div>

          {/* Recomendación inteligente de reposición */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={17} className="text-slate-600 dark:text-slate-300" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Recomendaciones de compra y reposición
                </h2>
              </div>
              <button
                type="button"
                onClick={cargarAlertasYMovimientos}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={13} className={cargandoExtra ? 'animate-spin' : ''} />
                <span>Actualizar</span>
              </button>
            </div>

            {(alertasData?.reposicion_recomendada || []).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                Tu inventario tiene cobertura suficiente según el ritmo actual de ventas.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alertasData.reposicion_recomendada.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50/60 dark:bg-slate-800/40"
                  >
                    <img
                      src={resolverUrlFotoProducto(item.foto_url, item.nombre)}
                      alt={item.nombre}
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.urgencia === 'CRITICA'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                              : item.urgencia === 'ALTA'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.urgencia}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {item.proveedor}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {item.nombre}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Actual: <b>{item.cantidad_actual}</b> (Mín: {item.stock_minimo}) ·
                        Sugerido: <b>{item.cantidad_sugerida_pedido}</b> ($
                        {Number(item.costo_estimado_pedido).toLocaleString('es-CO')})
                      </p>
                    </div>
                    {esAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const prod = productos.find(
                            (p) => String(p.id) === String(item.id)
                          )
                          if (prod) abrirModalMovimiento(prod)
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white text-xs font-semibold shrink-0 transition-colors"
                      >
                        Abastecer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Productos de baja rotación */}
          {(alertasData?.baja_rotacion || []).length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown size={17} className="text-slate-600 dark:text-slate-300" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Productos de baja rotación
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {alertasData.baja_rotacion.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30"
                  >
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {item.nombre}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Stock: {item.cantidad_actual} · Inmovilizado: $
                        {Number(item.capital_inmovilizado).toLocaleString('es-CO')}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      Sugerir promo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HISTORIAL AUDITABLE DE MOVIMIENTOS DE INVENTARIO */}
      {tabActiva === 'movimientos' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Historial de movimientos (kardex)
            </h2>
            <button
              type="button"
              onClick={cargarAlertasYMovimientos}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Actualizar
            </button>
          </div>

          {movimientos.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
              Aún no hay movimientos de inventario registrados.
            </p>
          ) : (
            <div className="space-y-2.5">
              {movimientos.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          m.tipo === 'entrada' ||
                          m.tipo === 'inicial' ||
                          m.tipo === 'anulacion_venta'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : m.tipo === 'salida' || m.tipo === 'venta'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {m.tipo.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {m.producto_nombre}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        #{m.codigo_barras}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.motivo || 'Sin observación'} · Por:{' '}
                      <b>{m.usuario_nombre_snapshot || 'Sistema'}</b>
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Stock: {m.stock_anterior} → {m.stock_nuevo} (Δ {m.cantidad})
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString('es-CO')
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Crear / Editar Producto */}
      {modalAbierto && (
        <ModalProducto
          producto={productoEditar}
          codigoInicial={codigoPrellenado}
          productosExistentes={productos}
          onGuardar={guardarProducto}
          onSeleccionarExistente={(existente) => {
            setProductoEditar(existente)
            setCodigoPrellenado('')
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {/* Modal de Movimiento de Inventario */}
      {productoMovimiento && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-none flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
              <div>
                <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  Movimiento de inventario
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {productoMovimiento.nombre} (Stock actual:{' '}
                  {productoMovimiento.cantidad_actual}{' '}
                  {productoMovimiento.unidad_medida})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProductoMovimiento(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={enviarMovimiento} className="p-5 space-y-4">
              {errorMov && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {errorMov}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'entrada',
                    label: 'Entrada (+)',
                    defaultMotivo: 'Compra a proveedor / Reabastecimiento',
                  },
                  {
                    id: 'salida',
                    label: 'Salida (-)',
                    defaultMotivo: 'Merma / Vencimiento / Consumo interno',
                  },
                  {
                    id: 'ajuste',
                    label: 'Ajuste (=)',
                    defaultMotivo: 'Conteo físico de inventario',
                  },
                ].map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() =>
                      setFormMov((prev) => ({
                        ...prev,
                        tipo: op.id,
                        motivo: op.defaultMotivo,
                      }))
                    }
                    className={`min-h-[42px] rounded-xl text-xs font-semibold border transition-colors ${
                      formMov.tipo === op.id
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {formMov.tipo === 'ajuste'
                    ? 'Nuevo conteo físico total en tienda *'
                    : 'Cantidad a mover *'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={formMov.cantidad}
                  onChange={(e) =>
                    setFormMov((prev) => ({ ...prev, cantidad: e.target.value }))
                  }
                  placeholder="Ej: 12"
                  className="w-full min-h-[44px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo u observación *
                </label>
                <input
                  type="text"
                  required
                  value={formMov.motivo}
                  onChange={(e) =>
                    setFormMov((prev) => ({ ...prev, motivo: e.target.value }))
                  }
                  placeholder="Ej: Factura proveedor #402"
                  className="w-full min-h-[44px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                />
              </div>

              {formMov.tipo === 'entrada' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Costo compra ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formMov.nuevo_precio_costo}
                      onChange={(e) =>
                        setFormMov((prev) => ({
                          ...prev,
                          nuevo_precio_costo: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Precio venta ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formMov.nuevo_precio_venta}
                      onChange={(e) =>
                        setFormMov((prev) => ({
                          ...prev,
                          nuevo_precio_venta: e.target.value,
                        }))
                      }
                      className="w-full min-h-[42px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-1.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductoMovimiento(null)}
                  className="flex-1 min-h-[44px] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoMov}
                  className="flex-1 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {guardandoMov ? 'Guardando...' : 'Confirmar movimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
