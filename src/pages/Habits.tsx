import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, PageHeader } from '../components/ui'
import { WEEKDAY_SHORT } from '../lib/dates'
import { useProgress } from '../lib/progress'
import { swapOrder } from '../lib/repo'
import type { Habit } from '../lib/types'

export function scheduleLabel(h: Habit) {
  if (h.type === 'break') return 'Breaking'
  const s = h.schedule
  if (s.kind === 'daily') return 'Every day'
  if (s.kind === 'weekly') return `${s.times}× a week`
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ') || 'No days picked'
}

function Row({ h, streak, up, down }: { h: Habit; streak?: number; up?: Habit; down?: Habit }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-card p-3 shadow-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: `${h.color}33` }}>{h.emoji}</span>
      <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
        <div className="truncate font-extrabold">{h.name}</div>
        <div className="text-xs font-bold text-muted">
          {scheduleLabel(h)}{h.cue_time && ` · ${h.cue_time}`}{streak ? ` · 🔥 ${streak}` : ''}{h.level > 1 ? ` · Lv ${h.level}` : ''}
        </div>
      </Link>
      <Link to={`/habits/${h.id}/edit`} aria-label="Edit" className="bouncy flex h-9 w-9 items-center justify-center rounded-full bg-soft text-sm">✏️</Link>
      <div className="flex flex-col">
        <button disabled={!up} onClick={() => up && swapOrder(h, up)} className="px-1.5 text-xs text-muted disabled:opacity-20" aria-label="Move up">▲</button>
        <button disabled={!down} onClick={() => down && swapOrder(h, down)} className="px-1.5 text-xs text-muted disabled:opacity-20" aria-label="Move down">▼</button>
      </div>
    </div>
  )
}

export default function Habits() {
  const progress = useProgress()
  const [showArchived, setShowArchived] = useState(false)
  if (!progress) return null
  const habits = progress.habits.map((p) => p.habit)
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)
  return (
    <div>
      <PageHeader title="My habits" subtitle="Tap ✏️ to change a habit, or tap a habit to see its calendar." action={<Link to="/habits/new" className={buttonClass('primary', '!px-4 !py-2.5')}>+ New</Link>} />
      {active.length === 0 && <p className="font-semibold text-muted">No habits yet. Tap “+ New” to add one.</p>}
      <div className="space-y-2">
        {active.map((h, i) => <Row key={h.id} h={h} streak={progress.byId.get(h.id)?.stats.current} up={active[i - 1]} down={active[i + 1]} />)}
      </div>
      <Link to="/scorecard" className="mt-4 block rounded-3xl bg-soft p-3.5 text-sm font-bold text-muted">
        📋 Already doing some habits? Add them with your progress so far in the <span className="text-ink underline">Habits Scorecard</span>.
      </Link>
      {archived.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowArchived(!showArchived)} className="text-sm font-extrabold text-muted">
            {showArchived ? '▾' : '▸'} Paused habits ({archived.length})
          </button>
          {showArchived && <div className="mt-2 space-y-2 opacity-70">{archived.map((h) => <Row key={h.id} h={h} />)}</div>}
        </div>
      )}
    </div>
  )
}
