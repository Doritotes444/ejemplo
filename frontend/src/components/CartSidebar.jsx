import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { useVentas } from '../hooks/useVentas'

const ES_GRANEL = (unidad) => unidad && unidad !== 'unidad'

const METODOS_PAGO = [
  { id: 'Efectivo', label: '💵 Efectivo' },
  { id: 'Nequi', label: '🟣 Nequi' },
  { id: 'DaviPlata', label: '🔴 DaviPlata' },
  { id: 'Transferencia', label: '🏦 Transf.' },
  { id: 'Tarjeta', label: '💳 Tarjeta' },
  { id: 'Fiado', label: '📒 Fiado' },
]

export default function CartSidebar() {
  const { carrito, carritoAbierto, setCarritoAbierto, agregar, restar, setCantidad, eliminar, vaciar, total } =
    useCart()
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

  const checkout = async () => {
    if (!carrito.length) return
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
        texto: `${resultado.offline ? '📴 Guardada Offline' : '✅ Venta registrada'} (${ms}ms) — Total: $${Number(resultado.total || total).toLocaleString('es-CO')}${
          cambio > 0 ? ` · Cambio: $${cambio.toLocaleString('es-CO')}` : ''
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
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setCarritoAbierto(false)}
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ${
          carritoAbierto ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-lg text-slate-800">Carrito de Caja</h2>
            <p className="text-xs text-slate-400">Cobro rápido en menos de 3 segundos</p>
          </div>
          <button
            onClick={() => setCarritoAbierto(false)}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {carrito.length === 0 ? (
            <p className="text-center text-gray-400 mt-10 text-sm">El carrito está vacío</p>
          ) : (
            carrito.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {item.foto_url && (
                      <img
                        src={item.foto_url}
                        alt={item.nombre}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{item.nombre}</p>
                      <p className="text-violet-600 text-xs font-medium">
                        ${item.precio_venta.toLocaleString('es-CO')}
                        {ES_GRANEL(item.unidad_medida) && ` / ${item.unidad_medida}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => eliminar(item.id)}
                    className="text-red-400 hover:text-red-600 text-sm shrink-0 p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  {ES_GRANEL(item.unidad_medida) ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max={item.cantidad_actual}
                        value={item.cantidad}
                        onChange={(e) => setCantidad(item.id, e.target.value)}
                        className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <span className="text-xs text-gray-500">{item.unidad_medida}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => restar(item.id)}
                        className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.cantidad}</span>
                      <button
                        onClick={() => agregar(item)}
                        className="w-8 h-8 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  )}

                  {ES_GRANEL(item.unidad_medida) ? (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500 font-semibold">$</span>
                      <input
                        type="number"
                        min="0"
                        value={Math.round(item.precio_venta * item.cantidad)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setCantidad(item.id, val / item.precio_venta)
                        }}
                        className="w-20 border border-gray-300 bg-white rounded-md px-1 py-1 text-sm text-right font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-slate-800">
                      ${(item.precio_venta * item.cantidad).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {mensaje && (
          <div
            className={`mx-4 p-3 rounded-xl text-xs font-medium ${
              mensaje.tipo === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/60">
          {/* Método de pago rápido */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Método de Pago
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {METODOS_PAGO.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodoPago(m.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    metodoPago === m.id
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {metodoPago === 'Efectivo' && carrito.length > 0 && (
            <div className="grid grid-cols-2 gap-2 items-center">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-0.5">
                  Recibido ($)
                </label>
                <input
                  type="number"
                  placeholder={String(Math.round(total))}
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-right">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                  Cambio a devolver
                </span>
                <span className="text-sm font-extrabold text-emerald-700">
                  ${cambio.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          )}

          {metodoPago === 'Fiado' && carrito.length > 0 && (
            <input
              type="text"
              placeholder="Nombre del cliente (fiado)..."
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              className="w-full border border-amber-300 bg-amber-50/40 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}

          <div className="flex justify-between items-baseline font-bold text-lg pt-1">
            <span className="text-slate-700">Total a cobrar</span>
            <span className="text-2xl font-extrabold text-violet-700">
              ${total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <button
            onClick={checkout}
            disabled={!carrito.length || procesando}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors min-h-[48px] shadow-sm"
          >
            {procesando ? 'Procesando...' : `Cobrar con ${metodoPago}`}
          </button>
          {carrito.length > 0 && (
            <button
              onClick={vaciar}
              className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors py-1"
            >
              Vaciar carrito
            </button>
          )}
        </div>
      </div>
    </>
  )
}
