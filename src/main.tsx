import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import App from './App'
import './index.css'
import { protectStorage } from './lib/db'
import { captureInstallPrompt } from './lib/install'
import { registerSW } from 'virtual:pwa-register'

captureInstallPrompt()
protectStorage()

// Keep the installed app up to date: look for a new version when it opens, when it comes back
// to the front, and every hour. A new version takes over and the page reloads by itself.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => reg.update().catch(() => {})
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
