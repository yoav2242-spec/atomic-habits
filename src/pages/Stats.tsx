import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { HabitBreakdown, ProgressInsights } from '../components/ProgressInsights'
import { markFlag } from '../components/Quests'
import { computeRecords } from '../lib/records'
import { AreaChart, BarChart } from '../components/Charts'
import { Heatmap } from '../components/Heatmap'
import { Card, InfoTip, PageHeader, XPBar } from '../components/ui'
import { addDays, formatDay, range, todayKey, WEEKDAY_LONG, WEEKDAY_SHORT, weekday, weekStart } from '../lib/dates'
import { useProgress, type HabitProgress } from '../lib/progress'
import { byDate, isDone, isScheduled, pointsOn, startDate } from '../lib/streaks'

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

export default function Stats() {
  const progress = useProgress()
  const records = useMemo(() => (progress ? computeRecords(progress) : null), [progress])
  useEffect(() => {
    markFlag(todayKey(), 'visited_stats')
  }, [])
  if (!progress || !records) return null
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

      {/* The screen's question first: am I getting better? */}
      <Card className="mb-4 !p-5">
        <h2 className="label">This week</h2>
        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-[44px] font-black leading-none tracking-[-0.03em] tabular-nums">{thisWeek == null ? '–' : `${Math.round(thisWeek * 100)}%`}</span>
          <span className="text-[16px] font-bold text-muted">of your plan done</span>
        </div>
        <p className="mb-4 mt-2 text-[16px] font-semibold leading-snug">
          {diff === null ? 'Your weekly trend shows up after your second week.'
            : diff === 0 ? 'Same as last week. Steady counts.'
            : diff > 0 ? <><span className="font-black text-sage-deep">Up {diff}%</span> on last week.</>
            : <><span className="font-black text-[var(--flame)]">Down {Math.abs(diff)}%</span> on last week. Never miss twice.</>}
        </p>
        <BarChart values={weekRates} labels={weeks.map((w, i) => (i % 3 === 0 || i === weeks.length - 1 ? formatDay(w, { month: 'short', day: 'numeric' }) : ''))} />
      </Card>

      <Card className="mb-4 !p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-[22px] font-black tracking-[-0.01em]">Level {progress.level.level} <InfoTip tip="points" /></h2>
          <span className="text-[14px] font-bold text-muted tabular-nums">{progress.level.need - progress.level.into} to level {progress.level.level + 1}</span>
        </div>
        <div className="mt-2.5"><XPBar into={progress.level.into} need={progress.level.need} /></div>
        <dl className="tray mt-4 grid grid-cols-4 rounded-[18px] py-3 text-center">
          {[
            [progress.totalPoints.toLocaleString(), 'points'],
            [String(liveStreaks), 'streaks on'],
            [String(bestStreak), 'best streak'],
            [String(progress.badgeCount), 'badges'],
          ].map(([v, k], i) => (
            <div key={k} className={i ? 'border-l-2 border-[var(--line)]' : ''}>
              <dd className="text-[20px] font-black leading-tight tabular-nums">{v}</dd>
              <dt className="text-[13px] font-bold leading-tight text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ['/review', 'Weekly review'],
          [`/recap/${addDays(`${today.slice(0, 8)}01`, -1).slice(0, 7)}`, 'Monthly recap'],
          ['/rewards', 'Rewards'],
        ] as const).map(([to, label]) => (
          <Link key={label} to={to} className="clay-sm bouncy flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 py-2 text-[17px] font-extrabold">
            {label}
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-[18px] font-black">Personal records</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['', `${records.bestStreak.value} ${records.bestStreak.unit}s`, 'Longest streak', records.bestStreak.habit],
            ['', `${records.perfectRun.best} days`, 'Perfect days in a row', records.perfectRun.current > 0 ? `now: ${records.perfectRun.current}` : undefined],
            ['', String(records.mostInADay.value), 'Most habits in a day', records.mostInADay.date && formatDay(records.mostInADay.date, { month: 'short', day: 'numeric' })],
            ['', records.bestWeek.week ? `${Math.round(records.bestWeek.rate * 100)}%` : '–', 'Best week', records.bestWeek.week && `week of ${formatDay(records.bestWeek.week, { month: 'short', day: 'numeric' })}`],
          ].map(([, value, label, sub]) => (
            <div key={label} className="tray rounded-[18px] p-3">
              <div className="text-[14px] font-extrabold leading-tight text-muted">{label}</div>
              <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
              {sub && <div className="truncate text-[12px] font-bold text-muted">{sub}</div>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[14px] font-semibold text-muted">{records.perfectDays} perfect day{records.perfectDays === 1 ? '' : 's'} so far. Beat your records to get a celebration!</p>
      </Card>

      <ProgressInsights progress={progress} />

      <Card className="mb-4">
        <h2 className="text-[18px] font-black">Points, last 90 days</h2>
        <p className="mb-3 text-[14px] font-semibold text-muted">Get 1% better every day and you end up about 37 times better in a year. This line is your small wins adding up.</p>
        <AreaChart values={cumulative} />
      </Card>

      <Card className="mb-4">
        <h2 className="text-[18px] font-black">Your best days</h2>
        <p className="mb-3 text-[14px] font-semibold text-muted">
          {byWeekday.some((v) => v !== null) ? `You're most consistent on ${WEEKDAY_LONG[MON_FIRST[bestDay]]}s. Plan tough habits for those days.` : 'Check off habits for a while to see your best days.'}
        </p>
        <BarChart values={byWeekday} labels={MON_FIRST.map((d) => WEEKDAY_SHORT[d])} color="var(--color-sky)" highlightLast={false} height={90} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-3 text-[18px] font-black">Every day, last 16 weeks</h2>
        <Heatmap today={today} weeks={16} cell={overall} />
      </Card>

      <HabitBreakdown progress={progress} />
    </div>
  )
}
