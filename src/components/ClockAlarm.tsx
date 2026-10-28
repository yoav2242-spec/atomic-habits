import { AlarmClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { clockAlarmUrl, isAndroid } from '../lib/alarm'
import type { Habit } from '../lib/types'
import { buttonClass } from './ui'

/** A daily alarm in the phone's Clock app, opened with this habit's time and name filled in. */
export function ClockAlarm({ h }: { h: Habit }) {
  const url = clockAlarmUrl(h)
  return (
    <section className="clay mb-4 rounded-[26px] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full tray text-sage-deep"><AlarmClock size={22} strokeWidth={2.3} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-black leading-tight">Alarm in your Clock app</h2>
          <p className="text-[14px] font-semibold leading-snug text-muted">
            {h.cue_time ? 'Rings even when Atomic is closed' : 'Give it a time first'}
          </p>
        </div>
        {h.cue_time && <span className="shrink-0 text-[22px] font-black tabular-nums">{h.cue_time}</span>}
      </div>
      {!h.cue_time ? (
        <Link to={`/habits/${h.id}/edit?step=2`} className={buttonClass('secondary', 'mt-3 w-full')}>Pick a time</Link>
      ) : isAndroid() && url ? (
        <>
          <a href={url} className={buttonClass('primary', 'mt-3 w-full')}>Set the alarm</a>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-muted">Choose the days and sound in Clock, then Save.</p>
        </>
      ) : (
        <p className="tray mt-3 rounded-2xl p-3 text-[14px] font-semibold text-muted">Works on Android phones</p>
      )}
    </section>
  )
}
