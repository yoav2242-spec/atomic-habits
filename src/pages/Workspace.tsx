import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Segmented, useConfirm, useToast } from '../components/ui'
import { db } from '../lib/db'
import { formatDay, todayKey } from '../lib/dates'
import { clearTestCopy, copyRealData, simulateHistory, type Profile } from '../lib/simulate'
import { dayOffset, inSandbox, lockWorkspace, setDayOffset, setSandbox, unlockWorkspace } from '../lib/workspace'

const JUMPS = [
  { label: '+1 day', days: 1 },
  { label: '+1 week', days: 7 },
  { label: '+1 month', days: 30 },
  { label: '+1 year', days: 365 },
]

const LENGTHS = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '1 year', days: 365 },
]

/** Private test workspace: only reachable from a secret link or a hidden tap, only on this device. */
export default function Workspace() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [profile, setProfile] = useState<Profile>('good')
  const [busy, setBusy] = useState(false)

  useEffect(unlockWorkspace, [])

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      toast(label)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-bold text-muted">‹ Back</button>
      <h1 className="text-3xl font-black tracking-tight">🛠 Test workspace</h1>
      <p className="mb-5 font-semibold text-muted">Only you can see this, and only on this device. Use it to see how the app looks after days, weeks or a year of habits.</p>

      <Card className={`mb-4 ${inSandbox ? '' : '!border-sage'}`}>
        {inSandbox ? (
          <>
            <div className="mb-1 font-black">🧪 You're in test mode</div>
            <p className="mb-3 text-sm font-semibold text-muted">
              Everything you see and do now uses a separate test copy. Your real habits are safe and untouched.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => setSandbox(false)}>Back to my real app</Button>
          </>
        ) : (
          <>
            <div className="mb-1 font-black">Start testing</div>
            <p className="mb-3 text-sm font-semibold text-muted">
              Test mode switches to a separate test copy, so pretend dates and fake history never touch your real habits.
            </p>
            <Button className="w-full" onClick={() => setSandbox(true)}>Enter test mode</Button>
          </>
        )}
      </Card>

      {inSandbox && (
        <>
          <Card className="mb-4">
            <div className="font-black">📅 Pretend date</div>
            <p className="mb-3 text-sm font-semibold text-muted">
              The app thinks today is <b className="text-ink">{formatDay(todayKey(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b>
              {dayOffset ? ` (${dayOffset > 0 ? '+' : ''}${dayOffset} days)` : ' (the real date)'}.
            </p>
            <div className="mb-2 grid grid-cols-4 gap-2">
              {JUMPS.map((j) => (
                <Button key={j.label} variant="secondary" className="!px-1 !py-2 text-xs" onClick={() => setDayOffset(dayOffset + j.days)}>{j.label}</Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="!py-2 text-xs" onClick={() => setDayOffset(dayOffset - 1)}>−1 day</Button>
              <Button variant="secondary" className="!py-2 text-xs" disabled={!dayOffset} onClick={() => setDayOffset(0)}>Back to real date</Button>
            </div>
            <p className="mt-2 text-xs font-semibold text-muted">Tip: jump +1 day, check off your habits, repeat. That's how a real week feels.</p>
          </Card>

          <Card className="mb-4">
            <div className="font-black">⏩ Fill in fake history</div>
            <p className="mb-3 text-sm font-semibold text-muted">
              Makes up check-ins for the days before the pretend date. If the test copy has no habits, a few starter habits are added first.
            </p>
            <Segmented value={profile} onChange={setProfile} options={[{ value: 'perfect', label: '🌟 Perfect' }, { value: 'good', label: '🙂 Good' }, { value: 'struggling', label: '😓 Struggling' }]} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {LENGTHS.map((l) => (
                <Button key={l.label} disabled={busy} className="!py-2.5 text-sm"
                  onClick={() => run(`Filled ${l.label} of ${profile} history`, async () => { await simulateHistory(l.days, profile); navigate('/') })}>
                  {l.label}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="mb-4 space-y-2">
            <div className="font-black">🗂 Test copy</div>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => run('Copied your real habits into the test copy', copyRealData)}>
              Copy my real habits into it
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => db.meta.delete('onboarded').then(() => navigate('/'))}>Show the welcome tour</Button>
            <Button variant="danger" className="w-full" disabled={busy}
              onClick={() => confirm.ask('Empty the test copy?', 'This only clears the test copy. Your real habits are not touched.', () => run('Test copy emptied', async () => { await clearTestCopy(); navigate('/') }))}>
              Empty the test copy
            </Button>
          </Card>
        </>
      )}

      <button onClick={() => { lockWorkspace(); location.hash = '#/settings'; location.reload() }} className="mt-2 w-full py-2 text-sm font-bold text-muted underline">
        Hide the workspace on this device
      </button>
      {confirm.element}
    </div>
  )
}
