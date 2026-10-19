import { ShoppingCart, Edit3, Trash2, ArrowUpDown, Star, Camera } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { canEditProducts } from '../utils/permissions'
import { resolverUrlFotoProducto } from '../hooks/useProductos'

export default function ProductoCard({
  producto,
  onEditar,
  onEliminar,
  onMovimiento,
}) {
  const { agregar } = useCart()
  const { usuario } = useAuth()
  const esAdmin = canEditProducts(usuario)
  const stock = Number(producto.cantidad_actual || 0)
  const minimo = Number(producto.stock_minimo ?? 5)
  const sinStock = stock <= 0
  const stockBajo = !sinStock && stock <= minimo

  const urlImagen = resolverUrlFotoProducto(producto.foto_url, producto.nombre)

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
        sinStock ? 'opacity-75' : ''
      }`}
    >
      {/* Fotografía uniforme */}
      <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 overflow-hidden border-b border-slate-100 dark:border-slate-800">
        <img
          src={urlImagen}
          alt={producto.nombre}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {producto.es_frecuente && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[10px] font-semibold">
              <Star size={11} fill="currentColor" /> Rápido
            </span>
          )}
          {producto.es_provisional && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-medium">
              <Camera size={11} /> Provisional
            </span>
          )}
        </div>

        <span
          className={`absolute top-2 right-2 text-[11px] px-2.5 py-0.5 rounded-lg font-semibold ${
            sinStock
              ? 'bg-rose-600 text-white'
              : stockBajo
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {sinStock
            ? 'Agotado'
            : `${stock} ${producto.unidad_medida || 'und'}`}
        </span>
      </div>

      {/* Información del producto */}
      <div className="p-3.5 flex flex-col flex-1 gap-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {producto.categoria || 'General'}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">
              #{producto.codigo_barras}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base mt-1.5 line-clamp-2 leading-snug">
            {producto.nombre}
          </h3>
          {producto.proveedor && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Prov: {producto.proveedor}
            </p>
          )}
        </div>

        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
              Precio venta
            </p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ${Number(producto.precio_venta || 0).toLocaleString('es-CO')}
            </p>
          </div>
          {esAdmin && producto.precio_costo !== undefined && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium">
                Costo
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                ${Number(producto.precio_costo || 0).toLocaleString('es-CO')}
              </p>
            </div>
          )}
        </div>

        {/* Botones táctiles cómodos */}
        <div className="grid grid-cols-12 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => agregar(producto)}
            disabled={sinStock}
            className="col-span-6 min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <ShoppingCart size={15} />
            <span>Vender</span>
          </button>

          {esAdmin && (
            <>
              <button
                type="button"
                onClick={() => onMovimiento && onMovimiento(producto)}
                title="Registrar entrada, salida o ajuste de stock"
                className="col-span-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center transition-colors"
              >
                <ArrowUpDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => onEditar(producto)}
                title="Editar producto y fotografía"
                className="col-span-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center transition-colors"
              >
                <Edit3 size={15} />
              </button>
              <button
                type="button"
                onClick={() => onEliminar(producto.id)}
                title="Desactivar producto"
                className="col-span-2 min-h-[44px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
