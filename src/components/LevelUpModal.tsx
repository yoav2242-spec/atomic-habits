import { useEffect, useState } from 'react'
import { bigCelebration } from '../lib/celebrate'
import { changeLevel, snoozeLevelUp } from '../lib/repo'
import type { Habit } from '../lib/types'
import { goalBreakdown, isAmount, stepOf } from '../lib/amounts'
import { Button, Field, InfoTip, Modal, Stepper } from './ui'

/** Suggests the next step by nudging the first number in the name: "Read 10 pages" → "Read 12 pages". */
export function suggestName(name: string, direction: 1 | -1) {
  return name.replace(/\d+/, (n) => {
    const v = Number(n)
    return String(direction > 0 ? Math.max(v + 1, Math.round(v * 1.2)) : Math.max(1, Math.min(v - 1, Math.round(v * 0.8))))
  })
}

export function LevelUpModal({ habit, direction, suggested, onClose }: { habit: Habit | null; direction: 1 | -1; suggested?: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState(1)

  useEffect(() => {
    if (!habit) return
    setName(suggestName(habit.name, direction))
    if (isAmount(habit)) {
      // Amounts grow or shrink by one step (one bottle), or about 15%, whichever is bigger.
      const change = Math.max(stepOf(habit), Math.round((habit.target_count * 0.15) / stepOf(habit)) * stepOf(habit))
      setTarget(Math.max(stepOf(habit), habit.target_count + direction * change))
    } else {
      setTarget(habit.target_count > 1 && !/\d/.test(habit.name) ? Math.max(1, habit.target_count + direction) : habit.target_count)
    }
  }, [habit, direction])

  if (!habit) return null
  const harder = direction > 0
  const changed = name.trim() !== habit.name || target !== habit.target_count

  const save = async () => {
    await changeLevel(habit, name.trim(), target, direction)
    if (harder) bigCelebration()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2">{harder ? '📈 Level up' : '🌱 Make it easier'} <InfoTip tip="level_up" /></span>}>
      <div className="space-y-4">
        <p className="text-sm font-semibold text-muted">
          {harder
            ? `You've been steady with “${habit.name}”. Make it just a little harder, about 10–20% more. Not too easy, not too hard.`
            : "Too hard right now? That's fine. Making it easier keeps you showing up, and showing up is what counts."}
        </p>
        <div className="rounded-2xl tray p-3 text-sm font-bold">
          Level {habit.level ?? 1} → <span className={harder ? 'text-level' : 'text-sage-deep'}>Level {Math.max(1, (habit.level ?? 1) + direction)}</span>
        </div>
        <Field label="New version of the habit" hint={harder ? 'e.g. more pages, more minutes, a little further.' : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {isAmount(habit) ? (
          <Field label={`Daily goal (${habit.unit})`} hint={goalBreakdown({ ...habit, target_count: target })}>
            <Stepper value={target} min={stepOf(habit)} max={1_000_000} step={stepOf(habit)} onChange={setTarget} />
          </Field>
        ) : (habit.target_count > 1 || target > 1) && (
          <Field label="Times per day">
            <Stepper value={target} min={1} max={30} onChange={setTarget} />
          </Field>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={async () => { if (suggested) await snoozeLevelUp(habit); onClose() }}>
            {suggested ? 'Not yet' : 'Cancel'}
          </Button>
          <Button variant={harder ? 'lavender' : 'primary'} className="flex-1" disabled={!name.trim() || !changed} onClick={save}>
            {harder ? 'Level up!' : 'Make it easier'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
