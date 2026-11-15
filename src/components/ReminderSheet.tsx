import { saveHabit } from '../lib/repo'
import type { Habit } from '../lib/types'
import { ReminderButtons } from './ReminderButtons'
import { TimePicker } from './TimePicker'
import { Modal } from './ui'

/** Pick a time for a habit, then add it to the phone's Clock and/or Calendar. */
export function ReminderSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const h = habit
  return (
    <Modal open={!!h} onClose={onClose} title={h ? `Reminder · ${h.name}` : ''}>
      {h && (
        <div className="space-y-4">
          <TimePicker value={h.cue_time} onChange={(cue_time) => saveHabit({ ...h, cue_time })} />
          <ReminderButtons h={h} />
        </div>
      )}
    </Modal>
  )
}
