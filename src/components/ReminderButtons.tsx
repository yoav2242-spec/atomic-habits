import { AlarmClock, CalendarPlus } from 'lucide-react'
import { addDailyReminder, addToClock, isAndroid } from '../lib/alarm'
import type { Habit } from '../lib/types'
import { Button, useToast } from './ui'

/** "Add to Clock" and "Add to Calendar" for a habit that has a time. Shared by the reminder sheet and the Edit page. */
export function ReminderButtons({ h }: { h: Habit }) {
  const toast = useToast()
  const calendar = () => {
    addDailyReminder(h)
    toast('Open the file, then tap Save')
  }
  const clock = async () => {
    if (await addToClock(h)) return
    toast("Your phone won't open Clock from here", { label: 'Use Calendar', onClick: calendar })
  }
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
      <p className="text-[14px] font-semibold leading-snug text-muted">Calendar repeats every day. In Clock, choose the days.</p>
    </div>
  )
}
