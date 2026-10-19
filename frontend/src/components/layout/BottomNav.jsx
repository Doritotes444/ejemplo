import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Wallet,
  QrCode,
  MoreHorizontal,
  LayoutDashboard,
  Calculator,
  BarChart3,
  Settings,
  Store,
  HelpCircle,
  Shield,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../utils/permissions'
import { cn } from '../../lib/utils'

export default function BottomNav() {
  const { usuario } = useAuth()
  const esAdmin = isAdmin(usuario)
  const [masAbierto, setMasAbierto] = useState(false)

  const items = [
    { to: '/ventas', label: 'Vender', icon: ShoppingCart, destacado: true },
    { to: '/inventario', label: 'Productos', icon: Package },
    { to: '/caja', label: 'Caja', icon: Wallet },
    { to: '/comprobantes', label: 'Comprobantes', icon: QrCode },
  ]

  return (
    <>
      <nav
        aria-label="Navegación principal móvil"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1 shadow-lg select-none"
      >
        <div className="grid grid-cols-5 items-center gap-1 max-w-md mx-auto">
          {items.map(({ to, label, icon: Icon, destacado }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMasAbierto(false)}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center min-h-[48px] rounded-xl px-1 text-[11px] font-semibold transition-colors',
                  destacado
                    ? isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                    : isActive
                    ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                )
              }
            >
              <Icon size={19} strokeWidth={2.2} />
              <span className="mt-0.5 truncate max-w-full">{label}</span>
            </NavLink>
          ))}

          {/* Botón "Más" para opciones secundarias */}
          <button
            type="button"
            onClick={() => setMasAbierto((prev) => !prev)}
            aria-expanded={masAbierto}
            className={cn(
              'flex flex-col items-center justify-center min-h-[48px] rounded-xl px-1 text-[11px] font-semibold transition-colors',
              masAbierto
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <MoreHorizontal size={20} strokeWidth={2.2} />
            <span className="mt-0.5">Más</span>
          </button>
        </div>
      </nav>

      {/* Menú inferior desplegable "Más" */}
      {masAbierto && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setMasAbierto(false)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-5 pb-20 shadow-2xl space-y-4 max-h-[75vh] overflow-y-auto animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Más herramientas
              </span>
              <button
                type="button"
                onClick={() => setMasAbierto(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
              {esAdmin && (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMasAbierto(false)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                  >
                    <LayoutDashboard size={18} className="text-emerald-600" />
                    <span>Diagnóstico 360°</span>
                  </Link>

                  <Link
                    to="/simulador"
                    onClick={() => setMasAbierto(false)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                  >
                    <Calculator size={18} className="text-blue-600" />
                    <span>Simulador</span>
                  </Link>

                  <Link
                    to="/reportes"
                    onClick={() => setMasAbierto(false)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                  >
                    <BarChart3 size={18} className="text-purple-600" />
                    <span>Reportes Excel</span>
                  </Link>

                  <Link
                    to="/planes"
                    onClick={() => setMasAbierto(false)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                  >
                    <Store size={18} className="text-amber-600" />
                    <span>Planes SaaS</span>
                  </Link>

                  <Link
                    to="/configuracion"
                    onClick={() => setMasAbierto(false)}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
                  >
                    <Settings size={18} className="text-slate-600" />
                    <span>Configuración</span>
                  </Link>
                </>
              )}

              <Link
                to="/soporte"
                onClick={() => setMasAbierto(false)}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition"
              >
                <HelpCircle size={18} className="text-slate-600" />
                <span>Soporte y Ayuda</span>
              </Link>

              {usuario?.es_superadmin && (
                <Link
                  to="/superadmin"
                  onClick={() => setMasAbierto(false)}
                  className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 transition col-span-2"
                >
                  <Shield size={18} />
                  <span>Panel SuperAdmin de Plataforma</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
