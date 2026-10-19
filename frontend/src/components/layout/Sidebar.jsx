import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  QrCode,
  Calculator,
  BarChart3,
  MessageCircle,
  Settings,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import authService from '../../services/authService'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../utils/permissions'

const BASE = import.meta.env.VITE_API_URL || '/api'

const navItems = [
  { to: '/ventas',        label: 'Venta Rápida (POS)', icon: ShoppingCart,    adminOnly: false },
  { to: '/inventario',    label: 'Productos y Stock',  icon: Package,         adminOnly: false },
  { to: '/caja',          label: 'Caja y Arqueo',      icon: Wallet,          adminOnly: false },
  { to: '/comprobantes',  label: 'Comprobantes QR',    icon: QrCode,          adminOnly: false },
  { to: '/dashboard',     label: 'Dashboard 360°',     icon: LayoutDashboard, adminOnly: true },
  { to: '/simulador',     label: 'Simulador Comercial', icon: Calculator,     adminOnly: true },
  { to: '/reportes',      label: 'Reportes y Excel',   icon: BarChart3,       adminOnly: true },
  { to: '/planes',        label: 'Planes SaaS',        icon: Sparkles,        adminOnly: true },
  { to: '/configuracion', label: 'Equipo y Ajustes',   icon: Settings,        adminOnly: true },
  { to: '/soporte',       label: 'Mesa de Ayuda',      icon: MessageCircle,   adminOnly: false },
]

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

  return (
    <>
      {abierto && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden"
          onClick={onCerrar}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full transition-transform duration-200',
          'md:relative md:z-auto md:translate-x-0 md:shrink-0',
          abierto ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate">
              {empresa?.nombre_comercial || 'Mi Tienda'}
            </p>
            <p className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
              Plan {(empresa?.plan || 'basic').toUpperCase()}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => !item.adminOnly || esAdmin)
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onCerrar}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
      </aside>
    </>
  )
}
