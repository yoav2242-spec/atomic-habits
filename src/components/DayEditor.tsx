import { useEffect, useState } from 'react'
import { formatDay } from '../lib/dates'
import { setDay, setNote, type DayState } from '../lib/repo'
import { isDone } from '../lib/streaks'
import type { Checkin, Habit } from '../lib/types'
import { isAmount, progressText, stepOf } from '../lib/amounts'
import { Button, Modal, Stepper } from './ui'

/** Change any past day of a habit: done, 2-minute version, not done (or slipped / clean), plus a note. */
export function DayEditor({ habit, date, checkin, onClose }: { habit: Habit; date: string | null; checkin?: Checkin; onClose: () => void }) {
  const target = Math.max(1, habit.target_count)
  const step = isAmount(habit) ? stepOf(habit) : 1
  const [state, setState] = useState<DayState>('none')
  const [count, setCount] = useState(0)
  const [note, setNoteText] = useState('')

  useEffect(() => {
    if (!date) return
    const c = checkin && !checkin.deleted ? checkin : undefined
    setState(c?.kind === 'slip' ? 'slip' : c?.kind === 'two_min' ? 'two_min' : isDone(habit, c) ? 'done' : 'none')
    setCount(c?.kind === 'full' ? c.count : 0)
    setNoteText(c?.note ?? '')
  }, [date, checkin, habit])

  if (!date) return null

  const options: { value: DayState; label: string }[] =
    habit.type === 'break'
      ? [{ value: 'none', label: '🌿 Clean day' }, { value: 'slip', label: '😕 Slipped' }]
      : [{ value: 'done', label: '✓ Done' }, { value: 'two_min', label: '½ 2-min version' }, { value: 'none', label: '✗ Not done' }]

  const save = async () => {
    if (habit.type === 'build' && target > 1 && state !== 'two_min') {
      await setDay(habit, date, count > 0 ? 'done' : 'none', count)
    } else {
      await setDay(habit, date, state)
    }
    await setNote(habit, date, note.trim())
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`${habit.emoji} ${formatDay(date)}`}>
      <div className="space-y-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
          {options.map((o) => (
            <button key={o.value} onClick={() => { setState(o.value); if (o.value === 'done') setCount(target); if (o.value === 'none') setCount(0) }}
              className={`bouncy rounded-2xl border-2 px-2 py-3 text-sm font-extrabold ${state === o.value ? 'text-on-pastel' : 'border-line text-muted'}`}
              style={state === o.value ? { background: o.value === 'slip' ? 'var(--color-rose)' : habit.color, borderColor: 'transparent' } : undefined}>
              {o.label}
            </button>
          ))}
        </div>
        {habit.type === 'build' && target > 1 && state !== 'two_min' && (
          <div className="flex items-center justify-between rounded-2xl bg-soft p-3">
            <span className="text-sm font-bold">{isAmount(habit) ? `How much? (${habit.unit})` : 'How many times?'}<span className="block text-xs text-muted">{progressText(habit, count)}</span></span>
            <Stepper value={count} min={0} max={Math.max(target * 2, 30)} step={step} onChange={(n) => { setCount(n); setState(n >= target ? 'done' : 'none') }} />
          </div>
        )}
        <textarea rows={3} value={note} onChange={(e) => setNoteText(e.target.value)} placeholder="Note (optional): how did it go?" />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}
