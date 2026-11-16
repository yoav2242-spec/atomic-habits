import { AlarmClock, CalendarPlus } from 'lucide-react'
import { useState } from 'react'
import { addDailyReminder, addToClock, isAndroid, type ClockResult } from '../lib/alarm'
import { isNativeApp } from '../lib/native'
import type { Habit } from '../lib/types'
import { Button, buttonClass, Modal, useToast } from './ui'

type Failure = Extract<ClockResult, { ok: false }>

const COPY: Record<Failure['why'], { title: string; body: string; app?: boolean }> = {
  browser: { title: 'Clock needs the Android app', body: "Chrome can't open your Clock app. The Atomic Android app can.", app: true },
  'no-clock': { title: 'No Clock app found', body: 'This phone has no Clock app that can set an alarm.' },
  'app-outdated': { title: 'Update the Android app', body: "This version of the app can't reach Clock. Download the newest one.", app: true },
  error: { title: "Couldn't open Clock", body: 'Calendar can remind you instead.' },
}

/** "Add to Clock" and "Add to Calendar" for a habit that has a time. Shared by the reminder sheet and the Edit page. */
export function ReminderButtons({ h }: { h: Habit }) {
  const toast = useToast()
  const [problem, setProblem] = useState<Failure | null>(null)

  const calendar = async () => {
    setProblem(null)
    const message = await addDailyReminder(h)
    if (message) toast(message)
  }
  const clock = async () => {
    const result = await addToClock(h)
    if (!result.ok) setProblem(result)
  }
  const copy = problem ? COPY[problem.why] : null

  return (
    <div className="space-y-2.5">
      {isAndroid() && (
        <Button type="button" className="w-full gap-2" disabled={!h.cue_time} onClick={clock}>
          <AlarmClock size={20} strokeWidth={2.3} aria-hidden />Add to Clock
        </Button>
      )}
      <Button type="button" variant={isAndroid() ? 'secondary' : 'primary'} className="w-full gap-2" disabled={!h.cue_time} onClick={calendar}>
        <CalendarPlus size={20} strokeWidth={2.3} aria-hidden />Add to Calendar
      </Button>
      <p className="text-[14px] font-semibold leading-snug text-muted">{isNativeApp() ? 'Both repeat on this habit\u2019s days.' : 'Calendar repeats every day. In Clock, choose the days.'}</p>

      <Modal open={!!problem} onClose={() => setProblem(null)} title={copy?.title ?? ''}>
        <p className="mb-2 text-[16px] font-semibold leading-snug">{copy?.body}</p>
        {problem?.detail && problem.why === 'error' && <p className="mb-2 break-words text-[14px] font-semibold text-muted">{problem.detail}</p>}
        <div className="mt-4 space-y-2.5">
          {copy?.app && <a href="./Atomic.apk" download className={buttonClass('primary', 'w-full')}>Get the Android app</a>}
          <Button variant={copy?.app ? 'secondary' : 'primary'} className="w-full" onClick={calendar}>Add to Calendar instead</Button>
        </div>
      </Modal>
    </div>
  )
}
