import { Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db, getMeta, setMeta } from '../lib/db'
import { diffDays, todayKey } from '../lib/dates'
import { Button, Modal } from './ui'

/** After 3+ days away: a warm welcome and an easy comeback quest, instead of guilt. */
export function WelcomeBack() {
  const [away, setAway] = useState(0)

  useEffect(() => {
    const today = todayKey()
    ;(async () => {
      const last = await getMeta('last_open')
      const hasHabits = (await db.habits.count()) > 0
      if (last && hasHabits && diffDays(last, today) >= 3) {
        await setMeta('comeback', today)
        setAway(diffDays(last, today))
      }
      await setMeta('last_open', today)
    })()
  }, [])

  return (
    <Modal open={away > 0} onClose={() => setAway(0)} title="">
      <div className="-mt-6 text-center">
        <div className="puffy animate-pop mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-sage text-on-pastel"><Sprout size={38} strokeWidth={2.2} aria-hidden /></div>
        <h2 className="mb-2 text-3xl font-black">Welcome back!</h2>
        <p className="mb-2 font-semibold text-muted">
          It's been {away} days. That's completely okay. What matters is that you're here now.
        </p>
        <p className="mb-6 font-semibold text-muted">
          Your garden missed you. Do just <b className="text-ink">one</b> habit today, even the 2-minute version, to finish your
          <b className="text-ink"> comeback quest (+25)</b>.
        </p>
        <Button className="w-full" onClick={() => setAway(0)}>Let's go</Button>
      </div>
    </Modal>
  )
}
