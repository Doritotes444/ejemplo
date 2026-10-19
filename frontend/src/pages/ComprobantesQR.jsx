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
  X,
  Smartphone,
  Building2,
  Check,
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL || '/api'
const fmt = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const METODOS = [
  { id: 'Nequi', label: 'Nequi' },
  { id: 'DaviPlata', label: 'DaviPlata' },
  { id: 'Transferencia', label: 'Bancolombia / Transf.' },
  { id: 'QR', label: 'QR Bancario' },
]

export default function ComprobantesQR() {
  const { usuario } = useAuth()
  const [comprobantes, setComprobantes] = useState([])
  const [localesCount, setLocalesCount] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState(null)

  // Formulario de captura
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

      const mapaLocales = new Map()
      locales.forEach((l) => {
        if (l.client_operation_id) mapaLocales.set(l.client_operation_id, l)
        if (l.id) mapaLocales.set(l.id, l)
      })

      const res = await authService.fetchAuth(`${BASE}/comprobantes`)
      if (res.ok) {
        const remotos = await res.json()
        const combinados = remotos.map((r) => {
          const local =
            (r.client_operation_id && mapaLocales.get(r.client_operation_id)) ||
            (r.id && mapaLocales.get(r.id))
          return {
            ...r,
            foto_comprobante_url: local?.foto_comprobante_url || r.foto_comprobante_url || null,
            tiene_foto_local: Boolean(local?.foto_comprobante_url),
          }
        })
        const idsRemotos = new Set(remotos.map((r) => r.client_operation_id || r.id))
        const soloLocales = locales.filter(
          (l) => !idsRemotos.has(l.client_operation_id) && !idsRemotos.has(l.id)
        )
        setComprobantes([...soloLocales, ...combinados])
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
        if (
          data.datos_extraidos?.entidad_detectada &&
          data.datos_extraidos.entidad_detectada !== 'Desconocida'
        ) {
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
      setQrAnalisis({
        estado_verificacion: 'CAPTURADO_NO_VERIFICADO',
        advertencia_seguridad:
          'Lectura QR capturada localmente. Confirma el ingreso en tu app bancaria antes de entregar el producto.',
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
        texto: 'La fotografía del comprobante es obligatoria para el respaldo privado.',
      })
      return
    }
    setGuardando(true)
    setMensaje(null)
    const clientOpId = generarClientOperationId('comp')

    // 1. Guardar copia completa (con fotografía en alta resolución) en la base de datos local IndexedDB
    const itemLocal = {
      id: clientOpId,
      empresa_id: usuario?.empresa_id,
      metodo_pago: metodoPago,
      monto: Number(monto) || 0,
      referencia_transaccion: referencia || null,
      pagador_nombre: pagadorNombre || null,
      qr_raw_data: qrRawData || null,
      foto_comprobante_url: fotoDataUrl,
      verificado_manualmente: verificadoManualmente,
      estado_verificacion: verificadoManualmente
        ? 'VERIFICADO_MANUALMENTE'
        : 'CAPTURADO_NO_VERIFICADO',
      notas: notas || null,
      client_operation_id: clientOpId,
      fecha_captura: new Date().toISOString(),
    }
    await guardarComprobanteLocal(itemLocal)

    // 2. Metadatos que viajan al servidor (NUNCA se sube el peso de la imagen)
    const payloadServidor = {
      metodo_pago: metodoPago,
      monto: Number(monto) || 0,
      referencia_transaccion: referencia || null,
      pagador_nombre: pagadorNombre || null,
      qr_raw_data: qrRawData || null,
      verificado_manualmente: verificadoManualmente,
      notas: notas || null,
      client_operation_id: clientOpId,
    }

    try {
      if (!navigator.onLine) {
        await encolarOperacionOffline('comprobante', payloadServidor, usuario?.empresa_id)
        setMensaje({
          tipo: 'ok',
          texto: 'Comprobante y foto respaldados localmente (IndexedDB). Se sincronizará al volver la conexión.',
        })
      } else {
        const res = await authService.fetchAuth(`${BASE}/comprobantes`, {
          method: 'POST',
          body: JSON.stringify(payloadServidor),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || 'Error al respaldar el comprobante')
        }
        setMensaje({
          tipo: 'ok',
          texto: 'Comprobante guardado en tu dispositivo y sincronizado con tu tienda.',
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
      const res = await authService.fetchAuth(`${BASE}/comprobantes/${comp.id}/verificar`, {
        method: 'PATCH',
        body: JSON.stringify({
          estado_verificacion: nuevoEstado,
          notas: comp.notas || 'Verificado manualmente por el tendero',
        }),
      })
      if (res.ok) {
        // Actualizar también en local
        const locales = await listarComprobantesLocales(usuario?.empresa_id)
        const local = locales.find(
          (l) => l.id === comp.id || l.client_operation_id === comp.client_operation_id
        )
        if (local) {
          local.estado_verificacion = nuevoEstado
          local.verificado_manualmente = nuevoEstado === 'VERIFICADO_MANUALMENTE'
          await guardarComprobanteLocal(local)
        }
        await cargarComprobantes()
      }
    } catch {
      // Ignorar
    }
  }

  const verImagenPrivada = async (comp) => {
    if (comp.foto_comprobante_url) {
      setComprobanteVista(comp)
      return
    }
    const locales = await listarComprobantesLocales(usuario?.empresa_id)
    const local = locales.find(
      (l) => l.id === comp.id || (l.client_operation_id && l.client_operation_id === comp.client_operation_id)
    )
    if (local?.foto_comprobante_url) {
      setComprobanteVista({ ...comp, foto_comprobante_url: local.foto_comprobante_url })
      return
    }
    try {
      const res = await authService.fetchAuth(`${BASE}/comprobantes/${comp.id}/imagen`)
      if (res.ok) {
        const data = await res.json()
        if (data.foto_comprobante_url) {
          setComprobanteVista({ ...comp, foto_comprobante_url: data.foto_comprobante_url })
        }
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <QrCode className="text-slate-900 dark:text-slate-100" size={24} />
            Comprobantes QR y pagos digitales
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Respaldos de Nequi, DaviPlata y transferencias guardados exclusivamente en tu dispositivo
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <HardDrive size={15} className="text-slate-500 dark:text-slate-400" />
          <span>{localesCount} fotos en este dispositivo</span>
        </div>
      </div>

      {/* Alerta de verificación */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">
            Diferencia entre comprobante capturado y pago verificado
          </p>
          <p className="text-amber-800 dark:text-amber-300">
            El escáner extrae los datos del QR y guarda la foto en tu celular. Confirma siempre en tu app bancaria que el dinero ingresó a tu cuenta antes de marcar como verificado.
          </p>
        </div>
      </div>

      {mensaje && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium border flex items-start gap-2 ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
          }`}
        >
          {mensaje.tipo === 'ok' ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          )}
          <span>{mensaje.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna izquierda: Registro del comprobante */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
              Registrar comprobante
            </h2>
            <button
              type="button"
              onClick={() => setEscanerAbierto(true)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <QrCode size={15} /> Escanear QR
            </button>
          </div>

          {qrAnalisis && (
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Datos leídos del QR:</p>
              <p className="text-slate-600 dark:text-slate-400 font-mono break-all text-[11px]">
                {qrRawData}
              </p>
              {qrAnalisis.advertencia_seguridad && (
                <p className="text-amber-700 dark:text-amber-300 font-medium pt-1">
                  {qrAnalisis.advertencia_seguridad}
                </p>
              )}
            </div>
          )}

          <form onSubmit={guardarComprobante} className="space-y-3.5">
            {/* Foto obligatoria */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Fotografía del comprobante *
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
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-44">
                  <img
                    src={fotoDataUrl}
                    alt="Vista previa comprobante"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 bg-slate-900/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-slate-900"
                  >
                    Cambiar foto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <Camera size={22} className="text-slate-400 dark:text-slate-500" />
                  <span className="text-xs font-semibold">Tomar foto o subir captura</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Se guarda de forma segura en tu celular
                  </span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billetera / Entidad
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {METODOS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="25000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Referencia de pago
                </label>
                <input
                  type="text"
                  placeholder="M1928374"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del pagador
                </label>
                <input
                  type="text"
                  placeholder="Carlos Pérez"
                  value={pagadorNombre}
                  onChange={(e) => setPagadorNombre(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Checkbox de confirmación */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={verificadoManualmente}
                onChange={(e) => setVerificadoManualmente(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-0"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                <strong>Ya verifiqué en mi app bancaria</strong> que el saldo ingresó a mi cuenta.
              </span>
            </label>

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-semibold py-3.5 rounded-xl text-sm min-h-[48px] transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar comprobante'}
            </button>
          </form>
        </div>

        {/* Columna derecha: Historial de Comprobantes */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base text-slate-900 dark:text-slate-100">
              Historial de comprobantes ({comprobantes.length})
            </h2>
          </div>

          {cargando ? (
            <p className="text-xs text-slate-400 py-8 text-center">Cargando comprobantes...</p>
          ) : comprobantes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Aún no has registrado comprobantes digitales.
            </div>
          ) : (
            <div className="space-y-2.5">
              {comprobantes.map((c) => {
                const verificado = c.estado_verificacion === 'VERIFICADO_MANUALMENTE'
                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          ${fmt(c.monto)}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {c.metodo_pago}
                        </span>
                        {verificado ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                            <ShieldCheck size={12} /> Verificado en banco
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <ShieldAlert size={12} /> Sin verificar en banco
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ref: {c.referencia_transaccion || 'Sin ref'} · {c.pagador_nombre || 'Cliente'} ·{' '}
                        {c.fecha_captura ? new Date(c.fecha_captura).toLocaleString('es-CO') : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => verImagenPrivada(c)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-colors"
                      >
                        <Eye size={13} /> Ver foto
                      </button>
                      {!verificado && (
                        <button
                          type="button"
                          onClick={() => cambiarEstadoVerificacion(c, 'VERIFICADO_MANUALMENTE')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Check size={13} /> Confirmar
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

      {/* Visor Modal de Comprobante */}
      {comprobanteVista && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-none z-50 flex items-center justify-center p-4"
          onClick={() => setComprobanteVista(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-4 space-y-3 border border-slate-200 dark:border-slate-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Respaldo · {comprobanteVista.metodo_pago} (${fmt(comprobanteVista.monto)})
              </h3>
              <button
                type="button"
                onClick={() => setComprobanteVista(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 max-h-[65vh] flex items-center justify-center">
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
