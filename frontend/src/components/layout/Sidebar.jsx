import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Wallet,
  QrCode,
  LayoutDashboard,
  Calculator,
  BarChart3,
  HelpCircle,
  Settings,
  Store,
  Shield,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import authService from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../utils/permissions'

const BASE = import.meta.env.VITE_API_URL || '/api'

export default function Sidebar({ abierto, onCerrar }) {
  const { usuario } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const esAdmin = isAdmin(usuario)

  useEffect(() => {
    authService
      .fetchAuth(`${BASE}/empresas/mi-empresa`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEmpresa(data))
      .catch(() => {})
  }, [])

  const itemsOperacion = [
    { to: '/ventas', label: 'Vender (Caja Rápida)', icon: ShoppingCart },
    { to: '/inventario', label: 'Productos', icon: Package },
    { to: '/caja', label: 'Caja y Arqueo', icon: Wallet },
    { to: '/comprobantes', label: 'Comprobantes QR', icon: QrCode },
  ]

  const itemsGestion = [
    { to: '/dashboard', label: 'Diagnóstico 360°', icon: LayoutDashboard },
    { to: '/simulador', label: 'Simulador de Ganancias', icon: Calculator },
    { to: '/reportes', label: 'Reportes y Excel', icon: BarChart3 },
    { to: '/planes', label: 'Planes SaaS', icon: Store },
    { to: '/configuracion', label: 'Configuración y Cajeros', icon: Settings },
  ]

  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs z-40 md:hidden"
          onClick={onCerrar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full transition-transform duration-200 select-none',
          'md:relative md:z-auto md:translate-x-0 md:shrink-0',
          abierto ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Cabecera Sidebar */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <p className="text-slate-900 dark:text-slate-100 text-sm font-bold truncate">
              {empresa?.nombre_comercial || 'Mi Tienda'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              Plan {(empresa?.plan || 'Básico').toUpperCase()}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lista de Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {/* Sección 1: Operación Diaria */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Operación
            </span>
            {itemsOperacion.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onCerrar}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  )
                }
              >
                <Icon size={16} strokeWidth={2.2} />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Sección 2: Gestión (Sólo Admin / Dueño) */}
          {esAdmin && (
            <div className="space-y-1 pt-1">
              <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Gestión y Finanzas
              </span>
              {itemsGestion.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onCerrar}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    )
                  }
                >
                  <Icon size={16} strokeWidth={2.2} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}

          {/* Sección 3: Soporte / Superadmin */}
          <div className="space-y-1 pt-1">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ayuda
            </span>
            <NavLink
              to="/soporte"
              onClick={onCerrar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )
              }
            >
              <HelpCircle size={16} strokeWidth={2.2} />
              <span>Soporte</span>
            </NavLink>

            {usuario?.es_superadmin && (
              <NavLink
                to="/superadmin"
                onClick={onCerrar}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors mt-2',
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                  )
                }
              >
                <Shield size={16} strokeWidth={2.2} />
                <span>Panel SuperAdmin</span>
              </NavLink>
            )}
          </div>
        </nav>
      </aside>
    </>
  )
}
