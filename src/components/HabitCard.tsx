import { Flame, Minus, MoreHorizontal, NotebookPen, Pencil, Plus, Timer, TrendingUp, Undo2 } from 'lucide-react'
import { buzz } from '../lib/prefs'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isAmount, progressText, stepOf } from '../lib/amounts'
import { burst } from '../lib/celebrate'
import { getCheckin, increment, restoreCheckin, toggleDone } from '../lib/repo'
import { isDone, POINTS, type HabitStats } from '../lib/streaks'
import type { Checkin, Habit } from '../lib/types'
import { Button, InfoTip, Modal, softSpring, spring } from './ui'

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

const squish = { scaleX: 1.14, scaleY: 0.84 }

/** The big puffy check: squishes when pressed, fills with the habit's color, and draws its tick. */
function CheckButton({ done, half, color, onClick, refEl }: { done: boolean; half: boolean; color: string; onClick: () => void; refEl: React.Ref<HTMLButtonElement> }) {
  return (
    <motion.button
      ref={refEl}
      onClick={onClick}
      aria-label={done ? 'Mark not done' : 'Mark done'}
      whileTap={squish}
      animate={{ scale: done ? [1, 1.18, 0.94, 1] : 1 }}
      transition={{ ...spring, scale: { duration: 0.5 } }}
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${done ? 'puffy' : 'clay-in'}`}
      style={done ? { background: color } : undefined}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="var(--color-on-pastel)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        {half ? (
          <motion.text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="900" fill="var(--color-on-pastel)" stroke="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>½</motion.text>
        ) : (
          <>
            {!done && <path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={2.6} />}
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={{ ...softSpring, delay: done ? 0.08 : 0 }} />
          </>
        )}
      </svg>
    </motion.button>
  )
}

export function HabitCard(p: Props) {
  const { habit: h, checkin: c, stats } = p
  const [floatPts, setFloatPts] = useState<{ key: number; pts: number } | null>(null)
  const [popKey, setPopKey] = useState(0)
  const checkRef = useRef<HTMLButtonElement>(null)
  const isToday = p.date === p.today
  const done = isDone(h, c)
  const target = Math.max(1, h.target_count)
  const amount = isAmount(h)
  const step = amount ? stepOf(h) : 1
  const count = c?.kind === 'full' ? c.count : 0
  const [amountOpen, setAmountOpen] = useState(false)
  const [amountText, setAmountText] = useState('')
  const navigate = useNavigate()

  const reward = (pts: number, undo: () => void) => {
    setFloatPts({ key: Date.now(), pts })
    burst(checkRef.current)
    p.onDone(p.identityName ? `+${pts} · a vote for being ${p.identityName}` : `+${pts} points`, undo)
  }

  const tap = async (kind: 'full' | 'two_min') => {
    p.onBeforeChange()
    const before = await getCheckin(h, p.date)
    await toggleDone(h, p.date, kind)
    if (!done) reward(kind === 'two_min' ? POINTS.two_min : POINTS.full, () => restoreCheckin(h, p.date, before))
  }

  const bump = async (delta: number) => {
    p.onBeforeChange()
    const before = await getCheckin(h, p.date)
    const had = before?.kind === 'full' ? before.count : 0
    await increment(h, p.date, delta)
    setPopKey((k) => k + 1)
    if (had < target && had + delta >= target) reward(POINTS.full, () => restoreCheckin(h, p.date, before))
    else if (delta > 0) buzz(8)
  }

  const tint = (pct: number) => `color-mix(in srgb, ${h.color} ${pct}%, var(--card))`
  const [menuOpen, setMenuOpen] = useState(false)
  const close = (fn: () => void) => () => { setMenuOpen(false); fn() }

  const emojiBubble = (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-[22px]" style={{ background: tint(32) }}>
      {h.emoji}
    </span>
  )

  // One short fact under the name: the thing that matters most right now.
  const warn = isToday && !done && (stats.atRisk || stats.justReset)
  const fact = warn
    ? <span style={{ color: 'var(--flame)' }}>{stats.atRisk ? "Don't miss today" : 'Start again today'}</span>
    : h.type === 'break'
      ? (c?.kind === 'slip' ? <span style={{ color: 'var(--flame)' }}>Slipped today</span> : <span>{stats.current} day{stats.current === 1 ? '' : 's'} clean</span>)
      : h.schedule.kind === 'weekly'
        ? <span>{stats.weekDone} of {h.schedule.times} this week</span>
        : stats.current > 0
          ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--flame)' }}><Flame size={14} strokeWidth={2.4} aria-hidden />{streakLabel(stats)}</span>
          : null
  const factLine = (
    <div className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold text-muted">
      {fact}
      {fact && h.cue_time && <span aria-hidden>·</span>}
      {h.cue_time && <span className="tabular-nums">{h.cue_time}</span>}
    </div>
  )

  const moreButton = (
    <button onClick={() => setMenuOpen(true)} aria-label={`More for ${h.name}`}
      className="relative flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-muted">
      <MoreHorizontal size={22} strokeWidth={2.2} aria-hidden />
      {p.levelUp && isToday && <span aria-hidden className="absolute right-1 top-2 h-2 w-2 rounded-full bg-lavender" />}
    </button>
  )

  const row = (label: string, onClick: () => void, Icon: typeof Pencil, extra?: ReactNode) => (
    <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl px-2 text-left text-[17px] font-bold active:bg-[var(--line)]">
      <Icon size={20} strokeWidth={2.2} aria-hidden className="shrink-0 text-muted" />
      <span className="min-w-0 flex-1">{label}{extra}</span>
    </button>
  )

  const menu = (
    <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title={h.name}>
      {warn && (
        <p className="mb-3 flex items-start gap-1 text-[15px] font-semibold leading-snug text-muted">
          <span className="flex-1">{stats.atRisk ? "A freeze saved yesterday. Freezes can't be used two days in a row." : 'Your streak reset. Never miss twice.'}</span>
          <InfoTip tip={stats.atRisk ? 'freeze' : 'never_miss_twice'} />
        </p>
      )}
      <div className="-mx-2">
        {h.type === 'build' && h.two_min_version && !done && row('2-minute version', close(() => tap('two_min')), Timer, <span className="block text-[14px] font-semibold text-muted">{h.two_min_version}</span>)}
        {h.type === 'build' && p.levelUp && isToday && row('Make it a little harder', close(p.onLevelUp), TrendingUp)}
        {amount && row('Add another amount', close(() => { setAmountText(''); setAmountOpen(true) }), Plus)}
        {h.type === 'break' && c?.kind === 'slip' && row('Undo the slip', close(p.onUndoSlip), Undo2)}
        {h.type === 'build' && row(c?.note ? 'Edit note' : 'Add a note', close(p.onNote), NotebookPen)}
        {row('Edit habit', close(() => navigate(`/habits/${h.id}/edit`)), Pencil)}
      </div>
    </Modal>
  )

  if (h.type === 'break') {
    const slipped = c?.kind === 'slip'
    return (
      <motion.div layout transition={spring} id={`habit-${h.id}`} className="clay scroll-mt-6 rounded-[24px] py-3 pl-3.5 pr-2.5">
        <div className="flex items-center gap-3">
          {emojiBubble}
          <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[18px] font-bold leading-tight">{h.name}</div>
            {factLine}
          </Link>
          {moreButton}
          {!slipped && <Button variant="secondary" className="!min-h-11 !px-3.5 !py-1.5 text-[15px]" onClick={p.onSlip}>Slipped</Button>}
        </div>
        {menu}
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      transition={spring}
      id={`habit-${h.id}`}
      className="clay relative scroll-mt-6 rounded-[24px] py-3 pl-3.5 pr-2.5"
      style={{ marginLeft: p.depth ? Math.min(p.depth, 3) * 12 : 0, background: done ? tint(18) : undefined, transition: 'background 0.5s' }}
    >
      <div className="flex items-center gap-3">
        {emojiBubble}
        <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
          <motion.div animate={{ opacity: done ? 0.6 : 1 }} className="line-clamp-2 text-[18px] font-bold leading-tight">{h.name}</motion.div>
          {factLine}
        </Link>
        {moreButton}

        <div className="relative">
          <AnimatePresence>
            {floatPts && (
              <motion.span key={floatPts.key} className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-bg"
                initial={{ y: 6, opacity: 0, scale: 0.6 }} animate={{ y: -10, opacity: 1, scale: 1 }} exit={{ y: -26, opacity: 0 }} transition={spring}
                onAnimationComplete={() => setTimeout(() => setFloatPts(null), 500)}>
                +{floatPts.pts}
              </motion.span>
            )}
          </AnimatePresence>
          {amount || target > 1 ? (
            <motion.button ref={checkRef} whileTap={squish} transition={spring} onClick={() => bump(step)}
              aria-label={amount ? `Add one ${h.step_label || `${step} ${h.unit}`}` : 'Plus one'}
              className="puffy flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full"
              style={{ background: done ? h.color : tint(70) }}>
              <Plus size={24} strokeWidth={2.6} className="text-on-pastel" aria-hidden />
            </motion.button>
          ) : (
            <CheckButton done={done} half={c?.kind === 'two_min'} color={h.color} onClick={() => tap(c?.kind === 'two_min' ? 'two_min' : 'full')} refEl={checkRef} />
          )}
        </div>
      </div>

      {(amount || target > 1) && (
        <div className="mt-2.5 flex items-center gap-3 pl-14">
          <div className="min-w-0 flex-1">
            <div className="clay-in h-2.5 overflow-hidden rounded-full p-[2px]">
              <motion.div className="h-full rounded-full" initial={false} animate={{ width: `${Math.max(count ? 6 : 0, Math.min(100, (count / target) * 100))}%` }} transition={softSpring} style={{ background: h.color }} />
            </div>
            <motion.div key={popKey} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} className="mt-1 text-[14px] font-semibold text-muted tabular-nums">
              {c?.kind === 'two_min' ? '2-minute version done' : progressText(h, count)}
            </motion.div>
          </div>
          <button onClick={() => count > 0 && bump(-step)} aria-label="Take one back" disabled={count === 0}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted disabled:opacity-30">
            <Minus size={20} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      )}

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title="How much?">
        <div className="flex items-center gap-3">
          <input type="number" inputMode="decimal" min={0} value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder={String(step)} autoFocus />
          <span className="font-bold">{h.unit}</span>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(-v); setAmountOpen(false) }}>Remove</Button>
          <Button className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(v); setAmountOpen(false) }}>Add</Button>
        </div>
      </Modal>
      {menu}
    </motion.div>
  )
}
