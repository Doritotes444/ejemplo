import { Store, Play, ArrowRight, X, Sparkles, CheckCircle2 } from 'lucide-react'

export default function OnboardingModal({ isOpen, onClose, onVerVideo }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
          aria-label="Cerrar bienvenida"
        >
          <X size={20} />
        </button>

        <div className="text-center space-y-3 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <Store size={26} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            ¡Te damos la bienvenida a Tiendapp!
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Estamos aquí para acompañarte a organizar tu tienda con orden, claridad y tranquilidad en
            tu mostrador.
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] block mb-1">
            Primeros pasos recomendados:
          </span>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>1. Agrega tus primeros productos y precios</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>2. Conoce cómo funciona la caja registradora</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>3. Registra tu primera venta real en el mostrador</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>4. Revisa tus números y ganancia limpia</span>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={onVerVideo}
            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Play size={16} className="text-emerald-400 fill-emerald-400" />
            <span>Ver cómo funciona (video de 1 minuto)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2"
          >
            <span>Comenzar a organizar mi tienda</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs py-2 transition-colors font-medium"
          >
            Omitir por ahora e ir directo al panel
          </button>
        </div>
      </div>
    </div>
  )
}
