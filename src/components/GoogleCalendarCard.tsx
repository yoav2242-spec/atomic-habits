import { CalendarCheck2, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { connectGoogle, disconnectGoogle, googleReady, syncGoogle, useGoogleStatus } from '../lib/gcal'
import { inSandbox } from '../lib/workspace'
import { Button, Modal, useToast } from './ui'

/** Settings block: connect Google, see when the Habits calendar last updated, or disconnect. */
export function GoogleCalendarCard() {
  const status = useGoogleStatus()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await fn()
      toast(done)
    } catch (e) {
      toast(e instanceof Error && e.message !== 'signed-out' ? e.message : 'Google sign-in needed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  const synced = status.synced
    ? new Date(status.synced).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'not yet'

  return (
    <div className="clay-in space-y-3 rounded-2xl p-3.5">
      <div className="flex items-center gap-3">
        <span className="puffy flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky/80 text-on-pastel"><CalendarCheck2 size={20} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold">"Habits" calendar in Google</span>
          <span className="block text-[13px] font-semibold text-muted">
            {!googleReady ? 'Almost ready: being set up'
              : inSandbox ? 'Not available in test mode'
              : !status.on ? 'Atomic adds and updates your habits there by itself'
              : status.signedIn ? `Connected · updated ${synced}`
              : 'Connected · tap Update to sign in to Google again'}
          </span>
        </span>
      </div>

      {googleReady && !inSandbox && (!status.on ? (
        <Button className="w-full" disabled={busy} onClick={() => run(connectGoogle, 'Your Habits calendar is ready in Google Calendar')}>
          {busy ? 'Connecting…' : 'Connect Google Calendar'}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 gap-1.5" disabled={busy} onClick={() => run(() => syncGoogle(true), 'Habits calendar updated')}>
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Update now
          </Button>
          <Button variant="ghost" className="!min-h-12" onClick={() => setLeaving(true)}>Disconnect</Button>
        </div>
      ))}

      {status.on && (
        <p className="text-[13px] font-semibold text-muted">
          Each habit with a time is a repeating event that reminds you right on time. In Google Calendar, tick or untick "Habits" in your calendar list to show or hide it.
        </p>
      )}

      <Modal open={leaving} onClose={() => setLeaving(false)} title="Disconnect Google Calendar?">
        <p className="mb-5 text-sm font-semibold text-muted">Atomic stops updating it. You can keep the Habits calendar in Google, or delete it.</p>
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => { setLeaving(false); run(() => disconnectGoogle(false), 'Disconnected. The calendar stays in Google.') }}>Disconnect, keep the calendar</Button>
          <Button variant="danger" className="w-full" onClick={() => { setLeaving(false); run(() => disconnectGoogle(true), 'Disconnected and the Habits calendar was deleted.') }}>Disconnect and delete it</Button>
        </div>
      </Modal>
    </div>
  )
}
