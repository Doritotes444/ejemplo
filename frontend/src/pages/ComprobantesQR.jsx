import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import authService from '../services/authService'
import EscanerModal from '../components/EscanerModal'
import {
  comprimirImagenArchivo,
  guardarComprobanteLocal,
  listarComprobantesLocales,
  encolarOperacionOffline,
  generarClientOperationId,
} from '../services/offlineDB'
import {
  QrCode,
  Camera,
  ShieldCheck,
  ShieldAlert,
  Eye,
  CheckCircle2,
  HardDrive,
  Upload,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

export default function ComprobantesQR() {
  const { usuario } = useAuth()
  const [comprobantes, setComprobantes] = useState([])
  const [localesCount, setLocalesCount] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  // Estado del formulario de captura
  const [metodoPago, setMetodoPago] = useState('Nequi')
  const [monto, setMonto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [pagadorNombre, setPagadorNombre] = useState('')
  const [qrRawData, setQrRawData] = useState('')
  const [qrAnalisis, setQrAnalisis] = useState(null)
  const [fotoDataUrl, setFotoDataUrl] = useState('')
  const [verificadoManualmente, setVerificadoManualmente] = useState(false)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [escanerAbierto, setEscanerAbierto] = useState(false)
  const [comprobanteVista, setComprobanteVista] = useState(null)

  const fileInputRef = useRef(null)

  const cargarComprobantes = useCallback(async () => {
    if (!usuario?.empresa_id) return
    setCargando(true)
    try {
      const locales = await listarComprobantesLocales(usuario.empresa_id)
      setLocalesCount(locales.length)

      const res = await authService.fetchAuth(`${BASE}/comprobantes`)
      if (res.ok) {
        const remotos = await res.json()
        setComprobantes(remotos)
      } else {
        setComprobantes(locales)
      }
    } catch {
      const locales = await listarComprobantesLocales(usuario.empresa_id)
      setComprobantes(locales)
      setLocalesCount(locales.length)
    } finally {
      setCargando(false)
    }
  }, [usuario])

  useEffect(() => {
    cargarComprobantes()
  }, [cargarComprobantes])

  const analizarTextoQR = async (textoQR) => {
    setQrRawData(textoQR)
    try {
      const res = await authService.fetchAuth(`${BASE}/comprobantes/analizar-qr`, {
        method: 'POST',
        body: JSON.stringify({ qr_raw_data: textoQR }),
      })
      if (res.ok) {
        const data = await res.json()
        setQrAnalisis(data)
        if (data.datos_extraidos?.entidad_detectada && data.datos_extraidos.entidad_detectada !== 'Desconocida') {
          setMetodoPago(data.datos_extraidos.entidad_detectada)
        }
        if (data.datos_extraidos?.monto_sugerido && !monto) {
          setMonto(String(data.datos_extraidos.monto_sugerido))
        }
        if (data.datos_extraidos?.referencia_sugerida && !referencia) {
          setReferencia(data.datos_extraidos.referencia_sugerida)
        }
      }
    } catch {
      // Fallback local si está sin conexión
      setQrAnalisis({
        estado_verificacion: 'CAPTURADO_NO_VERIFICADO',
        advertencia_seguridad:
          'Lectura QR capturada localmente. Verifica en tu app bancaria antes de marcar como verificado.',
      })
    }
  }

  const handleSeleccionarImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const comprimida = await comprimirImagenArchivo(file, 900, 0.78)
      setFotoDataUrl(comprimida)
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    }
  }

  const guardarComprobante = async (e) => {
    e.preventDefault()
    if (!fotoDataUrl) {
      setMensaje({
        tipo: 'error',
        texto: 'La fotografía del comprobante es obligatoria para el respaldo.',
      })
      return
    }
    setGuardando(true)
    setMensaje(null)
    const clientOpId = generarClientOperationId('comp')
    const payload = {
      metodo_pago: metodoPago,
      monto: Number(monto) || 0,
      referencia_transaccion: referencia || null,
      pagador_nombre: pagadorNombre || null,
      qr_raw_data: qrRawData || null,
      foto_comprobante_url: fotoDataUrl,
      verificado_manualmente: verificadoManualmente,
      notas: notas || null,
      client_operation_id: clientOpId,
    }

    try {
      // 1. Guardar SIEMPRE una copia en la bóveda local IndexedDB del dispositivo para respaldo del tendero
      await guardarComprobanteLocal({
        id: clientOpId,
        empresa_id: usuario?.empresa_id,
        ...payload,
        estado_verificacion: verificadoManualmente
          ? 'VERIFICADO_MANUALMENTE'
          : 'CAPTURADO_NO_VERIFICADO',
        fecha_captura: new Date().toISOString(),
      })

      // 2. Sincronizar con el servidor (o encolar si está offline)
      if (!navigator.onLine) {
        await encolarOperacionOffline('comprobante', payload, usuario?.empresa_id)
        setMensaje({
          tipo: 'ok',
          texto: '📴 Comprobante respaldado en el dispositivo (IndexedDB). Se subirá al volver internet.',
        })
      } else {
        const res = await authService.fetchAuth(`${BASE}/comprobantes`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al respaldar el comprobante')
        }
        setMensaje({
          tipo: 'ok',
          texto: '✅ Comprobante respaldado en la bóveda local del dispositivo y en el servidor privado.',
        })
      }

      setMonto('')
      setReferencia('')
      setPagadorNombre('')
      setQrRawData('')
      setQrAnalisis(null)
      setFotoDataUrl('')
      setVerificadoManualmente(false)
      setNotas('')
      await cargarComprobantes()
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstadoVerificacion = async (comp, nuevoEstado) => {
    try {
      const res = await authService.fetchAuth(
        `${BASE}/comprobantes/${comp.id}/verificar`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            estado_verificacion: nuevoEstado,
            notas: comp.notas || 'Actualizado desde bóveda de comprobantes',
          }),
        }
      )
      if (res.ok) {
        await cargarComprobantes()
      }
    } catch {
      // Ignorar en modo offline
    }
  }

  const verImagenPrivada = async (comp) => {
    if (comp.foto_comprobante_url) {
      setComprobanteVista(comp)
      return
    }
    try {
      const res = await authService.fetchAuth(`${BASE}/comprobantes/${comp.id}/imagen`)
      if (res.ok) {
        const data = await res.json()
        setComprobanteVista({
          ...comp,
          foto_comprobante_url: data.foto_comprobante_url,
        })
      }
    } catch {
      // Ignorar
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <QrCode className="text-violet-600" size={24} />
            Escáner de Comprobantes QR y Bóveda Fotográfica
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Respalda pantallazos de Nequi, DaviPlata y transferencias con conservación local en tu dispositivo
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700">
          <HardDrive size={16} className="text-violet-600" />
          <span>{localesCount} respaldos guardados en este dispositivo</span>
        </div>
      </div>

      {/* Aviso transparente de alcance técnico (Sección 8) */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">
            Distinción importante: «Comprobante Capturado» vs «Pago Verificado»
          </p>
          <p className="mt-0.5 text-amber-800">
            El escáner extrae datos estructurados del QR y conserva la fotografía privada en tu celular. Como las billeteras digitales no verifican saldos mediante lectura óptica sin API bancaria oficial, confirma que el dinero ingresó a tu cuenta antes de marcarlo como <strong>Verificado Manualmente</strong>.
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna izquierda: Captura de QR + Fotografía obligatoria */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-900">
              Nuevo Respaldo de Comprobante
            </h2>
            <button
              type="button"
              onClick={() => setEscanerAbierto(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
            >
              <QrCode size={15} /> Escanear QR
            </button>
          </div>

          {qrAnalisis && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs space-y-1">
              <p className="font-bold text-violet-900">Datos extraídos del QR:</p>
              <p className="text-violet-800 font-mono break-all text-[11px]">{qrRawData}</p>
              <p className="text-amber-800 font-medium pt-1">
                ⚠️ {qrAnalisis.advertencia_seguridad}
              </p>
            </div>
          )}

          <form onSubmit={guardarComprobante} className="space-y-3.5">
            {/* Captura fotográfica del comprobante */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                1. Fotografía del Comprobante (Obligatoria) *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleSeleccionarImagen}
                className="hidden"
              />
              {fotoDataUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-44">
                  <img
                    src={fotoDataUrl}
                    alt="Vista previa comprobante"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Cambiar foto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-violet-300 hover:border-violet-500 bg-violet-50/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-violet-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Camera size={22} />
                    <Upload size={20} />
                  </div>
                  <span className="text-xs font-bold">
                    Tomar foto al comprobante o subir imagen
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Se comprime y guarda localmente en tu celular
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Billetera / Medio
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                >
                  <option value="Nequi">🟣 Nequi</option>
                  <option value="DaviPlata">🔴 DaviPlata</option>
                  <option value="Transferencia">🏦 Bancolombia / Transf.</option>
                  <option value="Bre-B / QR">⚡ QR Entidad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Monto del pago ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ej: 25000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Referencia / Comprobante
                </label>
                <input
                  type="text"
                  placeholder="Ej: M1928374"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nombre del cliente
                </label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Pérez"
                  value={pagadorNombre}
                  onChange={(e) => setPagadorNombre(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Checkbox de verificación manual asistida */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={verificadoManualmente}
                onChange={(e) => setVerificadoManualmente(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700">
                <strong>Ya revisé mi app bancaria / mensajes</strong> y confirmo que el dinero ingresó realmente (Marcar como <em>Pago Verificado Manualmente</em>).
              </span>
            </label>

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white font-bold py-3.5 rounded-xl text-sm min-h-[48px]"
            >
              {guardando
                ? 'Guardando respaldo...'
                : 'Guardar Respaldo Fotográfico'}
            </button>
          </form>
        </div>

        {/* Columna derecha: Historial de Comprobantes con Distinción de Estado */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-base text-slate-900">
            Historial de Comprobantes Respaldados ({comprobantes.length})
          </h2>

          {cargando ? (
            <p className="text-xs text-slate-400 py-8 text-center">Cargando comprobantes...</p>
          ) : comprobantes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Aún no has capturado comprobantes digitales.
            </div>
          ) : (
            <div className="space-y-3">
              {comprobantes.map((c) => {
                const verificado = c.estado_verificacion === 'VERIFICADO_MANUALMENTE'
                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          ${fmt(c.monto)}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          {c.metodo_pago}
                        </span>
                        {verificado ? (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <ShieldCheck size={13} /> PAGO VERIFICADO MANUALMENTE
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                            <ShieldAlert size={13} /> CAPTURADO (SIN VERIFICAR EN BANCO)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Ref: {c.referencia_transaccion || 'Sin ref'} · Cliente:{' '}
                        {c.pagador_nombre || 'Mostrador'} ·{' '}
                        {c.fecha_captura
                          ? new Date(c.fecha_captura).toLocaleString('es-CO')
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => verImagenPrivada(c)}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1"
                      >
                        <Eye size={14} /> Ver Foto
                      </button>
                      {!verificado && (
                        <button
                          type="button"
                          onClick={() =>
                            cambiarEstadoVerificacion(c, 'VERIFICADO_MANUALMENTE')
                          }
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 size={14} /> Verificar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Escáner QR */}
      {escanerAbierto && (
        <EscanerModal
          onDetect={(codigo) => {
            setEscanerAbierto(false)
            analizarTextoQR(codigo)
          }}
          onClose={() => setEscanerAbierto(false)}
        />
      )}

      {/* Modal Visor Privado de Comprobante */}
      {comprobanteVista && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setComprobanteVista(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Respaldo Privado · {comprobanteVista.metodo_pago} ($
                {fmt(comprobanteVista.monto)})
              </h3>
              <button
                type="button"
                onClick={() => setComprobanteVista(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 max-h-[65vh] flex items-center justify-center">
              <img
                src={comprobanteVista.foto_comprobante_url}
                alt="Comprobante privado"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
