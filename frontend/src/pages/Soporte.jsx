import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import {
  MessageSquare,
  Plus,
  X,
  Send,
  RefreshCw,
  AlertTriangle,
  InboxIcon,
  ChevronRight,
  BookOpen,
  Play,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'

function estadoBadge(estado) {
  const map = {
    abierto: 'bg-amber-100 text-amber-800 border border-amber-200',
    respondido: 'bg-green-100 text-green-800 border border-green-200',
    cerrado: 'bg-slate-100 text-slate-600 border border-slate-200',
  }
  return map[estado] ?? 'bg-slate-100 text-slate-600 border border-slate-200'
}

function formatearFecha(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export default function Soporte() {
  const { usuario } = useAuth()

  // Lista de tickets
  const [tickets, setTickets] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState(null)

  // Ticket seleccionado (con mensajes)
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)

  // Modal nuevo ticket
  const [mostrarModal, setMostrarModal] = useState(false)
  const [nuevoTicket, setNuevoTicket] = useState({ asunto: '', mensaje: '' })
  const [enviandoTicket, setEnviandoTicket] = useState(false)
  const [errorModal, setErrorModal] = useState(null)

  // Respuesta en el hilo
  const [respuesta, setRespuesta] = useState('')
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false)
  const [errorRespuesta, setErrorRespuesta] = useState(null)

  const hiloRef = useRef(null)

  // ── Carga de tickets ─────────────────────────────────────────────────────────

  const cargarTickets = async () => {
    setCargandoLista(true)
    setErrorLista(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/soporte/tickets`)
      if (!res.ok) throw new Error('No se pudo cargar la lista de tickets')
      const data = await res.json()
      setTickets(data)
    } catch (e) {
      setErrorLista(e.message)
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    cargarTickets()
  }, [])

  // ── Seleccionar ticket (carga detalle con mensajes) ──────────────────────────

  const seleccionarTicket = async (id) => {
    setCargandoDetalle(true)
    setErrorDetalle(null)
    setTicketSeleccionado(null)
    setRespuesta('')
    setErrorRespuesta(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/soporte/tickets/${id}`)
      if (!res.ok) throw new Error('No se pudo cargar el ticket')
      const data = await res.json()
      setTicketSeleccionado(data)
    } catch (e) {
      setErrorDetalle(e.message)
    } finally {
      setCargandoDetalle(false)
    }
  }

  // Scroll al fondo del hilo cuando carga o llegan mensajes nuevos
  useEffect(() => {
    if (hiloRef.current) {
      hiloRef.current.scrollTop = hiloRef.current.scrollHeight
    }
  }, [ticketSeleccionado])

  // ── Crear nuevo ticket ───────────────────────────────────────────────────────

  const crearTicket = async (e) => {
    e.preventDefault()
    if (!nuevoTicket.asunto.trim() || !nuevoTicket.mensaje.trim()) {
      setErrorModal('El asunto y el mensaje son obligatorios.')
      return
    }
    setEnviandoTicket(true)
    setErrorModal(null)
    try {
      const res = await authService.fetchAuth(`${BASE}/soporte/tickets`, {
        method: 'POST',
        body: JSON.stringify(nuevoTicket),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'No se pudo crear el ticket')
      }
      setMostrarModal(false)
      setNuevoTicket({ asunto: '', mensaje: '' })
      await cargarTickets()
    } catch (e) {
      setErrorModal(e.message)
    } finally {
      setEnviandoTicket(false)
    }
  }

  // ── Enviar respuesta ─────────────────────────────────────────────────────────

  const enviarRespuesta = async (e) => {
    e.preventDefault()
    if (!respuesta.trim()) return
    setEnviandoRespuesta(true)
    setErrorRespuesta(null)
    try {
      const res = await authService.fetchAuth(
        `${BASE}/soporte/tickets/${ticketSeleccionado.id}/responder`,
        {
          method: 'POST',
          body: JSON.stringify({ mensaje: respuesta }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'No se pudo enviar la respuesta')
      }
      setRespuesta('')
      // Recarga el detalle para mostrar el nuevo mensaje
      await seleccionarTicket(ticketSeleccionado.id)
      // También actualiza la lista (el estado puede haber cambiado)
      await cargarTickets()
    } catch (e) {
      setErrorRespuesta(e.message)
    } finally {
      setEnviandoRespuesta(false)
    }
  }

  // Estado modal tutorial permanente
  const [videoTutorialAbierto, setVideoTutorialAbierto] = useState(false)
  const [guiaReiniciada, setGuiaReiniciada] = useState(false)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Modal de Video Tutorial */}
      {videoTutorialAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-4 sm:p-6 relative shadow-2xl space-y-4">
            <div className="flex items-center justify-between text-white pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Play size={18} className="text-emerald-500" />
                <h3 className="font-bold text-sm sm:text-base">Guía: ¿Cómo funciona Tiendapp?</h3>
              </div>
              <button
                type="button"
                onClick={() => setVideoTutorialAbierto(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Cerrar video"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video
                controls
                autoPlay
                className="w-full h-full object-contain"
              >
                <source src="/Grabación de pantalla 2026-06-03 115051.mp4" type="video/mp4" />
                Tu navegador no soporta la reproducción de video HTML5.
              </video>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Demostración guiada de productos, cobro en mostrador y consulta de ganancias.
            </p>
          </div>
        </div>
      )}

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="text-slate-700 dark:text-slate-300 w-6 h-6" />
            Centro de Ayuda
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aprende a usar la plataforma o solicita acompañamiento del equipo.
          </p>
        </div>
        <button
          onClick={cargarTickets}
          className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          title="Actualizar lista"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {/* Tarjeta Educativa Permanente: Aprender a usar Tiendapp */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Aprender a usar Tiendapp
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consulta en cualquier momento la demostración guiada en video o reactiva los pasos en tu inicio.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setVideoTutorialAbierto(true)}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-xs"
          >
            <Play size={14} className="fill-current" />
            <span>Ver video tutorial</span>
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('guia_primeros_pasos_oculta')
              setGuiaReiniciada(true)
              setTimeout(() => setGuiaReiniciada(false), 3000)
            }}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {guiaReiniciada ? '✓ Guía visible en Inicio' : 'Reactivar guía de pasos'}
          </button>
        </div>
      </div>

      {/* Layout de dos paneles */}
      <div className="flex flex-1 gap-4 min-h-0" style={{ height: 'calc(100vh - 270px)' }}>

        {/* Panel izquierdo — lista de tickets */}
        <div className="w-full sm:w-72 lg:w-80 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Botón nuevo ticket */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setMostrarModal(true)
                setErrorModal(null)
                setNuevoTicket({ asunto: '', mensaje: '' })
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Nuevo Ticket
            </button>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {cargandoLista ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-slate-400" />
                <span className="text-sm text-slate-400">Cargando tickets...</span>
              </div>
            ) : errorLista ? (
              <div className="p-4">
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {errorLista}
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <InboxIcon className="w-10 h-10" />
                <span className="text-sm">Sin tickets aún</span>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => {
                  const esSeleccionado = ticketSeleccionado?.id === t.id
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => seleccionarTicket(t.id)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-2 group ${
                          esSeleccionado
                            ? 'bg-slate-100 dark:bg-slate-800 border-l-2 border-l-slate-900 dark:border-l-white'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {t.asunto}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${estadoBadge(t.estado)}`}
                            >
                              {t.estado}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                              {formatearFecha(t.created_at)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 flex-shrink-0 mt-1" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Panel derecho — detalle del ticket */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm min-w-0">
          {cargandoDetalle ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <RefreshCw className="w-7 h-7 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Cargando conversación...</span>
            </div>
          ) : errorDetalle ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm flex items-start gap-2 max-w-md">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {errorDetalle}
              </div>
            </div>
          ) : !ticketSeleccionado ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-12 h-12" />
              <p className="text-base font-medium">Selecciona un ticket</p>
              <p className="text-sm">Elige un ticket de la lista para ver la conversación.</p>
            </div>
          ) : (
            <>
              {/* Cabecera del ticket */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {ticketSeleccionado.asunto}
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      Abierto el {formatearFecha(ticketSeleccionado.created_at)}
                    </p>
                  </div>
                  <span
                    className={`inline-block text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${estadoBadge(
                      ticketSeleccionado.estado
                    )}`}
                  >
                    {ticketSeleccionado.estado}
                  </span>
                </div>
              </div>

              {/* Hilo de mensajes */}
              <div
                ref={hiloRef}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
              >
                {ticketSeleccionado.mensajes && ticketSeleccionado.mensajes.length > 0 ? (
                  ticketSeleccionado.mensajes.map((msg) => {
                    const esUsuario = msg.remitente_rol === 'usuario'
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${esUsuario ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-lg px-4 py-3 rounded-2xl text-sm shadow-xs ${
                            esUsuario
                              ? 'bg-slate-900 dark:bg-slate-800 text-white rounded-br-sm'
                              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200/60 dark:border-slate-700'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.mensaje}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1">
                          <span
                            className={`text-xs font-medium ${
                              esUsuario ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {esUsuario ? 'Tú' : 'Soporte'}
                          </span>
                          <span className="text-xs text-slate-300 dark:text-slate-600">
                            {formatearFecha(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
                    Sin mensajes en este ticket.
                  </div>
                )}
              </div>

              {/* Caja de respuesta */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                {ticketSeleccionado.estado === 'cerrado' ? (
                  <div className="text-center text-sm text-slate-400 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    Este ticket está cerrado. No se pueden agregar más respuestas.
                  </div>
                ) : (
                  <form onSubmit={enviarRespuesta} className="flex flex-col gap-2">
                    {errorRespuesta && (
                      <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-2 rounded-xl text-xs flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {errorRespuesta}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={respuesta}
                        onChange={(e) => setRespuesta(e.target.value)}
                        placeholder="Escribe tu respuesta..."
                        rows={3}
                        className="flex-1 resize-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition"
                      />
                      <button
                        type="submit"
                        disabled={enviandoRespuesta || !respuesta.trim()}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 font-semibold px-5 py-3 rounded-xl transition-colors flex-shrink-0 shadow-xs"
                      >
                        {enviandoRespuesta ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Enviar Respuesta</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal — Nuevo Ticket */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
            {/* Cerrar */}
            <button
              onClick={() => setMostrarModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              Nuevo Ticket de Soporte
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5">
              Describe tu problema y nuestro equipo te responderá a la brevedad.
            </p>

            <form onSubmit={crearTicket} className="space-y-4">
              {errorModal && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {errorModal}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Asunto
                </label>
                <input
                  type="text"
                  value={nuevoTicket.asunto}
                  onChange={(e) =>
                    setNuevoTicket((prev) => ({ ...prev, asunto: e.target.value }))
                  }
                  placeholder="Ej: No puedo registrar una venta"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  value={nuevoTicket.mensaje}
                  onChange={(e) =>
                    setNuevoTicket((prev) => ({ ...prev, mensaje: e.target.value }))
                  }
                  placeholder="Describe el problema con el mayor detalle posible..."
                  rows={5}
                  className="w-full resize-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoTicket}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-xs"
                >
                  {enviandoTicket ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
