import { Download, X } from 'lucide-react'
import { isInstalled, useInstallPrompt } from '../lib/install'
import { Button } from './ui'

const ua = () => navigator.userAgent
const isIos = () => /iPhone|iPad|iPod/i.test(ua())
// Chat apps and social apps open links in their own small browser, which can't install anything.
const inAppBrowser = () => /; wv\)|FBAN|FBAV|Instagram|Line\/|Telegram|GSA\//i.test(ua())

/** "Install Atomic": a real home-screen app that opens full-screen and works offline. Hidden once installed. */
export function InstallCard({ onDismiss }: { onDismiss?: () => void }) {
  const install = useInstallPrompt()
  if (isInstalled()) return null

  const steps = install ? null
    : inAppBrowser() ? 'Open this page in Chrome, then tap Install.'
    : isIos() ? 'Tap Share, then “Add to Home Screen”.'
    : 'In Chrome, tap ⋮ (top right), then “Install app”.'

  return (
    <section className="clay mb-5 rounded-[24px] p-4" aria-label="Install Atomic">
      <div className="flex items-start gap-3">
        <span className="tray flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sage-deep">
          <Download size={22} strokeWidth={2.3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight">Install Atomic</h2>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-muted">
            An app icon on your home screen. No link needed.
          </p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Hide" className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted">
            <X size={20} strokeWidth={2.3} aria-hidden />
          </button>
        )}
      </div>
      {install ? (
        <Button className="mt-3 w-full" onClick={install}>Install</Button>
      ) : (
        <p className="tray mt-3 rounded-2xl p-3 text-[15px] font-semibold leading-snug">{steps}</p>
      )}
    </section>
  )
}
