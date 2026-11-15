import { AlarmClock, CalendarPlus } from 'lucide-react'
import { addDailyReminder, addToClock, isAndroid } from '../lib/alarm'
import { saveHabit } from '../lib/repo'
import type { Habit } from '../lib/types'
import { TimePicker } from './TimePicker'
import { Button, Modal, useToast } from './ui'

/** Pick a time for a habit, then add it to the phone's Clock and/or Calendar. */
export function ReminderSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const toast = useToast()
  const h = habit

  const clock = async () => {
    if (!h) return
    if (await addToClock(h)) return
    toast("Your phone won't open Clock from here", { label: 'Use Calendar', onClick: () => { addDailyReminder(h); toast('Open the file, then tap Save') } })
  }
  const calendar = () => {
    if (!h) return
    addDailyReminder(h)
    toast('Open the file, then tap Save')
  }

  return (
    <Modal open={!!h} onClose={onClose} title={h ? `Reminder · ${h.name}` : ''}>
      {h && (
        <div className="space-y-4">
          <TimePicker value={h.cue_time} onChange={(cue_time) => saveHabit({ ...h, cue_time })} />
          <div className="space-y-2.5">
            {isAndroid() && (
              <Button className="w-full gap-2" disabled={!h.cue_time} onClick={clock}>
                <AlarmClock size={20} strokeWidth={2.3} aria-hidden />Add to Clock
              </Button>
            )}
            <Button variant={isAndroid() ? 'secondary' : 'primary'} className="w-full gap-2" disabled={!h.cue_time} onClick={calendar}>
              <CalendarPlus size={20} strokeWidth={2.3} aria-hidden />Add to Calendar
            </Button>
          </div>
          <p className="text-[14px] font-semibold leading-snug text-muted">Calendar repeats every day. In Clock, choose the days.</p>
        </div>
      )}
    </Modal>
  )
}
