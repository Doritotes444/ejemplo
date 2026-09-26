import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import authService from '../services/authService'
import { useAuth } from './AuthContext'

const AgentContext = createContext(null)
const BASE = import.meta.env.VITE_API_URL || '/api'

export function AgentProvider({ children }) {
  const { usuario } = useAuth()
  const [empresa, setEmpresa] = useState(null)
  const [cargandoEmpresa, setCargandoEmpresa] = useState(true)

  const [chatAbierto, setChatAbierto] = useState(false)
  const [modoVozAbierto, setModoVozAbierto] = useState(false)
  const [modalUpsellAbierto, setModalUpsellAbierto] = useState(false)
  const [upsellContexto, setUpsellContexto] = useState('conocer_pro') // 'conocer_pro' | 'trial_vencido'

  const cargarEmpresa = useCallback(async () => {
    if (!authService.getToken()) {
      setEmpresa(null)
      setCargandoEmpresa(false)
      return
    }
    try {
      const res = await authService.fetchAuth(`${BASE}/empresas/mi-empresa`)
      if (res.ok) {
        const data = await res.json()
        setEmpresa(data)
      }
    } catch {
      // Ignorar errores transitorios de red
    } finally {
      setCargandoEmpresa(false)
    }
  }, [])

  useEffect(() => {
    cargarEmpresa()
  }, [cargarEmpresa, usuario])

  // Lógica de suscripción y derechos de uso Pro
  const plan = empresa?.plan ? String(empresa.plan).toLowerCase() : 'basic'
  const esPlanPro = ['pro', 'medium', 'premium'].includes(plan)
  const diasTrialRestantes = typeof empresa?.dias_trial_restantes === 'number' ? empresa.dias_trial_restantes : 0
  const esTrialActivo = !esPlanPro && diasTrialRestantes > 0
  const trialExpirado = !esPlanPro && diasTrialRestantes <= 0
  const tieneAccesoPro = esPlanPro || esTrialActivo

  const abrirChat = useCallback(() => {
    if (!tieneAccesoPro) {
      setUpsellContexto('trial_vencido')
      setModalUpsellAbierto(true)
      return
    }
    setChatAbierto(true)
    setModoVozAbierto(false)
  }, [tieneAccesoPro])

  const cerrarChat = useCallback(() => {
    setChatAbierto(false)
  }, [])

  const toggleChat = useCallback(() => {
    if (chatAbierto) {
      cerrarChat()
    } else {
      abrirChat()
    }
  }, [chatAbierto, abrirChat, cerrarChat])

  const abrirModoVoz = useCallback(() => {
    if (!tieneAccesoPro) {
      setUpsellContexto('trial_vencido')
      setModalUpsellAbierto(true)
      return
    }
    setModoVozAbierto(true)
    setChatAbierto(false)
  }, [tieneAccesoPro])

  const cerrarModoVoz = useCallback(() => {
    setModoVozAbierto(false)
  }, [])

  const abrirUpsell = useCallback((contexto = 'conocer_pro') => {
    setUpsellContexto(contexto)
    setModalUpsellAbierto(true)
  }, [])

  const cerrarUpsell = useCallback(() => {
    setModalUpsellAbierto(false)
  }, [])

  return (
    <AgentContext.Provider
      value={{
        empresa,
        cargandoEmpresa,
        plan,
        esPlanPro,
        esTrialActivo,
        trialExpirado,
        tieneAccesoPro,
        diasTrialRestantes,
        chatAbierto,
        modoVozAbierto,
        modalUpsellAbierto,
        upsellContexto,
        abrirChat,
        cerrarChat,
        toggleChat,
        abrirModoVoz,
        cerrarModoVoz,
        abrirUpsell,
        cerrarUpsell,
        refrescarEmpresa: cargarEmpresa,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent debe ser usado dentro de un AgentProvider')
  return ctx
}

export default AgentContext
