import { useEffect, useState } from 'react'
import {
  Menu,
  ShoppingCart,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Store,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useAgent } from '../../context/AgentContext'
import ProfileDropdown from './ProfileDropdown'
import {
  obtenerColaOffline,
  sincronizarColaPendiente,
  eliminarOperacionCola,
} from '../../services/offlineDB'

export default function Header({ onMenuToggle }) {
  const { usuario } = useAuth()
  const { carrito, setCarritoAbierto } = useCart()
  const {
    esTrialActivo,
    trialExpirado,
    esPlanPro,
    diasTrialRestantes,
    abrirUpsell,
  } = useAgent()

  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [cola, setCola] = useState([])
  const [sincronizando, setSincronizando] = useState(false)
  const [modalSyncAbierto, setModalSyncAbierto] = useState(false)

  const refrescarEstadoCola = async () => {
    const items = await obtenerColaOffline()
    setCola(items)
  }

  useEffect(() => {
    refrescarEstadoCola()

    const handleOnline = () => {
      setOnline(true)
      refrescarEstadoCola()
    }
    const handleOffline = () => {
      setOnline(false)
      refrescarEstadoCola()
    }
    const handleSyncUpdate = (e) => {
      if (e.detail?.estado === 'SINCRONIZANDO') {
        setSincronizando(true)
      } else {
        setSincronizando(false)
      }
      refrescarEstadoCola()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('tiendapp:sync-update', handleSyncUpdate)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('tiendapp:sync-update', handleSyncUpdate)
    }
  }, [])

  const pendientes = cola.filter((i) => i.estado === 'PENDIENTE')
  const conflictos = cola.filter(
    (i) => i.estado === 'CONFLICTO' || i.estado === 'ERROR'
  )

  let estadoSyncTexto = 'En línea'
  let estadoSyncClase =
    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
  let IconoSync = CheckCircle2

  if (sincronizando) {
    estadoSyncTexto = 'Sincronizando...'
    estadoSyncClase =
      'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
    IconoSync = RefreshCw
  } else if (conflictos.length > 0) {
    estadoSyncTexto = `Conflicto (${conflictos.length})`
    estadoSyncClase =
      'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    IconoSync = AlertTriangle
  } else if (!online && pendientes.length > 0) {
    estadoSyncTexto = `Local (${pendientes.length})`
    estadoSyncClase =
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    IconoSync = WifiOff
  } else if (!online) {
    estadoSyncTexto = 'Sin conexión'
    estadoSyncClase =
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    IconoSync = WifiOff
  } else if (pendientes.length > 0) {
    estadoSyncTexto = `Pendiente (${pendientes.length})`
    estadoSyncClase =
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
    IconoSync = RefreshCw
  }

  const handleSincronizarManual = async () => {
    setSincronizando(true)
    await sincronizarColaPendiente()
    await refrescarEstadoCola()
    setSincronizando(false)
  }

  const cantidadTotalCarrito = carrito.reduce(
    (s, i) => s + Number(i.cantidad || 0),
    0
  )

  return (
    <>
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 shrink-0 transition-colors">
        {/* Lado izquierdo: Menú móvil + Logo */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onMenuToggle}
            aria-label="Abrir menú de navegación"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Store size={18} strokeWidth={2.4} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                Tiendapp
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                Gestión Inteligente
              </span>
            </div>
          </div>
        </div>

        {/* Lado derecho: Estado Sync + Badges + Carrito + Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Indicador visible de conexión y sincronización */}
          <button
            type="button"
            onClick={() => setModalSyncAbierto(true)}
            className={`h-9 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${estadoSyncClase}`}
            title="Ver estado de conexión y sincronización local"
          >
            <IconoSync
              size={14}
              className={sincronizando ? 'animate-spin' : ''}
            />
            <span className="hidden sm:inline">{estadoSyncTexto}</span>
            {(pendientes.length > 0 || conflictos.length > 0) && (
              <span className="sm:hidden font-bold">
                {pendientes.length + conflictos.length}
              </span>
            )}
          </button>

          {/* Badge de Plan / Trial */}
          {esTrialActivo && (
            <button
              type="button"
              onClick={() => abrirUpsell('conocer_pro')}
              className="hidden lg:flex items-center gap-1 h-9 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Prueba ({diasTrialRestantes}d)</span>
            </button>
          )}

          {trialExpirado && (
            <button
              type="button"
              onClick={() => abrirUpsell('trial_vencido')}
              className="hidden lg:flex items-center gap-1 h-9 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-semibold"
            >
              <span>Elegir Plan</span>
            </button>
          )}

          {/* Botón Carrito de venta rápida */}
          <button
            type="button"
            onClick={() => setCarritoAbierto((prev) => !prev)}
            className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Ver carrito de venta"
          >
            <ShoppingCart size={15} />
            <span className="hidden sm:inline">Carrito</span>
            {cantidadTotalCarrito > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                {cantidadTotalCarrito}
              </span>
            )}
          </button>

          {/* Menú de Perfil Interactivo */}
          <ProfileDropdown />
        </div>
      </header>

      {/* Modal de Estado de Sincronización Offline */}
      {modalSyncAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {online ? (
                  <Wifi size={18} className="text-emerald-600" />
                ) : (
                  <WifiOff size={18} className="text-amber-500" />
                )}
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Estado de Conexión y Sincronización
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalSyncAbierto(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {online ? 'Conectado al servidor' : 'Modo sin conexión'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {online
                      ? 'Las ventas y movimientos se guardan y sincronizan automáticamente.'
                      : 'Puedes seguir vendiendo; las operaciones se almacenan de forma segura en este celular.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!online || sincronizando || cola.length === 0}
                  onClick={handleSincronizarManual}
                  className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 transition"
                >
                  <RefreshCw
                    size={13}
                    className={sincronizando ? 'animate-spin' : ''}
                  />
                  <span>Sincronizar ahora</span>
                </button>
              </div>

              {cola.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <CheckCircle2
                    size={28}
                    className="mx-auto text-emerald-600 mb-2"
                  />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Todo está al día
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    No hay operaciones pendientes por sincronizar en este dispositivo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Operaciones pendientes ({cola.length})
                  </p>
                  {cola.map((item) => (
                    <div
                      key={item.client_operation_id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.estado === 'PENDIENTE'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {item.estado === 'PENDIENTE'
                              ? 'Pendiente'
                              : 'Revisión'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            #{item.client_operation_id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                          {item.resumen}
                        </p>
                        {item.detalle_error && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                            {item.detalle_error}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await eliminarOperacionCola(item.client_operation_id)
                          await refrescarEstadoCola()
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Descartar de la cola"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
