import { useState, useEffect, useRef } from 'react'
import {
  Camera,
  Image as ImageIcon,
  ScanBarcode,
  X,
  Star,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import BarcodeScanner from './BarcodeScanner'
import { comprimirImagenArchivo } from '../services/offlineDB'
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
  const inputCamaraRef = useRef(null)
  const inputGaleriaRef = useRef(null)

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
  const [procesandoFoto, setProcesandoFoto] = useState(false)
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

  // Consulta en tiempo real contra el catálogo de la tienda para evitar duplicados (Sección 6 y 7A)
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

  const procesarArchivoImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProcesandoFoto(true)
    setError(null)
    try {
      const dataUrl = await comprimirImagenArchivo(file, 640, 0.78)
      setForm((prev) => ({
        ...prev,
        foto_url: dataUrl,
        es_provisional: false,
      }))
    } catch (err) {
      setError(err.message || 'No se pudo procesar la fotografía')
    } finally {
      setProcesandoFoto(false)
    }
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
        'La fotografía del producto es obligatoria para completar el registro. Toma una foto con la cámara, elígela de tu galería o marca explícitamente "Captura rápida provisional".'
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
    'w-full min-h-[44px] border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600'

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          <div>
            <h2 className="font-bold text-base sm:text-lg text-slate-900">
              {esEdicion ? 'Editar Producto' : 'Registrar Producto'}
            </h2>
            <p className="text-xs text-slate-500">
              Las fotografías son obligatorias para identificar rápido en caja.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. FOTOGRAFÍA DEL PRODUCTO (OBLIGATORIA) */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Fotografía del Producto *
              </label>
              {form.foto_url ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={14} /> Lista para uso offline
                </span>
              ) : (
                <span className="text-xs font-semibold text-amber-700">
                  Requerida
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                {form.foto_url ? (
                  <img
                    src={resolverUrlFotoProducto(form.foto_url, form.nombre)}
                    alt="Vista previa"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <Camera size={26} className="mx-auto mb-1" />
                    <span className="text-[10px] font-semibold block">
                      Sin foto
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Captura directa con cámara del celular */}
                  <input
                    ref={inputCamaraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={procesarArchivoImagen}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => inputCamaraRef.current?.click()}
                    disabled={procesandoFoto}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Camera size={15} />
                    <span>Tomar foto</span>
                  </button>

                  {/* Selección desde galería o dispositivo */}
                  <input
                    ref={inputGaleriaRef}
                    type="file"
                    accept="image/*"
                    onChange={procesarArchivoImagen}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => inputGaleriaRef.current?.click()}
                    disabled={procesandoFoto}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <ImageIcon size={15} />
                    <span>Galería / Archivo</span>
                  </button>
                </div>

                <input
                  type="text"
                  name="foto_url"
                  value={
                    form.foto_url?.startsWith('data:image/')
                      ? ''
                      : form.foto_url
                  }
                  onChange={cambiar}
                  placeholder="O pega URL de imagen (opcional si tomaste foto)"
                  className="w-full min-h-[38px] border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                />

                {/* Opción explícita de captura provisional si está en medio de una venta */}
                {!form.foto_url && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      name="es_provisional"
                      checked={form.es_provisional}
                      onChange={cambiar}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>
                      Captura rápida provisional (marcar producto como pendiente de foto definitiva)
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* 2. CÓDIGO DE BARRAS Y DETECCIÓN DE DUPLICADOS */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              2. Código de Barras o Identificador Único *
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
                className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
                  escaneando
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ScanBarcode size={17} />
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
              <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
                <div className="text-xs text-amber-900">
                  <p className="font-bold">
                    Este código ya pertenece a: {duplicadoDetectado.nombre}
                  </p>
                  <p>
                    Stock actual: {duplicadoDetectado.cantidad_actual} · Precio: $
                    {Number(duplicadoDetectado.precio_venta).toLocaleString('es-CO')}
                  </p>
                </div>
                {onSeleccionarExistente && (
                  <button
                    type="button"
                    onClick={() => onSeleccionarExistente(duplicadoDetectado)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre del Producto *
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
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

          {/* 4. PRECIOS Y MARGEN EN VIVO */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Precio de Compra ($) *
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Precio de Venta ($) *
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
            <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block font-medium">
                Ganancia unidad:
              </span>
              <span
                className={`font-extrabold text-sm ${
                  margenPesos >= 0 ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                ${margenPesos.toLocaleString('es-CO')} ({margenPct}%)
              </span>
            </div>
          </div>

          {/* 5. EXISTENCIAS, UNIDAD Y STOCK MÍNIMO */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cantidad Disponible
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stock Mínimo Alerta
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

          {/* 6. PROVEEDOR, TIEMPO DE REPOSICIÓN Y VENCIMIENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
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
              <label className="block text-xs font-bold text-slate-700 mb-1">
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

          {/* 7. PRODUCTO FRECUENTE PARA VENTA EN < 3 SEGUNDOS */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              name="es_frecuente"
              checked={form.es_frecuente}
              onChange={cambiar}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-800">
              <Star size={16} className="text-amber-500" />
              <span>
                Destacar en la cuadrícula de Venta Rápida (&lt; 3 segundos en Caja)
              </span>
            </div>
          </label>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="flex-1 min-h-[46px] border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || procesandoFoto}
              className="flex-1 min-h-[46px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors text-sm"
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
  )
}
