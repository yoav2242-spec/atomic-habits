import { Link } from 'react-router-dom'
import { addDays, range } from '../lib/dates'
import type { HabitProgress, Progress } from '../lib/progress'
import { STAGES, stageOf, trend } from '../lib/stages'
import { byDate, isDone, startDate } from '../lib/streaks'
import { Strip } from './Charts'
import { Card } from './ui'

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Good vs bad habits, the three stages, best and weakest habit, and how you compare with research. */
export function ProgressInsights({ progress }: { progress: Progress }) {
  const { today } = progress
  const active = progress.habits.filter((p) => !p.habit.archived)
  const building = active.filter((p) => p.habit.type === 'build')
  const breaking = active.filter((p) => p.habit.type === 'break')
  if (active.length === 0) return null

  const buildRate = avg(building.map((p) => p.rate30).filter((r): r is number => r !== null))
  const cleanDays = breaking.reduce((n, p) => n + p.stats.current, 0)
  const stages = STAGES.map((s) => ({ ...s, habits: active.filter((p) => stageOf(p, today).stage.key === s.key) }))
  const maintained = active.filter((p) => stageOf(p, today).stage.key === 'automatic' && (p.rate30 ?? 0) >= 0.8)

  // Best and weakest need at least a week of history to be fair.
  const rated = active.filter((p) => p.rate30 !== null && startDate(p.habit, p.checkins) <= addDays(today, -7))
  const sorted = [...rated].sort((a, b) => (b.rate30 ?? 0) - (a.rate30 ?? 0) || b.stats.current - a.stats.current)
  const best = sorted[0]
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
  const oldest = Math.max(0, ...active.map((p) => stageOf(p, today).days))

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Card className="!p-4" style={{ background: 'color-mix(in srgb, var(--color-sage) 16%, var(--card))' }}>
          <div className="text-[13px] font-extrabold text-muted">Building</div>
          <div className="text-3xl font-black">{building.length}</div>
          <div className="text-[13px] font-bold text-muted">good habit{building.length === 1 ? '' : 's'} · {pct(buildRate)} done (30 days)</div>
        </Card>
        <Card className="!p-4" style={{ background: 'color-mix(in srgb, var(--color-peach) 16%, var(--card))' }}>
          <div className="text-[13px] font-extrabold text-muted">Breaking</div>
          <div className="text-3xl font-black">{breaking.length}</div>
          <div className="text-[13px] font-bold text-muted">bad habit{breaking.length === 1 ? '' : 's'} · {cleanDays} clean days now</div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="text-[17px] font-black">Your habits' journey</div>
        <p className="mb-3 text-[13px] font-semibold text-muted">Every habit grows from starting to automatic. Practice days move it along.</p>
        <div className="grid grid-cols-3 gap-2">
          {stages.map((s) => (
            <div key={s.key} className="rounded-2xl tray p-2.5 text-center">
              <div className="text-2xl">{s.icon}</div>
              <div className="text-xl font-black">{s.habits.length}</div>
              <div className="text-[11px] font-extrabold text-muted">{s.label}</div>
              <div className="text-[11px] font-semibold text-muted">{s.to === Infinity ? '66+ days' : `${s.from}–${s.to} days`}</div>
            </div>
          ))}
        </div>
        {maintained.length > 0 && (
          <p className="mt-3 text-xs font-bold text-sage-deep">
            ✨ Keeping up {maintained.length} automatic habit{maintained.length === 1 ? '' : 's'}: {maintained.map((p) => p.habit.name).join(', ')}
          </p>
        )}
      </Card>

      {(best || weakest) && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {best && (
            <Link to={`/habits/${best.habit.id}`} className="bouncy">
              <Card className="h-full !p-4">
                <div className="text-[13px] font-extrabold text-muted">Most successful</div>
                <div className="mt-1 text-2xl">{best.habit.emoji}</div>
                <div className="line-clamp-2 font-black leading-tight">{best.habit.name}</div>
                <div className="text-xs font-bold text-sage-deep">{pct(best.rate30)} · {best.stats.current} in a row</div>
              </Card>
            </Link>
          )}
          {weakest && (
            <Link to={`/habits/${weakest.habit.id}`} className="bouncy">
              <Card className="h-full !p-4">
                <div className="text-[13px] font-extrabold text-muted">Needs some love</div>
                <div className="mt-1 text-2xl">{weakest.habit.emoji}</div>
                <div className="line-clamp-2 font-black leading-tight">{weakest.habit.name}</div>
                <div className="text-xs font-bold text-[var(--flame)]">{pct(weakest.rate30)} · try the 2-minute version</div>
              </Card>
            </Link>
          )}
        </div>
      )}

      <Card className="mb-4">
        <div className="text-[17px] font-black">You vs. the research</div>
        <p className="mb-3 text-[13px] font-semibold text-muted">
          The app can't see other people's data, so here's how you compare with a well-known study of how people form new habits.
        </p>
        <div className="space-y-3 text-sm font-semibold">
          <div>
            <div className="mb-1 flex justify-between"><span>Average time for a habit to feel automatic: <b>66 days</b></span></div>
            <div className="h-3 overflow-hidden rounded-full tray">
              <div className="h-full rounded-full bg-sage transition-all duration-700" style={{ width: `${Math.min(100, (oldest / 66) * 100)}%` }} />
            </div>
            <div className="mt-1 text-[13px] font-bold text-muted">
              {oldest >= 66 ? `Your longest-practiced habit is past 66 days. You're ahead of the average!` : `Your longest-practiced habit: ${oldest} days. ${66 - oldest} to go to reach the average.`}
            </div>
          </div>
          <p className="text-[13px] font-semibold text-muted">
            In that study it took anywhere from 18 to 254 days, so don't worry if yours feels slow. Missing a single day didn't
            stop people from forming the habit. That's why the app only asks you to never miss twice.
          </p>
        </div>
      </Card>
    </>
  )
}

function HabitRow({ p, today }: { p: HabitProgress; today: string }) {
  const h = p.habit
  const map = byDate(p.checkins)
  const start = startDate(h, p.checkins)
  const { stage, days, progress: stageProgress, toNext } = stageOf(p, today)
  const t = trend(p, today)
  const strip = range(addDays(today, -27), today).map((d) => {
    if (d < start) return null
    const c = map.get(d)
    if (h.type === 'break') return c?.kind === 'slip' ? 0 : 1
    return isDone(h, c) ? (c!.kind === 'two_min' ? 0.5 : 1) : 0
  })
  return (
    <Link to={`/habits/${h.id}`} className="bouncy clay block rounded-[22px] p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-extrabold">{h.emoji} {h.name}</span>
        <span className="shrink-0 text-[13px] font-black text-muted tabular-nums">
          {h.type === 'break' ? `${p.stats.current}d clean` : `${p.stats.current} in a row`} · {pct(p.rate30)}
          {t !== null && Math.abs(t) >= 0.05 && <span className={t > 0 ? 'text-sage-deep' : 'text-[var(--flame)]'}> {t > 0 ? '▲' : '▼'}</span>}
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-muted">
        <span>{stage.icon} {stage.label}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full tray">
          <div className="h-full rounded-full" style={{ width: `${stageProgress * 100}%`, background: h.color }} />
        </div>
        <span>{toNext ? `${toNext} days to ${STAGES[STAGES.findIndex((s) => s.key === stage.key) + 1].label.toLowerCase()}` : `${days} days`}</span>
      </div>
      <Strip values={strip as (0 | 0.5 | 1 | null)[]} color={h.color} />
      <div className="mt-1 flex justify-between text-[11px] font-bold text-muted"><span>4 weeks ago</span><span>today</span></div>
    </Link>
  )
}

/** Every habit, split into the ones you're building and the ones you're breaking. */
export function HabitBreakdown({ progress }: { progress: Progress }) {
  const active = progress.habits.filter((p) => !p.habit.archived)
  const groups = [
    { title: 'Building good habits', list: active.filter((p) => p.habit.type === 'build') },
    { title: 'Breaking bad habits', list: active.filter((p) => p.habit.type === 'break') },
  ].filter((g) => g.list.length)
  return (
    <>
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="label mb-2.5 ml-1 mt-7">{g.title}</h2>
          <div className="space-y-3">{g.list.map((p) => <HabitRow key={p.habit.id} p={p} today={progress.today} />)}</div>
        </section>
      ))}
    </>
  )
}
