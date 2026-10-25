import { ArrowDown, ArrowUp, ArrowUpDown, Check, ClipboardList, Pencil, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, PageHeader, spring } from '../components/ui'
import { goalLabel } from '../lib/amounts'
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

const iconBtn = 'bouncy flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-25'

function Row({ h, streak, up, down, reorder }: { h: Habit; streak?: number; up?: Habit; down?: Habit; reorder?: boolean }) {
  return (
    <motion.div layout transition={spring} className="clay flex items-center gap-3 rounded-[22px] py-3 pl-3 pr-1.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-xl" style={{ background: `color-mix(in srgb, ${h.color} 38%, var(--card))` }}>{h.emoji}</span>
      <Link to={`/habits/${h.id}`} className="min-w-0 flex-1 py-1">
        <div className="truncate text-[16px] font-extrabold">{h.name}</div>
        <div className="truncate text-[13px] font-bold text-muted">
          {scheduleLabel(h)}{goalLabel(h) && ` · ${goalLabel(h)}`}{h.cue_time && ` · ${h.cue_time}`}{h.level > 1 ? ` · level ${h.level}` : ''}
          {!!streak && <span className="text-[var(--flame)]"> · {streak} in a row</span>}
        </div>
      </Link>
      {reorder ? (
        <>
          <button disabled={!up} onClick={() => up && swapOrder(h, up)} className={iconBtn} aria-label={`Move ${h.name} up`}><ArrowUp size={19} /></button>
          <button disabled={!down} onClick={() => down && swapOrder(h, down)} className={iconBtn} aria-label={`Move ${h.name} down`}><ArrowDown size={19} /></button>
        </>
      ) : (
        <Link to={`/habits/${h.id}/edit`} aria-label={`Edit ${h.name}`} className={iconBtn}><Pencil size={18} /></Link>
      )}
    </motion.div>
  )
}

export default function Habits() {
  const progress = useProgress()
  const [showArchived, setShowArchived] = useState(false)
  const [reorder, setReorder] = useState(false)
  if (!progress) return null
  const habits = progress.habits.map((p) => p.habit)
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)
  return (
    <div>
      <PageHeader title="My habits" subtitle="Tap a habit to see its calendar." action={<Link to="/habits/new" className={buttonClass('primary', '!px-4 !py-2.5')}><Plus size={18} strokeWidth={2.6} /> New</Link>} />
      {active.length > 1 && (
        <div className="-mt-3 mb-3 flex justify-end">
          <button onClick={() => setReorder(!reorder)} className="flex min-h-11 items-center gap-1.5 px-1 text-[15px] font-extrabold text-muted">
            {reorder ? <><Check size={17} /> Done</> : <><ArrowUpDown size={17} /> Reorder</>}
          </button>
        </div>
      )}
      {active.length === 0 && <p className="font-semibold text-muted">No habits yet. Tap “+ New” to add one.</p>}
      <div className="space-y-3">
        {active.map((h, i) => <Row key={h.id} h={h} streak={progress.byId.get(h.id)?.stats.current} up={active[i - 1]} down={active[i + 1]} reorder={reorder} />)}
      </div>
      <Link to="/scorecard" className="tray mt-5 flex items-start gap-2.5 rounded-[20px] p-3.5 text-sm font-bold leading-snug text-muted">
        <ClipboardList size={18} className="mt-0.5 shrink-0" /><span>Already doing some habits? Add them with your progress so far in the <span className="text-ink underline underline-offset-2">Habits Scorecard</span>.</span>
      </Link>
      {archived.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowArchived(!showArchived)} className="flex min-h-11 items-center px-1 text-[15px] font-extrabold text-muted">
            {showArchived ? '▾' : '▸'} Paused habits ({archived.length})
          </button>
          {showArchived && <div className="mt-2 space-y-3 opacity-70">{archived.map((h) => <Row key={h.id} h={h} />)}</div>}
        </div>
      )}
    </div>
  )
}
