import { NavLink } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Wallet,
  QrCode,
  LayoutDashboard,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { isAdmin } from '../../utils/permissions'
import { cn } from '../../lib/utils'

export default function BottomNav() {
  const { usuario } = useAuth()
  const esAdmin = isAdmin(usuario)

  const items = [
    { to: '/ventas', label: 'Vender', icon: ShoppingCart },
    { to: '/inventario', label: 'Productos', icon: Package },
    { to: '/caja', label: 'Caja', icon: Wallet },
    { to: '/comprobantes', label: 'QR Pagos', icon: QrCode },
    esAdmin
      ? { to: '/dashboard', label: 'Negocio', icon: LayoutDashboard }
      : { to: '/soporte', label: 'Ayuda', icon: MessageCircle },
  ]

  return (
    <nav
      aria-label="Navegación principal móvil"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-1 py-1 shadow-sm"
    >
      <div className="grid grid-cols-5 gap-0.5 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-h-[48px] rounded-xl px-1 py-1 text-[11px] font-semibold transition-colors select-none',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )
            }
          >
            <Icon size={19} strokeWidth={2.2} />
            <span className="mt-0.5 truncate max-w-full">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
