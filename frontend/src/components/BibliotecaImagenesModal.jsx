import { useState, useEffect, useRef } from 'react'
import {
  X,
  Upload,
  Camera,
  Search,
  Trash2,
  Check,
  Image as ImageIcon,
  Loader2,
  Sparkles,
} from 'lucide-react'
import authService from '../services/authService'
import { resolverUrlFotoProducto } from '../hooks/useProductos'

const BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Comprime una imagen en el cliente generando dos versiones:
 * 1. Optimizada (~640px)
 * 2. Miniatura (~160px)
 */
async function procesarYComprimirImagen(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'))
      img.onload = () => {
        const anchoOrig = img.width || 1
        const altoOrig = img.height || 1

        const redimensionar = (maxDim, calidad) => {
          let w = anchoOrig
          let h = altoOrig
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, w)
          canvas.height = Math.max(1, h)
          const ctx = canvas.getContext('2d')
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          let dataUrl = canvas.toDataURL('image/webp', calidad)
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', calidad)
          }
          return { dataUrl, w: canvas.width, h: canvas.height }
        }

        const opt = redimensionar(640, 0.82)
        const mini = redimensionar(160, 0.75)
        const nombreLimpio = (file.name || 'foto')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_\-\s]/g, '')
          .slice(0, 80)

        resolve({
          optimizada: opt.dataUrl,
          miniatura: mini.dataUrl,
          ancho: opt.w,
          alto: opt.h,
          nombre: nombreLimpio,
        })
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function BibliotecaImagenesModal({
  fotoActual = '',
  nombreProducto = '',
  onSeleccionar,
  onCerrar,
}) {
  const [imagenes, setImagenes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const inputCamaraRef = useRef(null)
  const inputArchivoRef = useRef(null)

  const cargarBiblioteca = async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/imagenes`)
      if (!res.ok) throw new Error('Error al cargar la biblioteca de fotos')
      const data = await res.json()
      setImagenes(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarBiblioteca()
  }, [])

  const handleSubirArchivo = async (file) => {
    if (!file) return
    setSubiendo(true)
    setError(null)
    setAviso(null)
    try {
      const payload = await procesarYComprimirImagen(file)
      const res = await authService.fetchAuth(`${BASE}/imagenes`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Error al guardar la imagen en el servidor')
      }
      const data = await res.json()
      if (data.reutilizada) {
        setAviso('Foto idéntica detectada: se reutilizó la versión existente sin duplicar espacio.')
      }
      await cargarBiblioteca()
      if (onSeleccionar) {
        onSeleccionar(data.url)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  const handleEliminar = async (e, img) => {
    e.stopPropagation()
    if (img.usos > 0) {
      setError(`Esta imagen está en uso por ${img.usos} producto(s). No se puede borrar.`)
      return
    }
    if (!window.confirm('¿Deseas eliminar esta foto de la biblioteca?')) return
    setEliminandoId(img.id)
    setError(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/imagenes/${img.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'No se pudo eliminar la imagen')
      }
      setImagenes((prev) => prev.filter((i) => i.id !== img.id))
      if (fotoActual && fotoActual.includes(img.id) && onSeleccionar) {
        onSeleccionar('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  const imagenesFiltradas = imagenes.filter((img) => {
    if (!filtro.trim()) return true
    return (img.nombre || '').toLowerCase().includes(filtro.toLowerCase().trim())
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera minimalista */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Fotos del producto
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {nombreProducto ? `Para "${nombreProducto}"` : 'Biblioteca compartida de tu tienda'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Zona de subida y acciones rápidas */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSubirArchivo(e.target.files[0])
              e.target.value = ''
            }}
          />
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSubirArchivo(e.target.files[0])
              e.target.value = ''
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={subiendo}
              onClick={() => inputCamaraRef.current?.click()}
              className="flex-1 min-w-[130px] min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              <span>Tomar foto</span>
            </button>

            <button
              type="button"
              disabled={subiendo}
              onClick={() => inputArchivoRef.current?.click()}
              className="flex-1 min-w-[130px] min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Upload size={15} />
              <span>Subir de galería</span>
            </button>

            {fotoActual && (
              <button
                type="button"
                onClick={() => {
                  if (onSeleccionar) onSeleccionar('')
                  onCerrar()
                }}
                className="min-h-[44px] px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 transition-colors"
              >
                Quitar foto
              </button>
            )}
          </div>

          {/* Avisos y mensajes de error */}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}
          {aviso && (
            <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs border border-sky-200 dark:border-sky-900/50 flex items-center gap-2">
              <Sparkles size={14} className="shrink-0" />
              <span>{aviso}</span>
            </div>
          )}

          {/* Buscador de fotos en la biblioteca */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nombre de foto..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-600"
            />
          </div>
        </div>

        {/* Lista / Grid de fotos guardadas en el negocio */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {cargando ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
              <Loader2 size={24} className="animate-spin text-slate-500" />
              <span className="text-xs">Cargando fotos de tu tienda...</span>
            </div>
          ) : imagenesFiltradas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <ImageIcon size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">
                {imagenes.length === 0
                  ? 'Aún no hay fotos en tu biblioteca. Toma o sube la primera foto arriba.'
                  : 'No se encontraron fotos con ese nombre.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {imagenesFiltradas.map((img) => {
                const esSeleccionada =
                  fotoActual &&
                  (fotoActual.includes(img.id) ||
                    fotoActual === img.url ||
                    fotoActual.endsWith(img.url))

                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      if (onSeleccionar) onSeleccionar(img.url)
                      onCerrar()
                    }}
                    className={`group relative aspect-square rounded-xl overflow-hidden border cursor-pointer transition-all ${
                      esSeleccionada
                        ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 ring-offset-1 dark:ring-offset-slate-900'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={resolverUrlFotoProducto(img.miniatura_url || img.url, img.nombre)}
                      alt={img.nombre || 'Foto'}
                      className="w-full h-full object-cover bg-slate-100 dark:bg-slate-800"
                      loading="lazy"
                    />

                    {/* Badge de usos */}
                    <div className="absolute top-1 left-1 pointer-events-none">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900/80 text-white backdrop-blur-none">
                        {img.usos > 0 ? `${img.usos} prod.` : 'Sin uso'}
                      </span>
                    </div>

                    {/* Check si está seleccionada */}
                    {esSeleccionada && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shadow">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    {/* Botón de borrar (solo si usos === 0) */}
                    {img.usos === 0 && (
                      <button
                        type="button"
                        onClick={(e) => handleEliminar(e, img)}
                        disabled={eliminandoId === img.id}
                        className="absolute bottom-1 right-1 p-1 rounded-md bg-white/90 dark:bg-slate-800/90 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 opacity-0 group-hover:opacity-100 sm:opacity-0 focus:opacity-100 transition-opacity"
                        title="Borrar de la biblioteca"
                      >
                        {eliminandoId === img.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    )}

                    {/* Nombre al pie */}
                    {img.nombre && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 pt-3 pointer-events-none">
                        <p className="text-[10px] text-white truncate text-center">
                          {img.nombre}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pie con selector activo */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{imagenes.length} fotos guardadas</span>
          <button
            type="button"
            onClick={onCerrar}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
