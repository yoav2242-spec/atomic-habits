import { CalendarPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { addDailyReminder, repeatLabel } from '../lib/alarm'
import type { Habit } from '../lib/types'
import { buttonClass, useToast } from './ui'

/** A reminder that repeats at the habit's time, added to the phone's Calendar. */
export function DailyReminder({ h }: { h: Habit }) {
  const toast = useToast()
  return (
    <section className="clay mb-4 rounded-[26px] p-4">
      <div className="flex items-center gap-3">
        <span className="tray flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sage-deep"><CalendarPlus size={22} strokeWidth={2.3} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-black leading-tight">Daily reminder</h2>
          <p className="text-[14px] font-semibold leading-snug text-muted">
            {h.cue_time ? `${repeatLabel(h) === 'every day' ? 'Every day' : repeatLabel(h)} at ${h.cue_time}` : 'Give it a time first'}
          </p>
        </div>
      </div>
      {h.cue_time ? (
        <button className={buttonClass('primary', 'mt-3 w-full')}
          onClick={() => { if (addDailyReminder(h)) toast('Open the file, then tap Save') }}>
          Add to Calendar
        </button>
      ) : (
        <Link to={`/habits/${h.id}/edit?step=2`} className={buttonClass('secondary', 'mt-3 w-full')}>Pick a time</Link>
      )}
    </section>
  )
}
