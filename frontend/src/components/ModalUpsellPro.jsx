import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Mic,
  Bot,
  Users,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react'
import { useAgent } from '../context/AgentContext'

export default function ModalUpsellPro() {
  const navigate = useNavigate()
  const { modalUpsellAbierto, upsellContexto, cerrarUpsell, diasTrialRestantes } = useAgent()

  useEffect(() => {
    if (!modalUpsellAbierto) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') cerrarUpsell()
    }
    window.addEventListener('keydown', handleKeyDown)
    // Instrumentación mínima de métrica de exposición comercial
    try {
      window.dispatchEvent(
        new CustomEvent('growth-telemetry', {
          detail: { event: 'upsell_modal_viewed', contexto: upsellContexto },
        })
      )
    } catch {}
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalUpsellAbierto, cerrarUpsell, upsellContexto])

  if (!modalUpsellAbierto) return null

  const esVencido = upsellContexto === 'trial_vencido'

  const handleIrAPlanes = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('growth-telemetry', {
          detail: { event: 'pro_checkout_clicked', source: 'upsell_modal' },
        })
      )
    } catch {}
    cerrarUpsell()
    navigate('/planes')
  }

  const handleIrASoporte = () => {
    cerrarUpsell()
    navigate('/soporte')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={cerrarUpsell}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con Badge de Plan */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                  Gestión Neiva Pro
                </span>
                {!esVencido && diasTrialRestantes > 0 && (
                  <span className="text-xs text-emerald-600 font-semibold">
                    {diasTrialRestantes} {diasTrialRestantes === 1 ? 'día restante' : 'días restantes'}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                {esVencido
                  ? 'Tu período de prueba de 15 días ha finalizado'
                  : 'Potencia tu mostrador con Gestión Neiva Pro'}
              </h2>
            </div>
          </div>
          <button
            onClick={cerrarUpsell}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-100 transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensaje Contextual */}
        <p className="text-sm text-slate-600 leading-relaxed">
          {esVencido ? (
            <>
              Esperamos que hayas disfrutado la rapidez del <strong>Modo Voz</strong> y el <strong>Chat IA</strong>.
              Las funciones esenciales de tu negocio (caja, ventas e inventario manual) <strong>continúan 100% operativas</strong> en tu plan básico.
            </>
          ) : (
            <>
              Descubre cómo las herramientas inteligentes y los comandos manos libres ayudan a tu tienda a despachar más rápido y reducir errores de conteo.
            </>
          )}
        </p>

        {/* Beneficios Clave */}
        <div className="space-y-3 bg-slate-50 border border-slate-200/70 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-100 text-cyan-700 shrink-0 mt-0.5">
              <Mic size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Modo Mostrador por Voz (Manos Libres)</h4>
              <p className="text-xs text-slate-500">
                Dicta ventas y productos mientras despachas a tus clientes sin soltar las manos del mostrador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
              <Bot size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Asistente Virtual IA 24/7</h4>
              <p className="text-xs text-slate-500">
                Consulta balances del día, existencias agotadas y sugerencias automáticas de abastecimiento.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">Cajeros y Accesos sin Restricción</h4>
              <p className="text-xs text-slate-500">
                Concede accesos independientes a todo tu equipo de trabajo con auditoría completa.
              </p>
            </div>
          </div>
        </div>

        {/* Garantía y Continuidad Operativa */}
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-emerald-50/70 border border-emerald-100 px-3 py-2 rounded-xl">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span>Tu inventario, productos y ventas históricas están siempre protegidos.</span>
        </div>

        {/* Acciones Comerciales */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            onClick={handleIrAPlanes}
            className="w-full sm:flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <span>Ver Planes y Activar Pro</span>
            <ArrowRight size={16} />
          </button>
          <button
            onClick={handleIrASoporte}
            className="w-full sm:w-auto px-4 py-3 border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle size={16} />
            <span>Hablar con Soporte</span>
          </button>
        </div>
      </div>
    </div>
  )
}
