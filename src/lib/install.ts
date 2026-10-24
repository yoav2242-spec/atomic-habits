import { useSyncExternalStore } from 'react'

// Android Chrome offers an "install" event; keep it so Settings can show an Install button.

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** A function that shows Android's install dialog, or null when it isn't available. */
export function useInstallPrompt() {
  const event = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => deferred,
  )
  if (!event) return null
  return async () => {
    await event.prompt()
    await event.userChoice
    deferred = null
    notify()
  }
}

export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches
