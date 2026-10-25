import { Award, Clock, Flame, Link2, MapPin, Minus, NotebookPen, Pencil, Plus, Snowflake, Sprout, Timer, TrendingUp } from 'lucide-react'
import { buzz } from '../lib/prefs'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isAmount, progressText, servingsText, stepOf } from '../lib/amounts'
import { burst } from '../lib/celebrate'
import { getCheckin, increment, restoreCheckin, toggleDone } from '../lib/repo'
import { isDone, nextMilestone, POINTS, type HabitStats } from '../lib/streaks'
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

function Meta({ icon, children, color }: { icon: ReactNode; children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: color ?? 'var(--muted)' }}>
      {icon}
      {children}
    </span>
  )
}

/** Round icon button with a fingertip-sized tap area. */
function IconButton({ label, onClick, to, children }: { label: string; onClick?: () => void; to?: string; children: ReactNode }) {
  const cls = 'bouncy flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted active:bg-[var(--soft)]'
  return to ? <Link to={to} aria-label={label} className={cls}>{children}</Link> : <button onClick={onClick} aria-label={label} className={cls}>{children}</button>
}

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
      className={`relative flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full ${done ? 'puffy' : 'clay-in'}`}
      style={done ? { background: color } : undefined}
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="var(--color-on-pastel)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
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

  const next = nextMilestone(stats.current)
  const toBadge = next ? next - stats.current : null
  const tint = (pct: number) => `color-mix(in srgb, ${h.color} ${pct}%, var(--card))`

  const emojiBubble = (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-[26px]" style={{ background: tint(38) }}>
      {h.emoji}
    </span>
  )

  if (h.type === 'break') {
    const slipped = c?.kind === 'slip'
    return (
      <motion.div layout transition={spring} id={`habit-${h.id}`} className="clay scroll-mt-6 rounded-[26px] p-4">
        <div className="flex items-center gap-3.5">
          {emojiBubble}
          <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{h.name}</div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {slipped
                ? <Meta icon={<Sprout size={14} />} color="var(--color-rose)">Slipped{c.count > 1 ? ` ×${c.count}` : ''}</Meta>
                : <Meta icon={<Sprout size={14} />} color="var(--color-sage-deep)">{stats.current} day{stats.current === 1 ? '' : 's'} clean</Meta>}
              {stats.best > stats.current && <Meta icon={<Award size={14} />}>best {stats.best}</Meta>}
            </div>
          </Link>
          <IconButton label="Edit habit" to={`/habits/${h.id}/edit`}><Pencil size={17} /></IconButton>
        </div>
        <div className="mt-3 flex justify-end">
          {slipped ? (
            <button onClick={p.onUndoSlip} className="min-h-11 px-4 text-sm font-bold text-muted underline underline-offset-2">Undo slip</button>
          ) : (
            <Button variant="secondary" className="!min-h-11 !py-2 text-sm" onClick={p.onSlip}>I slipped</Button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      transition={spring}
      id={`habit-${h.id}`}
      className="clay relative scroll-mt-6 rounded-[26px] p-4"
      style={{ marginLeft: p.depth ? Math.min(p.depth, 3) * 14 : 0, background: done ? tint(22) : undefined, transition: 'background 0.5s' }}
    >
      {p.stackLabel && (
        <div className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-muted"><Link2 size={14} /> After I {p.stackLabel}</div>
      )}

      <div className="flex items-center gap-3.5">
        {emojiBubble}
        <Link to={`/habits/${h.id}`} className="min-w-0 flex-1">
          <motion.div animate={{ opacity: done ? 0.6 : 1 }} className="line-clamp-2 text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{h.name}</motion.div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {stats.current > 0 && <Meta icon={<Flame size={14} />} color="var(--flame)">{streakLabel(stats)}</Meta>}
            {stats.freezes > 0 && <Meta icon={<Snowflake size={14} />}><span className="sr-only">Streak freezes: </span>{stats.freezes}</Meta>}
            {h.schedule.kind === 'weekly' && <Meta icon={<Award size={14} />}>{stats.weekDone}/{h.schedule.times} this week</Meta>}
            {h.cue_time && <Meta icon={<Clock size={14} />}>{h.cue_time}</Meta>}
            {!h.cue_time && h.location && <Meta icon={<MapPin size={14} />}>{h.location}</Meta>}
          </div>
        </Link>

        <div className="relative">
          <AnimatePresence>
            {floatPts && (
              <motion.span key={floatPts.key} className="pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-xs font-black text-bg"
                initial={{ y: 6, opacity: 0, scale: 0.6 }} animate={{ y: -10, opacity: 1, scale: 1 }} exit={{ y: -26, opacity: 0 }} transition={spring}
                onAnimationComplete={() => setTimeout(() => setFloatPts(null), 500)}>
                +{floatPts.pts}
              </motion.span>
            )}
          </AnimatePresence>
          {amount || target > 1 ? (
            <motion.button ref={checkRef} whileTap={squish} transition={spring} onClick={() => bump(step)}
              aria-label={amount ? `Add one ${h.step_label || `${step} ${h.unit}`}` : 'Plus one'}
              className="puffy flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-full"
              style={{ background: done ? h.color : tint(70) }}>
              <Plus size={24} strokeWidth={3} color="var(--color-on-pastel)" />
              <span className="text-[11px] font-extrabold leading-none text-on-pastel">{amount ? h.step_label || `${step}` : `${c?.count ?? 0}/${target}`}</span>
            </motion.button>
          ) : (
            <CheckButton done={done} half={c?.kind === 'two_min'} color={h.color} onClick={() => tap(c?.kind === 'two_min' ? 'two_min' : 'full')} refEl={checkRef} />
          )}
        </div>
      </div>

      {(amount || target > 1) && (
        <div className="mt-3.5">
          <div className="clay-in h-3.5 overflow-hidden rounded-full p-[3px]">
            <motion.div className="puffy h-full rounded-full" initial={false} animate={{ width: `${Math.max(count ? 6 : 0, Math.min(100, (count / target) * 100))}%` }} transition={softSpring} style={{ background: h.color }} />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[14px] font-bold">
            <motion.span key={popKey} initial={{ scale: 0.85 }} animate={{ scale: 1 }} transition={spring} className="tabular-nums">
              {c?.kind === 'two_min' ? '2-minute version done' : progressText(h, count)}
            </motion.span>
            {servingsText(h, count) && <span className="text-muted">· {servingsText(h, count)}</span>}
            <span className="-mr-2 ml-auto flex">
              <IconButton label="Take one back" onClick={() => count > 0 && bump(-step)}><Minus size={17} /></IconButton>
              {amount && <IconButton label="Other amount" onClick={() => { setAmountText(''); setAmountOpen(true) }}><Pencil size={16} /></IconButton>}
            </span>
          </div>
        </div>
      )}

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title="How much?">
        <p className="mb-4 text-sm font-semibold text-muted">Type any amount, like a cup you drank somewhere else.</p>
        <div className="flex items-center gap-3">
          <input type="number" inputMode="decimal" min={0} value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder={String(step)} autoFocus />
          <span className="font-black">{h.unit}</span>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(-v); setAmountOpen(false) }}>Remove</Button>
          <Button className="flex-1" onClick={() => { const v = Number(amountText); if (v > 0) bump(v); setAmountOpen(false) }}>Add</Button>
        </div>
      </Modal>

      <AnimatePresence initial={false}>
        {isToday && !done && (stats.atRisk || stats.justReset) && (
          <motion.div key="warn" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={softSpring} className="overflow-hidden">
            <div className="tray mt-3.5 flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[14px] font-semibold leading-snug">
              {stats.atRisk ? <Snowflake size={18} className="mt-0.5 shrink-0 text-muted" /> : <Sprout size={18} className="mt-0.5 shrink-0 text-sage-deep" />}
              <span className="flex-1">
                {stats.atRisk
                  ? "A freeze saved your streak yesterday. Freezes can't be used two days in a row, so do it today."
                  : "Your streak reset, and that's okay. Never miss twice: start a new one today."}
              </span>
              <InfoTip tip={stats.atRisk ? 'freeze' : 'never_miss_twice'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {p.levelUp && isToday && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={p.onLevelUp}
          className="mt-3.5 flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-[color-mix(in_srgb,var(--color-lavender)_38%,var(--card))] px-3.5 py-2.5 text-left text-[14px] font-bold leading-snug">
          <TrendingUp size={18} />
          <span className="flex-1">This is getting easy. Ready to make it a little harder?</span>
          <span className="shrink-0 font-black text-level">Level up</span>
        </motion.button>
      )}

      <div className="-mb-1 -mr-1.5 mt-3 flex items-center gap-1">
        {h.two_min_version && !done ? (
          <button onClick={() => tap('two_min')} className="tray bouncy mr-1 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 text-left text-[14px] font-bold text-muted">
            <Timer size={16} className="shrink-0" />
            <span className="truncate">Busy? Just {h.two_min_version}</span>
          </button>
        ) : toBadge !== null && stats.current > 0 && toBadge <= 3 ? (
          <span className="flex flex-1 items-center gap-1.5 text-[14px] font-bold text-muted">
            <Award size={16} /> {toBadge} more to the {next}-{stats.unit} badge
          </span>
        ) : <span className="flex-1" />}
        <IconButton label={c?.note ? 'Edit note' : 'Add note'} onClick={p.onNote}>
          <NotebookPen size={17} className={c?.note ? 'text-sage-deep' : ''} />
        </IconButton>
        <IconButton label="Edit habit" to={`/habits/${h.id}/edit`}><Pencil size={17} /></IconButton>
      </div>
    </motion.div>
  )
}
