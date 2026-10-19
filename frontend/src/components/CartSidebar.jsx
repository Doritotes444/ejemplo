import { useState, useEffect } from 'react'
import {
  X,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  BookOpen,
  Zap,
} from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useVentas } from '../hooks/useVentas'
import { resolverUrlFotoProducto } from '../hooks/useProductos'

const ES_GRANEL = (unidad) => unidad && unidad !== 'unidad'

const METODOS_PAGO = [
  { id: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'Nequi', label: 'Nequi', icon: Smartphone },
  { id: 'DaviPlata', label: 'DaviPlata', icon: Smartphone },
  { id: 'Transferencia', label: 'Transf.', icon: Building2 },
  { id: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { id: 'Fiado', label: 'Fiado', icon: BookOpen },
]

const BILLETES_RAPIDOS = [2000, 5000, 10000, 20000, 50000, 100000]

export default function CartSidebar() {
  const {
    carrito,
    carritoAbierto,
    setCarritoAbierto,
    agregar,
    restar,
    setCantidad,
    eliminar,
    vaciar,
    total,
  } = useCart()
  const { registrar } = useVentas()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [metodoPago, setMetodoPago] = useState('Efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')

  const cambio =
    metodoPago === 'Efectivo' && montoRecibido !== ''
      ? Math.max(0, Number(montoRecibido) - total)
      : 0

  // Atajos de teclado cuando el carrito está abierto
  useEffect(() => {
    if (!carritoAbierto) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setCarritoAbierto(false)
      } else if (e.key === 'F2' && carrito.length > 0 && !procesando) {
        e.preventDefault()
        checkout()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [carritoAbierto, carrito.length, procesando, total, metodoPago, montoRecibido, clienteNombre])

  const checkout = async () => {
    if (!carrito.length || procesando) return
    setProcesando(true)
    setMensaje(null)
    const t0 = performance.now()
    try {
      const detalles = carrito.map((i) => ({ producto_id: i.id, cantidad: i.cantidad }))
      const resultado = await registrar(detalles, {
        metodo_pago: metodoPago,
        monto_recibido:
          metodoPago === 'Efectivo' && montoRecibido !== '' ? Number(montoRecibido) : total,
        cliente_nombre: clienteNombre || null,
        total_estimado: total,
      })
      const ms = Math.round(performance.now() - t0)
      setMensaje({
        tipo: 'ok',
        texto: `${resultado.offline ? 'Venta offline guardada' : 'Venta registrada'} (${ms}ms) — Total: $${Number(resultado.total || total).toLocaleString('es-CO')}${
          cambio > 0 ? ` · Vueltas: $${cambio.toLocaleString('es-CO')}` : ''
        }`,
      })
      vaciar()
      setMontoRecibido('')
      setClienteNombre('')
      window.dispatchEvent(new Event('venta-completada'))
      setTimeout(() => setMensaje(null), 5000)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message })
    } finally {
      setProcesando(false)
    }
  }

  return (
    <>
      {carritoAbierto && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-none z-40 transition-opacity"
          onClick={() => setCarritoAbierto(false)}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${
          carritoAbierto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                Carrito de venta
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {carrito.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Presiona <kbd className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">F2</kbd> para cobrar
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCarritoAbierto(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de productos en el carrito */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {carrito.length === 0 ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium">El carrito está vacío</p>
              <p className="text-xs mt-1">Escanea un código o toca un producto para agregarlo</p>
            </div>
          ) : (
            carrito.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <img
                      src={resolverUrlFotoProducto(item.foto_url, item.nombre)}
                      alt={item.nombre}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {item.nombre}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        ${Number(item.precio_venta || 0).toLocaleString('es-CO')}
                        {ES_GRANEL(item.unidad_medida) && ` / ${item.unidad_medida}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminar(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    title="Quitar del carrito"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  {ES_GRANEL(item.unidad_medida) ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max={item.cantidad_actual}
                        value={item.cantidad}
                        onChange={(e) => setCantidad(item.id, e.target.value)}
                        className="w-20 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2 py-1 text-xs text-center font-medium focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">{item.unidad_medida}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => restar(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => agregar(item)}
                        className="w-7 h-7 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}

                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    ${(Number(item.precio_venta || 0) * Number(item.cantidad || 0)).toLocaleString('es-CO', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {mensaje && (
          <div
            className={`mx-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
              mensaje.tipo === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
            }`}
          >
            {mensaje.tipo === 'ok' ? (
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
            )}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Panel inferior de pago */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
              Método de pago
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {METODOS_PAGO.map((m) => {
                const Icon = m.icon
                const seleccionado = metodoPago === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetodoPago(m.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all min-h-[38px] ${
                      seleccionado
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

          {metodoPago === 'Efectivo' && carrito.length > 0 && (
            <div className="space-y-2 bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setMontoRecibido(String(Math.round(total)))}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                >
                  Exacto
                </button>
                {BILLETES_RAPIDOS.map((billete) => (
                  <button
                    key={billete}
                    type="button"
                    onClick={() => setMontoRecibido(String(billete))}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  >
                    ${(billete / 1000).toLocaleString('es-CO')}k
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                    Recibido ($)
                  </label>
                  <input
                    type="number"
                    placeholder={String(Math.round(total))}
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg px-2.5 py-1 text-right">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase block">
                    Vueltas
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    ${cambio.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {metodoPago === 'Fiado' && carrito.length > 0 && (
            <input
              type="text"
              placeholder="Nombre del cliente fiado..."
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              className="w-full border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          )}

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Total a cobrar
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              ${total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <button
            type="button"
            onClick={checkout}
            disabled={!carrito.length || procesando}
            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-semibold py-3.5 rounded-xl transition-all min-h-[48px] flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Zap size={16} />
            <span>{procesando ? 'Procesando...' : `Cobrar ($${total.toLocaleString('es-CO')})`}</span>
          </button>

          {carrito.length > 0 && (
            <button
              type="button"
              onClick={vaciar}
              className="w-full text-xs text-slate-400 hover:text-rose-500 transition-colors py-1 text-center"
            >
              Vaciar carrito (Esc)
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
