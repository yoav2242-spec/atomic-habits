import { useState } from 'react'
import { Link } from 'react-router-dom'
import { diffDays } from '../lib/dates'
import { increment, toggleDone } from '../lib/repo'
import { isDone, type HabitStats } from '../lib/streaks'
import type { Checkin, Habit } from '../lib/types'

interface Props {
  habit: Habit
  date: string
  today: string
  checkin?: Checkin
  stats: HabitStats
  identityName?: string
  stackLabel?: string
  depth: number
  onNote: () => void
  onSlip: () => void
  onUndoSlip: () => void
  onCelebrate: (message: string) => void
}

export function streakLabel(s: HabitStats) {
  return `${s.current} ${s.unit}${s.current === 1 ? '' : 's'}`
}

export function HabitCard(p: Props) {
  const { habit: h, checkin: c, stats } = p
  const [popKey, setPopKey] = useState(0)
  const isToday = p.date === p.today
  const done = isDone(h, c)
  const target = Math.max(1, h.target_count)

  const celebrate = () => {
    setPopKey((k) => k + 1)
    p.onCelebrate(p.identityName ? `+1 vote for being ${p.identityName}` : 'Done! Small wins add up.')
  }

  const tap = async (kind: 'full' | 'two_min') => {
    const wasDone = done
    await toggleDone(h, p.date, kind)
    if (!wasDone) celebrate()
  }

  const bump = async (delta: number) => {
    const before = c?.kind === 'full' ? c.count : 0
    await increment(h, p.date, delta)
    if (before < target && before + delta >= target) celebrate()
  }

  // A different encouragement line each day: the "why" and the reward pairing.
  const lines = [h.why && `Why: ${h.why}`, h.temptation_bundle && `Reward: ${h.temptation_bundle}`].filter(Boolean) as string[]
  const line = lines.length ? lines[Math.abs(diffDays('2000-01-01', p.date)) % lines.length] : ''
  const cue = [h.cue_time, h.location && `in ${h.location}`].filter(Boolean).join(' · ')

  if (h.type === 'break') {
    const slipped = c?.kind === 'slip'
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ background: `${h.color}22` }}>
            {h.emoji}
          </span>
          <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
            <div className="truncate font-semibold">{h.name}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400">
              {slipped ? `Slipped${c.count > 1 ? ` ×${c.count}` : ''} on this day` : `${stats.current} day${stats.current === 1 ? '' : 's'} clean`}
              {stats.best > stats.current && ` · best ${stats.best}`}
            </div>
          </Link>
          {slipped ? (
            <button onClick={p.onUndoSlip} className="rounded-xl px-3 py-2 text-sm text-stone-500 underline">Undo</button>
          ) : (
            <button onClick={p.onSlip} className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium dark:border-stone-700">
              I slipped
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border border-stone-200 bg-white p-4 transition dark:border-stone-800 dark:bg-stone-900"
      style={{ marginLeft: p.depth ? Math.min(p.depth, 3) * 14 : 0, ...(done ? { borderColor: `${h.color}88` } : {}) }}
    >
      {p.stackLabel && <div className="mb-2 text-xs font-medium text-stone-500 dark:text-stone-400">↳ After I {p.stackLabel}</div>}
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl" style={{ background: `${h.color}22` }}>
          {h.emoji}
        </span>
        <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
          <div className={`truncate font-semibold ${done ? 'text-stone-500 line-through decoration-2 dark:text-stone-400' : ''}`} style={done ? { textDecorationColor: h.color } : undefined}>
            {h.name}
          </div>
          <div className="flex flex-wrap gap-x-2 text-sm text-stone-500 dark:text-stone-400">
            {stats.current > 0 && <span>🔥 {streakLabel(stats)}</span>}
            {h.schedule.kind === 'weekly' && (
              <span>{stats.weekDone}/{h.schedule.times} this week{stats.weekDone >= h.schedule.times && ' ✓'}</span>
            )}
            {cue && <span>{cue}</span>}
          </div>
        </Link>
        {target > 1 ? (
          <div className="flex items-center gap-1">
            <button onClick={() => bump(-1)} className="h-9 w-9 rounded-full bg-stone-100 text-lg dark:bg-stone-800" aria-label="Minus one">−</button>
            <span key={popKey} className="animate-pop w-12 text-center text-sm font-semibold tabular-nums" style={done ? { color: h.color } : undefined}>
              {c?.kind === 'two_min' ? '2-min' : `${c?.count ?? 0}/${target}`}
            </span>
            <button onClick={() => bump(1)} className="h-9 w-9 rounded-full text-lg font-semibold text-white" style={{ background: h.color }} aria-label="Plus one">+</button>
          </div>
        ) : (
          <button
            key={popKey}
            onClick={() => tap(c?.kind === 'two_min' ? 'two_min' : 'full')}
            aria-label={done ? 'Mark not done' : 'Mark done'}
            className="animate-pop flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold text-white"
            style={{ borderColor: h.color, background: done ? h.color : 'transparent' }}
          >
            {done ? (c?.kind === 'two_min' ? '2' : '✓') : ''}
          </button>
        )}
      </div>

      {isToday && stats.atRisk && !done && (
        <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          You missed last time. Never miss twice: even the 2-minute version keeps your streak alive.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {h.two_min_version && !done && (
          <button onClick={() => tap('two_min')} className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs dark:border-stone-700">
            Short on time? Just: {h.two_min_version}
          </button>
        )}
        {line && <span className="text-xs italic text-stone-500 dark:text-stone-400">{line}</span>}
        <button onClick={p.onNote} className="ml-auto text-xs text-stone-500 underline-offset-2 hover:underline dark:text-stone-400">
          {c?.note ? '📝 Note' : '+ Note'}
        </button>
      </div>
    </div>
  )
}
