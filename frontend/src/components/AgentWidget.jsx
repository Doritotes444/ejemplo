import { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Bot,
  X,
  Send,
  RotateCcw,
  Mic,
  MicOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
} from 'lucide-react'
import agentService from '../services/agentService'
import MostradorMode from './voice/MostradorMode'
import { useVoiceAgent } from '../hooks/useVoiceAgent'
import { useAgent } from '../context/AgentContext'

export default function AgentWidget() {
  const { chatAbierto, cerrarChat, modoVozAbierto, abrirModoVoz, cerrarModoVoz } = useAgent()
  const voiceAgent = useVoiceAgent()
  const [mensajes, setMensajes] = useState([
    {
      remitente: 'agente',
      texto: '¡Hola! Soy tu asistente de ventas e inventario. Puedes decirme qué vendiste, pedirme que reabastezca un producto o preguntarme por tus números de hoy.',
      timestamp: new Date(),
    },
  ])
  const [entrada, setEntrada] = useState('')
  const [cargando, setCargando] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [estadoAgente, setEstadoAgente] = useState('IDLE')
  const [clarificationData, setClarificationData] = useState(null)
  const [previewData, setPreviewData] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (chatAbierto) {
      scrollToBottom()
      inputRef.current?.focus()
    }
  }, [chatAbierto, mensajes])

  useEffect(() => {
    if (!chatAbierto) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrarChat()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [chatAbierto, cerrarChat])

  // Inicializar Web Speech API para soporte de voz nativo en navegadores
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'es-CO'

      recognition.onstart = () => setGrabando(true)
      recognition.onend = () => setGrabando(false)
      recognition.onerror = () => setGrabando(false)

      recognition.onresult = (event) => {
        const transcripcion = event.results[0][0].transcript
        if (transcripcion) {
          enviarTexto(transcripcion)
        }
      }

      recognitionRef.current = recognition
    }
  }, [])

  const toggleGrabacion = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta entrada de voz directa. Puedes escribir en el teclado.')
      return
    }

    if (grabando) {
      recognitionRef.current.stop()
    } else {
      try {
        recognitionRef.current.start()
      } catch (err) {
        console.error('Error al iniciar micrófono:', err)
      }
    }
  }

  const enviarTexto = async (textoAEnviar) => {
    const texto = (textoAEnviar || entrada).trim()
    if (!texto || cargando) return

    setEntrada('')
    const nuevoMensajeUsuario = {
      remitente: 'usuario',
      texto,
      timestamp: new Date(),
    }

    setMensajes((prev) => [...prev, nuevoMensajeUsuario])
    setCargando(true)
    setClarificationData(null)

    try {
      const data = await agentService.enviarMensaje(texto)
      setEstadoAgente(data.estado)

      const respuestaAgente = {
        remitente: 'agente',
        texto: data.respuesta,
        estado: data.estado,
        datos: data.datos,
        preview: data.preview,
        idempotente: data.idempotente,
        timestamp: new Date(),
      }

      setMensajes((prev) => [...prev, respuestaAgente])

      if (data.clarification && (data.clarification.options || data.clarification.opciones)) {
        setClarificationData(data.clarification)
      } else {
        setClarificationData(null)
      }

      if (data.preview && data.estado === 'READY_TO_CONFIRM') {
        setPreviewData(data.preview)
      } else {
        setPreviewData(null)
      }

      // Si la operación fue ejecutada con éxito, notificar al resto de la app
      if (data.estado === 'EXECUTED') {
        window.dispatchEvent(new Event('venta-completada'))
      }
    } catch (err) {
      const msg = typeof err?.message === 'string' && err.message !== '[object Object]'
        ? err.message
        : (typeof err === 'string' ? err : 'No pude procesar tu solicitud. Intenta nuevamente.')
      setMensajes((prev) => [
        ...prev,
        {
          remitente: 'agente',
          texto: `⚠️ ${msg}`,
          esError: true,
          timestamp: new Date(),
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  const reiniciarConversacion = () => {
    agentService.resetConversation()
    setEstadoAgente('IDLE')
    setClarificationData(null)
    setPreviewData(null)
    setMensajes([
      {
        remitente: 'agente',
        texto: 'Conversación reiniciada. ¿Qué deseas registrar o consultar?',
        timestamp: new Date(),
      },
    ])
  }

  const sugerenciasRapidas = [
    { label: '¿Cuánto he vendido hoy?', prompt: '¿Cuánto he vendido hoy?', icon: TrendingUp },
    { label: 'Inventario actual', prompt: '¿Cuánto inventario tengo?', icon: Package },
    { label: 'Resumen del día', prompt: 'Dame el resumen de hoy', icon: Sparkles },
  ]

  return (
    <aside aria-label="Asistente Virtual POS" className={`fixed bottom-5 right-5 z-30 flex flex-col items-end ${!chatAbierto ? 'pointer-events-none' : ''}`}>
      {/* Ventana de Chat */}
      {chatAbierto && (
        <section
          aria-label="Ventana de conversación con el Asistente POS"
          className="w-[380px] max-w-[92vw] h-[540px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-auto"
        >
          {/* Header del Asistente */}
          <div className="bg-slate-900 px-4 py-3.5 flex items-center justify-between text-white border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm tracking-tight">Asistente POS</span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300">
                    Pro
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Voz, Ventas e Inventario</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={abrirModoVoz}
                title="Abrir Modo Mostrador Manos Libres"
                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 rounded-lg text-xs font-semibold active:scale-95 transition-all"
              >
                <Mic size={13} className="animate-pulse text-cyan-400" />
                <span className="hidden sm:inline">Modo</span> Voz
              </button>
              <button
                onClick={reiniciarConversacion}
                title="Reiniciar chat"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={cerrarChat}
                title="Cerrar asistente"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50">
            {mensajes.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.remitente === 'usuario' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-xs whitespace-pre-wrap leading-relaxed ${
                    m.remitente === 'usuario'
                      ? 'bg-slate-900 text-white rounded-br-xs'
                      : m.esError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                  }`}
                >
                  {m.texto}

                  {/* Si es una confirmación idempotente repetida */}
                  {m.idempotente && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <AlertTriangle size={12} />
                      Operación ya registrada previamente (Idempotente)
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {/* Chips de Clarificación Rápida */}
            {clarificationData && (
              <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3 my-2 space-y-2">
                <span className="text-xs font-semibold text-indigo-900 block">
                  Toca la opción que buscas:
                </span>
                <div className="flex flex-col gap-1.5">
                  {(clarificationData.options || clarificationData.opciones || []).map((opcion, oIdx) => {
                    const label = opcion.label || opcion.nombre || String(opcion)
                    const valorEnvio = opcion.label ? opcion.label.split('(')[0].trim() : (opcion.nombre || opcion.id || String(oIdx + 1))
                    return (
                      <button
                        key={oIdx}
                        onClick={() => enviarTexto(valorEnvio)}
                        className="w-full text-left px-3 py-2 text-xs font-medium rounded-lg bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-slate-800 shadow-2xs transition-all flex items-center justify-between group"
                      >
                        <span className="truncate">
                          <strong className="mr-1.5 text-indigo-600 group-hover:text-white">
                            [{oIdx + 1}]
                          </strong>
                          {label}
                        </span>
                        <ArrowRight size={13} className="shrink-0 text-slate-400 group-hover:text-white ml-2" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tarjeta de Confirmación de Acción */}
            {previewData && estadoAgente === 'READY_TO_CONFIRM' && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 my-2 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs text-amber-900 font-bold uppercase tracking-wider">
                  <span>Confirmación requerida</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                    {previewData.total ? 'Venta' : 'Operación'}
                  </span>
                </div>

                <div className="bg-white/90 rounded-lg p-2.5 border border-amber-100 text-xs space-y-1.5 text-slate-700">
                  {/* Si es venta con lista de items */}
                  {previewData.items && previewData.items.length > 0 ? (
                    <div className="space-y-1">
                      {previewData.items.map((it, itIdx) => (
                        <div key={itIdx} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0">
                          <div>
                            <span className="font-semibold text-slate-900">{it.nombre}</span>
                            <span className="text-[11px] text-slate-500 ml-1">x {it.cantidad}</span>
                          </div>
                          <span className="font-medium text-slate-800">
                            ${Number(it.subtotal || it.precio_unitario * it.cantidad).toLocaleString('es-CO')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Si es reabastecer o crear producto */
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Producto:</span>
                        <span className="font-semibold text-slate-900">
                          {previewData.producto || previewData.nombre || previewData.producto_nombre}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Cantidad:</span>
                        <span className="font-semibold text-slate-900">
                          {previewData.cantidad || previewData.cantidad_actual} {previewData.unidad || previewData.unidad_medida || ''}
                        </span>
                      </div>
                      {previewData.precio_venta && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Precio Venta:</span>
                          <span className="font-semibold text-emerald-700">
                            ${Number(previewData.precio_venta).toLocaleString('es-CO')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {previewData.total && (
                    <div className="flex justify-between pt-1.5 border-t border-amber-200/60 font-bold text-sm text-emerald-800">
                      <span>Total a Cobrar:</span>
                      <span>${Number(previewData.total).toLocaleString('es-CO')}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => enviarTexto('sí, confirmar')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    Confirmar
                  </button>
                  <button
                    onClick={() => enviarTexto('cancelar')}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-lg border border-rose-200 transition-colors"
                  >
                    <X size={14} />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Spinner de Cargando */}
            {cargando && (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>El asistente está pensando...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias Rápidas Iniciales */}
          {mensajes.length <= 2 && (
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
              {sugerenciasRapidas.map((sug, sIdx) => {
                const IconComponent = sug.icon
                return (
                  <button
                    key={sIdx}
                    onClick={() => enviarTexto(sug.prompt)}
                    className="shrink-0 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 transition-colors font-medium"
                  >
                    <IconComponent size={12} />
                    {sug.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Barra de Entrada de Texto / Voz */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              enviarTexto()
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            {/* Botón de Voz / Micrófono */}
            <button
              type="button"
              onClick={toggleGrabacion}
              title={grabando ? 'Escuchando... clic para parar' : 'Hablar por micrófono'}
              className={`p-2 rounded-xl transition-all ${
                grabando
                  ? 'bg-rose-500 text-white animate-pulse shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {grabando ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder={grabando ? 'Escuchando tu voz...' : "Escribe: 'Vendí 2 arroz'..."}
              disabled={cargando}
              className="flex-1 text-sm bg-slate-100 focus:bg-white rounded-xl px-3 py-2 border border-transparent focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-400"
            />

            <button
              type="submit"
              disabled={!entrada.trim() || cargando}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-colors shadow-xs"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}

      {/* Modal Inmersivo Modo Mostrador */}
      <MostradorMode
        isOpen={modoVozAbierto}
        onClose={cerrarModoVoz}
        voiceAgent={voiceAgent}
      />
    </aside>
  )
}
