import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { protectStorage } from './lib/db'
import { captureInstallPrompt } from './lib/install'

captureInstallPrompt()
protectStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
