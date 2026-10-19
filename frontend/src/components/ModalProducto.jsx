import { useState, useEffect } from 'react'
import {
  Camera,
  Image as ImageIcon,
  ScanBarcode,
  X,
  Star,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BarcodeScanner from './BarcodeScanner'
import BibliotecaImagenesModal from './BibliotecaImagenesModal'
import { resolverUrlFotoProducto } from '../hooks/useProductos'

const UNIDADES = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'libra', label: 'Libra' },
  { value: 'kilo', label: 'Kilo (kg)' },
  { value: 'gramo', label: 'Gramo' },
  { value: 'litro', label: 'Litro' },
  { value: 'caja', label: 'Caja' },
  { value: 'bulto', label: 'Bulto' },
]

const CATEGORIAS = [
  'Abarrotes',
  'Granos',
  'Bebidas',
  'Lacteos',
  'Snacks',
  'Panaderia',
  'Carnes Frias',
  'Frutas y Verduras',
  'Aseo',
  'Limpieza',
  'Licores',
  'Otros',
]

export default function ModalProducto({
  producto,
  codigoInicial = '',
  productosExistentes = [],
  onGuardar,
  onSeleccionarExistente,
  onCerrar,
}) {
  const { usuario } = useAuth()
  const esEdicion = Boolean(producto)

  const [form, setForm] = useState({
    nombre: '',
    codigo_barras: codigoInicial || '',
    precio_costo: '',
    precio_venta: '',
    cantidad_actual: '0',
    stock_minimo: '5',
    unidad_medida: 'unidad',
    fecha_vencimiento: '',
    categoria: 'Abarrotes',
    foto_url: '',
    proveedor: '',
    tiempo_reposicion_dias: '1',
    es_provisional: false,
    es_frecuente: false,
    empresa_id: usuario?.empresa_id ?? '',
  })

  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [mostrarBiblioteca, setMostrarBiblioteca] = useState(false)
  const [duplicadoDetectado, setDuplicadoDetectado] = useState(null)

  useEffect(() => {
    if (producto) {
      setForm({
        nombre: producto.nombre || '',
        codigo_barras: producto.codigo_barras || '',
        precio_costo: producto.precio_costo ?? '',
        precio_venta: producto.precio_venta ?? '',
        cantidad_actual: producto.cantidad_actual ?? 0,
        stock_minimo: producto.stock_minimo ?? 5,
        unidad_medida: producto.unidad_medida ?? 'unidad',
        fecha_vencimiento: producto.fecha_vencimiento
          ? String(producto.fecha_vencimiento).split('T')[0]
          : '',
        categoria: producto.categoria || 'Abarrotes',
        foto_url:
          producto.foto_url &&
          !String(producto.foto_url).startsWith('data:image/svg+xml')
            ? producto.foto_url
            : '',
        proveedor: producto.proveedor || '',
        tiempo_reposicion_dias: producto.tiempo_reposicion_dias ?? 1,
        es_provisional: Boolean(producto.es_provisional),
        es_frecuente: Boolean(producto.es_frecuente),
        empresa_id: producto.empresa_id,
      })
    }
  }, [producto])

  // Verificación en tiempo real de duplicados
  useEffect(() => {
    const cod = (form.codigo_barras || '').trim()
    if (!cod) {
      setDuplicadoDetectado(null)
      return
    }
    const coincidencia = productosExistentes.find(
      (p) =>
        p.codigo_barras === cod &&
        (!producto || String(p.id) !== String(producto.id))
    )
    setDuplicadoDetectado(coincidencia || null)
  }, [form.codigo_barras, productosExistentes, producto])

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const alEscanear = (codigo) => {
    setForm((prev) => ({ ...prev, codigo_barras: codigo }))
    setEscaneando(false)
  }

  const costoNum = parseFloat(form.precio_costo) || 0
  const ventaNum = parseFloat(form.precio_venta) || 0
  const margenPesos = ventaNum - costoNum
  const margenPct = ventaNum > 0 ? ((margenPesos / ventaNum) * 100).toFixed(1) : '0.0'

  const guardar = async (e) => {
    e.preventDefault()
    setError(null)

    if (duplicadoDetectado) {
      setError(
        `Ya existe el producto "${duplicadoDetectado.nombre}" con el código ${duplicadoDetectado.codigo_barras}. Edita el existente para no duplicar.`
      )
      return
    }

    const tieneFotoReal = Boolean((form.foto_url || '').trim())
    if (!tieneFotoReal && !form.es_provisional) {
      setError(
        'La fotografía del producto es obligatoria para identificarlo rápido en caja. Toma una foto, elígela de la biblioteca o marca "Captura rápida provisional".'
      )
      return
    }

    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        codigo_barras: form.codigo_barras.trim(),
        precio_costo: parseFloat(form.precio_costo) || 0,
        precio_venta: parseFloat(form.precio_venta) || 0,
        cantidad_actual: parseFloat(form.cantidad_actual) || 0,
        stock_minimo: parseFloat(form.stock_minimo) || 5,
        unidad_medida: form.unidad_medida,
        fecha_vencimiento: form.fecha_vencimiento || null,
        categoria: form.categoria || null,
        foto_url: tieneFotoReal ? form.foto_url.trim() : null,
        proveedor: form.proveedor?.trim() || null,
        tiempo_reposicion_dias: parseInt(form.tiempo_reposicion_dias, 10) || 1,
        es_provisional: !tieneFotoReal && Boolean(form.es_provisional),
        es_frecuente: Boolean(form.es_frecuente),
        exigir_foto: !form.es_provisional,
      }
      await onGuardar(payload)
      onCerrar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const clsInput =
    'w-full min-h-[44px] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600'

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-none z-50 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
          {/* Encabezado */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 sticky top-0 z-10">
            <div>
              <h2 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                {esEdicion ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completa los datos para control de inventario y venta en caja
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={guardar} className="p-5 space-y-4">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. FOTOGRAFÍA DEL PRODUCTO */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Fotografía del producto *
                </label>
                {form.foto_url ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Asignada
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Requerida para caja
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {form.foto_url ? (
                    <img
                      src={resolverUrlFotoProducto(form.foto_url, form.nombre)}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400 dark:text-slate-500">
                      <Camera size={24} className="mx-auto mb-1 opacity-50" />
                      <span className="text-[10px] font-medium block">Sin foto</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarBiblioteca(true)}
                      className="flex-1 min-w-[130px] min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FolderOpen size={15} />
                      <span>{form.foto_url ? 'Cambiar foto' : 'Elegir o tomar foto'}</span>
                    </button>

                    {form.foto_url && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, foto_url: '' }))}
                        className="min-h-[44px] px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  {!form.foto_url && (
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        name="es_provisional"
                        checked={form.es_provisional}
                        onChange={cambiar}
                        className="rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-0 w-4 h-4"
                      />
                      <span>
                        Captura provisional (marcar producto pendiente de foto definitiva)
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* 2. CÓDIGO DE BARRAS */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Código de barras o identificador *
              </label>
              <div className="flex gap-2">
                <input
                  name="codigo_barras"
                  value={form.codigo_barras}
                  onChange={cambiar}
                  required
                  type="text"
                  placeholder="Escanea con lector USB, cámara o escribe el código"
                  className={`${clsInput} flex-1 font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setEscaneando((prev) => !prev)}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                    escaneando
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ScanBarcode size={16} />
                  <span>Escanear</span>
                </button>
              </div>

              {escaneando && (
                <div className="mt-2">
                  <BarcodeScanner
                    onScan={alEscanear}
                    onClose={() => setEscaneando(false)}
                  />
                </div>
              )}

              {duplicadoDetectado && (
                <div className="mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-2">
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">
                      Este código ya pertenece a: {duplicadoDetectado.nombre}
                    </p>
                    <p className="text-[11px] opacity-80">
                      Stock: {duplicadoDetectado.cantidad_actual} · Precio: $
                      {Number(duplicadoDetectado.precio_venta).toLocaleString('es-CO')}
                    </p>
                  </div>
                  {onSeleccionarExistente && (
                    <button
                      type="button"
                      onClick={() => onSeleccionarExistente(duplicadoDetectado)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0"
                    >
                      Editar existente
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 3. NOMBRE Y CATEGORÍA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del producto *
                </label>
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={cambiar}
                  required
                  placeholder="Ej: Arroz Diana 500g"
                  className={clsInput}
                  type="text"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Categoría
                </label>
                <select
                  name="categoria"
                  value={form.categoria}
                  onChange={cambiar}
                  className={clsInput}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. PRECIOS Y MARGEN */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Precio de compra ($) *
                </label>
                <input
                  name="precio_costo"
                  value={form.precio_costo}
                  onChange={cambiar}
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="2200"
                  className={clsInput}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Precio de venta ($) *
                </label>
                <input
                  name="precio_venta"
                  value={form.precio_venta}
                  onChange={cambiar}
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="3000"
                  className={clsInput}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  Ganancia unidad:
                </span>
                <span
                  className={`font-bold text-sm ${
                    margenPesos >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  ${margenPesos.toLocaleString('es-CO')} ({margenPct}%)
                </span>
              </div>
            </div>

            {/* 5. EXISTENCIAS, UNIDAD Y STOCK MÍNIMO */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cantidad actual
                </label>
                <input
                  name="cantidad_actual"
                  value={form.cantidad_actual}
                  onChange={cambiar}
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  className={clsInput}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unidad
                </label>
                <select
                  name="unidad_medida"
                  value={form.unidad_medida}
                  onChange={cambiar}
                  className={clsInput}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alerta stock mín.
                </label>
                <input
                  name="stock_minimo"
                  value={form.stock_minimo}
                  onChange={cambiar}
                  type="number"
                  step="0.001"
                  min="0"
                  className={clsInput}
                />
              </div>
            </div>

            {/* 6. PROVEEDOR, DÍAS REPOSICIÓN Y VENCIMIENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Proveedor
                </label>
                <input
                  name="proveedor"
                  value={form.proveedor}
                  onChange={cambiar}
                  type="text"
                  placeholder="Ej: Distribuidora Sur"
                  className={clsInput}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Días reposición
                </label>
                <input
                  name="tiempo_reposicion_dias"
                  value={form.tiempo_reposicion_dias}
                  onChange={cambiar}
                  type="number"
                  min="1"
                  max="90"
                  className={clsInput}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vencimiento (opc.)
                </label>
                <input
                  type="date"
                  name="fecha_vencimiento"
                  value={form.fecha_vencimiento}
                  onChange={cambiar}
                  className={clsInput}
                />
              </div>
            </div>

            {/* 7. PRODUCTO FRECUENTE */}
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                name="es_frecuente"
                checked={form.es_frecuente}
                onChange={cambiar}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-0"
              />
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                <Star size={15} className="text-amber-500" />
                <span>Destacar en Venta Rápida (&lt; 3 segundos en caja)</span>
              </div>
            </label>

            {/* Acciones */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 min-h-[46px] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 min-h-[46px] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
              >
                {guardando
                  ? 'Guardando...'
                  : esEdicion
                  ? 'Guardar cambios'
                  : 'Registrar producto'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {mostrarBiblioteca && (
        <BibliotecaImagenesModal
          fotoActual={form.foto_url}
          nombreProducto={form.nombre}
          onSeleccionar={(url) => {
            setForm((prev) => ({
              ...prev,
              foto_url: url,
              es_provisional: false,
            }))
          }}
          onCerrar={() => setMostrarBiblioteca(false)}
        />
      )}
    </>
  )
}
