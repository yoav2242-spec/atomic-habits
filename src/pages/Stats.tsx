import { Link } from 'react-router-dom'
import { AreaChart, BarChart, Strip } from '../components/Charts'
import { Heatmap } from '../components/Heatmap'
import { Card, InfoTip, PageHeader, XPBar } from '../components/ui'
import { addDays, formatDay, range, WEEKDAY_SHORT, weekday, weekStart } from '../lib/dates'
import { useProgress, type HabitProgress } from '../lib/progress'
import { byDate, isDone, isScheduled, pointsOn, startDate } from '../lib/streaks'

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

export default function Stats() {
  const progress = useProgress()
  if (!progress) return null
  const { today } = progress
  const active = progress.habits.filter((p) => !p.habit.archived)
  const build = active.filter((p) => p.habit.type === 'build')
  const maps = new Map(progress.habits.map((p) => [p.habit.id, byDate(p.checkins)]))
  const starts = new Map(progress.habits.map((p) => [p.habit.id, startDate(p.habit, p.checkins)]))

  /** Done / due for daily & some-days habits on one day. */
  const dayTally = (d: string, list: HabitProgress[] = build) => {
    let due = 0
    let done = 0
    for (const { habit: h } of list) {
      if (h.schedule.kind === 'weekly' || d < starts.get(h.id)! || !isScheduled(h, d)) continue
      const ok = isDone(h, maps.get(h.id)!.get(d))
      if (d === today && !ok) continue // today isn't over yet
      due++
      if (ok) done++
    }
    return { due, done }
  }

  /** Completion for one week, counting X-a-week habits by their weekly goal. */
  const weekRate = (w: string) => {
    let due = 0
    let done = 0
    for (const d of range(w, addDays(w, 6))) {
      if (d > today) break
      const t = dayTally(d)
      due += t.due
      done += t.done
    }
    for (const { habit: h } of build) {
      if (h.schedule.kind !== 'weekly' || addDays(w, 6) < starts.get(h.id)!) continue
      const n = range(w, addDays(w, 6)).filter((d) => d <= today && isDone(h, maps.get(h.id)!.get(d))).length
      due += h.schedule.times
      done += Math.min(n, h.schedule.times)
    }
    return due ? done / due : null
  }

  const weeks = Array.from({ length: 10 }, (_, i) => addDays(weekStart(today), -(9 - i) * 7))
  const weekRates = weeks.map(weekRate)
  const thisWeek = weekRates.at(-1)
  const lastWeek = weekRates.at(-2)
  const diff = thisWeek != null && lastWeek != null ? Math.round((thisWeek - lastWeek) * 100) : null

  // Points earned day by day, then added up: the "1% better" curve.
  const days90 = range(addDays(today, -89), today)
  let running = 0
  const cumulative = days90.map((d) => (running += progress.habits.reduce((n, p) => n + pointsOn(p.habit, maps.get(p.habit.id)!.get(d)), 0)))

  const recent = range(addDays(today, -83), today)
  const byWeekday = MON_FIRST.map((wd) => {
    let due = 0
    let done = 0
    for (const d of recent) {
      if (weekday(d) !== wd) continue
      const t = dayTally(d)
      due += t.due
      done += t.done
    }
    return due ? done / due : null
  })
  const bestDay = byWeekday.reduce<number>((best, v, i) => ((v ?? -1) > (byWeekday[best] ?? -1) ? i : best), 0)

  const overall = (d: string) => {
    const t = dayTally(d)
    if (!t.due) return null
    if (!t.done) return { color: 'color-mix(in srgb, var(--color-peach) 25%, transparent)', title: 'nothing done' }
    return { color: `color-mix(in srgb, var(--color-sage) ${30 + (t.done / t.due) * 70}%, transparent)`, title: `${t.done}/${t.due} done` }
  }

  const bestStreak = Math.max(0, ...progress.habits.map((p) => p.stats.best))
  const liveStreaks = active.filter((p) => p.stats.current > 0).length

  return (
    <div>
      <PageHeader title="Progress" subtitle="Small wins, adding up." />

      <Card className="mb-4 !p-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-lavender) 28%, var(--card)), var(--card))' }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-muted">Your level <InfoTip tip="points" /></div>
            <div className="text-4xl font-black">Level {progress.level.level}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-lavender">{progress.totalPoints}</div>
            <div className="text-xs font-bold text-muted">total points</div>
          </div>
        </div>
        <XPBar into={progress.level.into} need={progress.level.need} />
        <div className="mt-1.5 text-xs font-bold text-muted">{progress.level.need - progress.level.into} points to level {progress.level.level + 1}</div>
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['🔥', String(liveStreaks), 'active streaks'],
          ['🏆', String(bestStreak), 'best streak'],
          ['🏅', String(progress.badgeCount), 'badges'],
        ].map(([icon, v, k]) => (
          <Card key={k} className="!p-3 text-center">
            <div className="text-xl">{icon}</div>
            <div className="text-2xl font-black">{v}</div>
            <div className="text-[11px] font-bold text-muted">{k}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-extrabold text-muted">This week</div>
            <div className="text-4xl font-black">{thisWeek == null ? '–' : `${Math.round(thisWeek * 100)}%`}</div>
          </div>
          {diff !== null && (
            <span className={`rounded-full px-3 py-1 text-sm font-black ${diff >= 0 ? 'bg-sage/20 text-sage-deep dark:text-sage' : 'bg-peach/20 text-peach'}`}>
              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}% vs last week
            </span>
          )}
        </div>
        <p className="mb-3 mt-1 text-xs font-semibold text-muted">How much of your plan you completed, week by week.</p>
        <BarChart values={weekRates} labels={weeks.map((w, i) => (i % 2 === 1 || i === weeks.length - 1 ? formatDay(w, { month: 'short', day: 'numeric' }) : ''))} />
      </Card>

      <Card className="mb-4">
        <div className="font-black">Points, last 90 days</div>
        <p className="mb-3 text-xs font-semibold text-muted">Get 1% better every day and you end up about 37 times better in a year. This line is your small wins adding up.</p>
        <AreaChart values={cumulative} />
      </Card>

      <Card className="mb-4">
        <div className="font-black">Your best days</div>
        <p className="mb-3 text-xs font-semibold text-muted">
          {byWeekday.some((v) => v !== null) ? `You're most consistent on ${WEEKDAY_SHORT[MON_FIRST[bestDay]]}days. Plan tough habits for those days.` : 'Check off habits for a while to see your best days.'}
        </p>
        <BarChart values={byWeekday} labels={MON_FIRST.map((d) => WEEKDAY_SHORT[d])} color="var(--color-sky)" highlightLast={false} height={90} />
      </Card>

      <Card className="mb-4">
        <div className="mb-3 font-black">Every day, last 16 weeks</div>
        <Heatmap today={today} weeks={16} cell={overall} />
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-black uppercase tracking-wider text-muted">Each habit</h2>
      <div className="space-y-2">
        {active.map((p) => {
          const h = p.habit
          const strip = range(addDays(today, -27), today).map((d) => {
            if (d < starts.get(h.id)!) return null
            const c = maps.get(h.id)!.get(d)
            if (h.type === 'break') return c?.kind === 'slip' ? 0 : 1
            return isDone(h, c) ? (c!.kind === 'two_min' ? 0.5 : 1) : 0
          })
          return (
            <Link key={h.id} to={`/habits/${h.id}`} className="bouncy block rounded-3xl border border-line bg-card p-3.5 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-extrabold">{h.emoji} {h.name}</span>
                <span className="text-xs font-black text-muted">
                  {h.type === 'break' ? `🌿 ${p.stats.current}d` : `🔥 ${p.stats.current}`} · {p.rate30 === null ? '–' : `${Math.round(p.rate30 * 100)}%`}
                </span>
              </div>
              <Strip values={strip as (0 | 0.5 | 1 | null)[]} color={h.type === 'break' ? `${h.color}` : h.color} />
              <div className="mt-1 flex justify-between text-[10px] font-bold text-muted"><span>4 weeks ago</span><span>today</span></div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
