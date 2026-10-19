import { useEffect, useState } from 'react'
import {
  Menu,
  LogOut,
  ShoppingCart,
  Sparkles,
  Mic,
  Bot,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useAgent } from '../../context/AgentContext'
import { isAdmin } from '../../utils/permissions'
import {
  obtenerColaOffline,
  sincronizarColaPendiente,
  eliminarOperacionCola,
} from '../../services/offlineDB'

export default function Header({ onMenuToggle }) {
  const { usuario, logout } = useAuth()
  const { carrito, setCarritoAbierto } = useCart()
  const {
    tieneAccesoPro,
    esTrialActivo,
    trialExpirado,
    esPlanPro,
    diasTrialRestantes,
    chatAbierto,
    abrirModoVoz,
    toggleChat,
    abrirUpsell,
  } = useAgent()

  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [cola, setCola] = useState([])
  const [sincronizando, setSincronizando] = useState(false)
  const [modalSyncAbierto, setModalSyncAbierto] = useState(false)

  const esAdmin = isAdmin(usuario)
  const nombreMostrar =
    usuario?.nombre?.trim() || usuario?.email?.split('@')[0] || 'Usuario'
  const rolTexto = esAdmin ? 'Administrador' : 'Cajero'

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

  let estadoSyncTexto = 'Sincronizado'
  let estadoSyncClase =
    'bg-emerald-950 text-emerald-300 border-emerald-700/70'
  let IconoSync = CheckCircle2

  if (sincronizando) {
    estadoSyncTexto = 'Sincronizando...'
    estadoSyncClase = 'bg-blue-950 text-blue-300 border-blue-700'
    IconoSync = RefreshCw
  } else if (conflictos.length > 0) {
    estadoSyncTexto = `Conflicto pendiente (${conflictos.length})`
    estadoSyncClase = 'bg-red-950 text-red-300 border-red-700'
    IconoSync = AlertTriangle
  } else if (!online && pendientes.length > 0) {
    estadoSyncTexto = `Guardado local (${pendientes.length})`
    estadoSyncClase = 'bg-amber-950 text-amber-300 border-amber-700'
    IconoSync = WifiOff
  } else if (!online) {
    estadoSyncTexto = 'Sin conexión · Modo local'
    estadoSyncClase = 'bg-amber-950 text-amber-300 border-amber-700'
    IconoSync = WifiOff
  } else if (pendientes.length > 0) {
    estadoSyncTexto = `Pendiente de sincronizar (${pendientes.length})`
    estadoSyncClase = 'bg-amber-950 text-amber-300 border-amber-700'
    IconoSync = RefreshCw
  }

  const handleSincronizarManual = async () => {
    setSincronizando(true)
    await sincronizarColaPendiente()
    await refrescarEstadoCola()
    setSincronizando(false)
  }

  return (
    <>
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-6 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onMenuToggle}
            aria-label="Abrir menú de navegación"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors md:hidden"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">
              Tiendapp
            </span>
            <span className="hidden lg:inline-block text-slate-400 text-xs font-medium">
              · Gestión Neiva
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Indicador visible de conexión y sincronización (Sección 13) */}
          <button
            type="button"
            onClick={() => setModalSyncAbierto(true)}
            className={`min-h-[38px] px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${estadoSyncClase}`}
            title="Ver estado de conexión y cola de sincronización local"
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

          {/* Suscripción / Trial */}
          {esTrialActivo && (
            <button
              type="button"
              onClick={() => abrirUpsell('conocer_pro')}
              className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-950 hover:bg-blue-900 border border-blue-700 text-blue-200 text-xs font-semibold transition-colors"
            >
              <Sparkles size={13} className="text-amber-300" />
              <span>Prueba ({diasTrialRestantes}d)</span>
            </button>
          )}

          {trialExpirado && (
            <button
              type="button"
              onClick={() => abrirUpsell('trial_vencido')}
              className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-700 text-amber-300 text-xs font-bold"
            >
              <span>Planes</span>
            </button>
          )}

          {esPlanPro && (
            <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700 text-xs font-bold">
              Plan Pro
            </span>
          )}

          {/* Voz y Chat IA */}
          <button
            type="button"
            onClick={abrirModoVoz}
            className="hidden sm:flex min-h-[38px] items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            title="Modo voz"
          >
            <Mic size={14} className="text-blue-400" />
            <span className="hidden md:inline">Voz</span>
          </button>

          <button
            type="button"
            onClick={toggleChat}
            className={`hidden sm:flex min-h-[38px] items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              chatAbierto
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Asistente IA"
          >
            <Bot size={14} />
            <span className="hidden md:inline">IA</span>
          </button>

          {/* Botón Carrito rápido */}
          <button
            type="button"
            onClick={() => setCarritoAbierto((prev) => !prev)}
            className="min-h-[40px] flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            title="Abrir carrito actual"
          >
            <ShoppingCart size={16} />
            <span className="hidden sm:inline">Carrito</span>
            {carrito.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white text-blue-900 text-[11px] font-extrabold leading-none">
                {carrito.reduce((s, i) => s + Number(i.cantidad || 0), 0)}
              </span>
            )}
          </button>

          {/* Identidad del usuario */}
          <div className="hidden md:flex items-center gap-2 text-slate-200 text-xs pl-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold">
              {nombreMostrar.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-white truncate max-w-[120px] leading-tight">
                {nombreMostrar}
              </span>
              <span className="text-[10px] text-slate-400">{rolTexto}</span>
            </div>
          </div>

          <button
            onClick={logout}
            aria-label="Cerrar sesión"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center gap-1 text-slate-300 hover:text-red-400 hover:bg-slate-800 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
            <span className="hidden xl:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Modal de Estado de Sincronización Offline y Conflictos */}
      {modalSyncAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                {online ? (
                  <Wifi size={18} className="text-emerald-600" />
                ) : (
                  <WifiOff size={18} className="text-amber-600" />
                )}
                <h2 className="text-base font-bold text-slate-900">
                  Estado de Conexión y Sincronización
                </h2>
              </div>
              <button
                onClick={() => setModalSyncAbierto(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {online ? 'Conectado al servidor' : 'Modo sin conexión activo'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {online
                      ? 'Las operaciones se sincronizan automáticamente con idempotencia.'
                      : 'Puedes seguir vendiendo y registrando comprobantes; se guardan en IndexedDB.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!online || sincronizando || cola.length === 0}
                  onClick={handleSincronizarManual}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
                  Sincronizar ahora
                </button>
              </div>

              {cola.length === 0 ? (
                <div className="text-center py-6 text-slate-600">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">
                    Todo está sincronizado
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    No hay operaciones pendientes ni conflictos en este dispositivo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cola de operaciones en dispositivo ({cola.length})
                  </p>
                  {cola.map((item) => (
                    <div
                      key={item.client_operation_id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.estado === 'PENDIENTE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.estado === 'PENDIENTE'
                              ? 'Pendiente de sincronización'
                              : 'Conflicto pendiente de revisión'}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            #{item.client_operation_id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {item.resumen}
                        </p>
                        {item.detalle_error && (
                          <p className="text-xs text-red-600 mt-1">
                            Motivo: {item.detalle_error}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await eliminarOperacionCola(item.client_operation_id)
                          await refrescarEstadoCola()
                        }}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Descartar operación de la cola local"
                      >
                        <Trash2 size={15} />
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
