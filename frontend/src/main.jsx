import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentProvider } from './context/AgentContext'
import { CartProvider } from './context/CartContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AgentProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
