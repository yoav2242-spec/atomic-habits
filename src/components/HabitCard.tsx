import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { burst } from '../lib/celebrate'
import { diffDays } from '../lib/dates'
import { getCheckin, increment, restoreCheckin, toggleDone } from '../lib/repo'
import { isDone, nextMilestone, POINTS, type HabitStats } from '../lib/streaks'
import type { Checkin, Habit } from '../lib/types'
import { isAmount, progressText, servingsText, stepOf } from '../lib/amounts'
import { Button, InfoTip, Modal } from './ui'

interface Props {
  habit: Habit
  date: string
  today: string
  checkin?: Checkin
  stats: HabitStats
  identityName?: string
  stackLabel?: string
  depth: number
  levelUp: boolean
  onNote: () => void
  onSlip: () => void
  onUndoSlip: () => void
  onLevelUp: () => void
  /** Called just before any change, so the screen can spot new badges and levels after it. */
  onBeforeChange: () => void
  /** Called after a tap that completed the habit; `undo` puts the day back. */
  onDone: (message: string, undo: () => void) => void
}

export function streakLabel(s: HabitStats) {
  return `${s.current} ${s.unit}${s.current === 1 ? '' : 's'}`
}

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
)

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-xs font-extrabold" style={color ? { color } : undefined}>
      {children}
    </span>
  )
}

export function HabitCard(p: Props) {
  const { habit: h, checkin: c, stats } = p
  const [popKey, setPopKey] = useState(0)
  const [floatPts, setFloatPts] = useState<{ key: number; pts: number } | null>(null)
  const checkRef = useRef<HTMLButtonElement>(null)
  const isToday = p.date === p.today
  const done = isDone(h, c)
  const target = Math.max(1, h.target_count)
  const amount = isAmount(h)
  const step = amount ? stepOf(h) : 1
  const count = c?.kind === 'full' ? c.count : 0
  const [amountOpen, setAmountOpen] = useState(false)
  const [amountText, setAmountText] = useState('')

  const reward = (pts: number, undo: () => void) => {
    setPopKey((k) => k + 1)
    setFloatPts({ key: Date.now(), pts })
    burst(checkRef.current)
    p.onDone(p.identityName ? `+${pts} · a vote for being ${p.identityName}` : `+${pts} points`, undo)
  }

  const tap = async (kind: 'full' | 'two_min') => {
    p.onBeforeChange()
    const before = await getCheckin(h, p.date)
    await toggleDone(h, p.date, kind)
    if (!done) reward(kind === 'two_min' ? POINTS.two_min : POINTS.full, () => restoreCheckin(h, p.date, before))
    else setPopKey((k) => k + 1)
  }

  const bump = async (delta: number) => {
    p.onBeforeChange()
    const before = await getCheckin(h, p.date)
    const count = before?.kind === 'full' ? before.count : 0
    await increment(h, p.date, delta)
    setPopKey((k) => k + 1)
    if (count < target && count + delta >= target) reward(POINTS.full, () => restoreCheckin(h, p.date, before))
    else if (delta > 0) navigator.vibrate?.(8)
  }

  // A different encouragement line each day: the "why" and the reward pairing.
  const lines = [h.why && `💭 ${h.why}`, h.temptation_bundle && `🎁 ${h.temptation_bundle}`].filter(Boolean) as string[]
  const line = lines.length ? lines[Math.abs(diffDays('2000-01-01', p.date)) % lines.length] : ''
  const cue = [h.cue_time && `🕒 ${h.cue_time}`, h.location && `📍 ${h.location}`].filter(Boolean).join('  ')
  const next = nextMilestone(stats.current)
  const toBadge = next ? next - stats.current : null

  const editLink = (
    <Link to={`/habits/${h.id}/edit`} aria-label="Edit habit" className="bouncy flex h-8 w-8 items-center justify-center rounded-full bg-soft text-muted">
      <PencilIcon />
    </Link>
  )

  if (h.type === 'break') {
    const slipped = c?.kind === 'slip'
    return (
      <div className="animate-rise rounded-3xl border border-line bg-card p-4 shadow-[0_2px_10px_-4px_rgba(60,60,90,0.12)]">
        <div className="flex items-center gap-3">
          <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${h.color}2e` }}>{h.emoji}</span>
          <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-extrabold">{h.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {slipped ? <Chip color="var(--color-rose)">Slipped{c.count > 1 ? ` ×${c.count}` : ''}</Chip> : <Chip color={h.color}>🌿 {stats.current} day{stats.current === 1 ? '' : 's'} clean</Chip>}
              {stats.best > stats.current && <Chip>best {stats.best}</Chip>}
            </div>
          </Link>
          {editLink}
        </div>
        <div className="mt-3 flex justify-end">
          {slipped ? (
            <button onClick={p.onUndoSlip} className="bouncy rounded-full px-4 py-2 text-sm font-bold text-muted underline">Undo slip</button>
          ) : (
            <button onClick={p.onSlip} className="bouncy rounded-full border-2 border-line px-4 py-1.5 text-sm font-extrabold text-muted">I slipped</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="animate-rise relative rounded-3xl border-2 p-4 shadow-[0_2px_10px_-4px_rgba(60,60,90,0.12)] transition-colors duration-300"
      style={{
        marginLeft: p.depth ? Math.min(p.depth, 3) * 14 : 0,
        background: done ? `color-mix(in srgb, ${h.color} 14%, var(--card))` : 'var(--card)',
        borderColor: done ? `${h.color}88` : 'var(--line)',
      }}
    >
      {p.stackLabel && <div className="mb-2 text-xs font-extrabold text-muted">🔗 After I {p.stackLabel}</div>}
      <div className="flex items-center gap-3">
        <span className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${h.color}2e` }}>{h.emoji}</span>
        <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
          <div className={`line-clamp-2 text-[17px] font-extrabold leading-tight ${done ? 'opacity-60' : ''}`}>{h.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {stats.current > 0 && <Chip color="#e4874f">🔥 {streakLabel(stats)}</Chip>}
            {stats.freezes > 0 && <Chip color="var(--color-sky)">🧊 {stats.freezes}</Chip>}
            {h.schedule.kind === 'weekly' && (
              <Chip color={stats.weekDone >= h.schedule.times ? h.color : undefined}>
                {stats.weekDone}/{h.schedule.times} this week{stats.weekDone >= h.schedule.times && ' ✓'}
              </Chip>
            )}
            {h.level > 1 && <Chip color="var(--color-lavender)">Lv {h.level}</Chip>}
          </div>
        </Link>

        <div className="relative">
          {floatPts && (
            <span key={floatPts.key} className="animate-float-up pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-sm font-black text-sage-deep dark:text-sage">
              +{floatPts.pts}
            </span>
          )}
          {amount ? (
            <button ref={checkRef} key={popKey} onClick={() => bump(step)} aria-label={`Add one ${h.step_label || `${step} ${h.unit}`}`}
              className="bouncy animate-pop flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full text-white shadow-md"
              style={{ background: done ? h.color : `color-mix(in srgb, ${h.color} 85%, black)` }}>
              <span className="text-xl font-black leading-none">{done ? '✓' : '+'}</span>
              {!done && <span className="text-[9px] font-extrabold leading-tight">{h.step_label || `${step}`}</span>}
            </button>
          ) : target > 1 ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => bump(-1)} className="bouncy h-9 w-9 rounded-full bg-soft text-lg font-bold" aria-label="Minus one">−</button>
              <span key={popKey} className="animate-pop w-11 text-center text-sm font-black tabular-nums" style={done ? { color: h.color } : undefined}>
                {c?.kind === 'two_min' ? '2-min' : `${c?.count ?? 0}/${target}`}
              </span>
              <button ref={checkRef} onClick={() => bump(1)} className="bouncy h-11 w-11 rounded-full text-xl font-black text-white shadow-md" style={{ background: h.color }} aria-label="Plus one">+</button>
            </div>
          ) : (
            <button
              ref={checkRef}
              key={popKey}
              onClick={() => tap(c?.kind === 'two_min' ? 'two_min' : 'full')}
              aria-label={done ? 'Mark not done' : 'Mark done'}
              className="bouncy animate-pop flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[3px] text-2xl font-black text-white"
              style={{ borderColor: h.color, background: done ? h.color : 'transparent', boxShadow: done ? `0 4px 14px -4px ${h.color}` : undefined }}
            >
              {done ? (c?.kind === 'two_min' ? '½' : '✓') : ''}
            </button>
          )}
        </div>
      </div>

      {amount && (
        <div className="mt-3">
          <div className="h-3 overflow-hidden rounded-full bg-soft">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (count / target) * 100)}%`, background: h.color }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold">
            <span className="tabular-nums">{c?.kind === 'two_min' ? '2-minute version done' : progressText(h, count)}</span>
            {servingsText(h, count) && <span className="text-muted">{servingsText(h, count)}</span>}
            <span className="ml-auto flex gap-1.5">
              <button onClick={() => bump(-step)} disabled={count === 0} className="bouncy rounded-full bg-soft px-2.5 py-1 text-muted disabled:opacity-30" aria-label="Take one back">−</button>
              <button onClick={() => { setAmountText(''); setAmountOpen(true) }} className="bouncy rounded-full bg-soft px-2.5 py-1 text-muted">✏️ Other amount</button>
            </span>
          </div>
        </div>
      )}

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title={`${h.emoji} How much?`}>
        <p className="mb-3 text-sm font-semibold text-muted">Type any amount, like a cup you drank somewhere else.</p>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" min={0} value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder={String(step)} autoFocus />
          <span className="font-black">{h.unit}</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(-v); setAmountOpen(false) }}>Remove</Button>
          <Button className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(v); setAmountOpen(false) }}>Add</Button>
        </div>
      </Modal>

      {(cue || line) && (
        <div className="mt-2.5 space-y-0.5 text-xs font-semibold text-muted">
          {cue && <div>{cue}</div>}
          {line && <div className="italic">{line}</div>}
        </div>
      )}

      {isToday && stats.atRisk && !done && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sky/15 px-3 py-2.5 text-sm font-semibold">
          <span className="animate-wiggle">🧊</span>
          <span className="flex-1">A freeze saved your streak yesterday. Freezes can't be used two days in a row, so do it today!</span>
          <InfoTip tip="freeze" />
        </div>
      )}
      {isToday && stats.justReset && !done && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-peach/15 px-3 py-2.5 text-sm font-semibold">
          <span>🌱</span>
          <span className="flex-1">Your streak reset, and that's okay. Never miss twice: start a new one today.</span>
          <InfoTip tip="never_miss_twice" />
        </div>
      )}
      {p.levelUp && isToday && (
        <button onClick={p.onLevelUp} className="bouncy mt-3 flex w-full items-center gap-2 rounded-2xl bg-lavender/15 px-3 py-2.5 text-left text-sm font-bold">
          <span className="text-lg">📈</span>
          <span className="flex-1">This is getting easy! Ready to make it a little harder?</span>
          <span className="font-black text-lavender">Level up ›</span>
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {h.two_min_version && !done && (
          <button onClick={() => tap('two_min')} className="bouncy rounded-full border-2 border-dashed border-line px-3 py-1 text-xs font-bold text-muted">
            ⏱️ Busy? Just: {h.two_min_version}
          </button>
        )}
        {toBadge !== null && stats.current > 0 && toBadge <= 3 && (
          <span className="text-xs font-bold text-muted">🏅 {toBadge} more {stats.unit}{toBadge === 1 ? '' : 's'} to the {next}-{stats.unit} badge</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={p.onNote} aria-label="Note" className="bouncy flex h-8 items-center justify-center rounded-full bg-soft px-3 text-xs font-bold text-muted">
            {c?.note ? '📝 Note' : '+ Note'}
          </button>
          {editLink}
        </div>
      </div>
    </div>
  )
}
