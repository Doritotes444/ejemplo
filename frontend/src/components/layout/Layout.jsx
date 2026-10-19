import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import CartSidebar from '../CartSidebar'
import AgentWidget from '../AgentWidget'
import ModalUpsellPro from '../ModalUpsellPro'

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header onMenuToggle={() => setMenuAbierto((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 md:pb-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      <CartSidebar />
      <AgentWidget />
      <ModalUpsellPro />
    </div>
  )
}
