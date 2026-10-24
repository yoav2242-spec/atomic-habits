import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, PageHeader } from '../components/ui'
import { WEEKDAY_SHORT } from '../lib/dates'
import { useHabits } from '../lib/hooks'
import { swapOrder } from '../lib/repo'
import type { Habit } from '../lib/types'

export function scheduleLabel(h: Habit) {
  if (h.type === 'break') return 'Breaking'
  const s = h.schedule
  if (s.kind === 'daily') return 'Every day'
  if (s.kind === 'weekly') return `${s.times}× a week`
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ') || 'No days picked'
}

function Row({ h, up, down }: { h: Habit; up?: Habit; down?: Habit }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ background: `${h.color}22` }}>{h.emoji}</span>
      <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
        <div className="truncate font-medium">{h.name}</div>
        <div className="text-xs text-stone-500">{scheduleLabel(h)}{h.cue_time && ` · ${h.cue_time}`}</div>
      </Link>
      <div className="flex flex-col">
        <button disabled={!up} onClick={() => up && swapOrder(h, up)} className="px-2 text-stone-400 disabled:opacity-20" aria-label="Move up">▲</button>
        <button disabled={!down} onClick={() => down && swapOrder(h, down)} className="px-2 text-stone-400 disabled:opacity-20" aria-label="Move down">▼</button>
      </div>
    </div>
  )
}

export default function Habits() {
  const habits = useHabits()
  const [showArchived, setShowArchived] = useState(false)
  if (!habits) return null
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)
  return (
    <div>
      <PageHeader title="Habits" subtitle="Tap a habit to see its progress or edit it." action={<Link to="/habits/new" className={buttonClass()}>+ New</Link>} />
      {active.length === 0 && <p className="text-stone-500">No habits yet. Tap “+ New” to make one.</p>}
      <div className="space-y-2">
        {active.map((h, i) => <Row key={h.id} h={h} up={active[i - 1]} down={active[i + 1]} />)}
      </div>
      {archived.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowArchived(!showArchived)} className="text-sm font-medium text-stone-500">
            {showArchived ? '▾' : '▸'} Paused habits ({archived.length})
          </button>
          {showArchived && <div className="mt-2 space-y-2 opacity-70">{archived.map((h) => <Row key={h.id} h={h} />)}</div>}
        </div>
      )}
    </div>
  )
}
