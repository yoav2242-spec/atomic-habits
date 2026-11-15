import { Smartphone } from 'lucide-react'
import { isAndroid } from '../lib/alarm'
import { isNativeApp } from '../lib/native'
import { buttonClass } from './ui'

/** For Chrome on an Android phone: the Atomic app, which can set alarms in the Clock app. Hidden inside the app itself. */
export function AndroidAppCard() {
  if (isNativeApp() || !isAndroid()) return null
  return (
    <section className="clay mb-5 rounded-[24px] p-4" aria-label="Android app">
      <div className="flex items-center gap-3">
        <span className="tray flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sage-deep">
          <Smartphone size={22} strokeWidth={2.3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-bold leading-tight">Android app</h2>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug text-muted">Sets alarms in your Clock app.</p>
        </div>
      </div>
      <a href="./Atomic.apk" download className={buttonClass('secondary', 'mt-3 w-full')}>Download</a>
    </section>
  )
}
