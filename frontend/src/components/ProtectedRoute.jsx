import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ adminOnly = false, superadminOnly = false }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-emerald-600 animate-spin" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (superadminOnly && !usuario.es_superadmin) {
    return <Navigate to="/ventas" replace />
  }

  if (adminOnly && usuario.rol !== 'admin') {
    return <Navigate to="/ventas" replace />
  }

  return <Outlet />
}
