import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CartSidebar from '../CartSidebar'
import AgentWidget from '../AgentWidget'
import ModalUpsellPro from '../ModalUpsellPro'

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuToggle={() => setMenuAbierto(prev => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <CartSidebar />
      <AgentWidget />
      <ModalUpsellPro />
    </div>
  )
}
