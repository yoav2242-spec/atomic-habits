import { Link } from 'react-router-dom'
import { Heatmap } from '../components/Heatmap'
import { Card, PageHeader } from '../components/ui'
import { addDays, range } from '../lib/dates'
import { useCheckinsByHabit, useHabits, useToday } from '../lib/hooks'
import { byDate, completionRate, habitStats, isDone, isScheduled, startDate } from '../lib/streaks'

export default function Stats() {
  const today = useToday()
  const habits = useHabits()
  const all = useCheckinsByHabit()
  if (!habits || !all) return null

  const build = habits.filter((h) => !h.archived && h.type === 'build')
  const maps = new Map(habits.map((h) => [h.id, byDate(all.get(h.id) ?? [])]))
  const starts = new Map(habits.map((h) => [h.id, startDate(h, all.get(h.id) ?? [])]))
  const doneOn = (d: string) => build.filter((h) => isDone(h, maps.get(h.id)!.get(d))).length

  const totalDone = habits.filter((h) => h.type === 'build').reduce((n, h) => n + [...maps.get(h.id)!.values()].filter((c) => isDone(h, c)).length, 0)
  const rates = build.map((h) => completionRate(h, all.get(h.id) ?? [], today, 30)).filter((r): r is number => r !== null)
  const avg = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null

  // Running total of check-ins over the last 90 days.
  const days = range(addDays(today, -89), today)
  let sum = 0
  const cumulative = days.map((d) => (sum += doneOn(d)))
  const max = Math.max(1, sum)
  const points = cumulative.map((v, i) => `${(i / (days.length - 1)) * 300},${100 - (v / max) * 96}`).join(' ')

  const overall = (d: string) => {
    const due = build.filter((h) => d >= starts.get(h.id)! && isScheduled(h, d) && h.schedule.kind !== 'weekly')
    if (due.length === 0) return null
    const share = due.filter((h) => isDone(h, maps.get(h.id)!.get(d))).length / due.length
    if (share === 0) return d < today ? { color: 'rgba(120,113,108,.25)', title: 'nothing done' } : null
    return { color: `rgba(245,158,11,${0.25 + share * 0.75})`, title: `${Math.round(share * 100)}% done` }
  }

  return (
    <div>
      <PageHeader title="Progress" subtitle="Small wins, adding up." />
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          ['Check-ins', String(totalDone)],
          ['Last 30 days', avg === null ? '–' : `${avg}%`],
          ['Habits', String(build.length)],
        ].map(([k, v]) => (
          <Card key={k} className="!p-3 text-center">
            <div className="text-xl font-bold">{v}</div>
            <div className="text-xs text-stone-500">{k}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="mb-1 text-sm font-medium">Total check-ins, last 90 days</div>
        <p className="mb-3 text-xs text-stone-500">
          Getting just 1% better each day adds up to about 37 times better over a year. Each check-in moves this line up.
        </p>
        <svg viewBox="0 0 300 100" className="h-28 w-full overflow-visible" preserveAspectRatio="none">
          <polyline points={`0,100 ${points} 300,100`} fill="rgba(245,158,11,.15)" stroke="none" />
          <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 text-sm font-medium">All habits, last 20 weeks</div>
        <Heatmap today={today} weeks={20} cell={overall} />
      </Card>

      <div className="space-y-2">
        {habits.filter((h) => !h.archived).map((h) => {
          const r = completionRate(h, all.get(h.id) ?? [], today, 30)
          const s = habitStats(h, all.get(h.id) ?? [], today)
          return (
            <Link key={h.id} to={`/habits/${h.id}`} className="block rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">{h.emoji} {h.name}</span>
                <span className="text-stone-500">{h.type === 'break' ? `${s.current}d clean` : `🔥 ${s.current}`} · {r === null ? '–' : `${Math.round(r * 100)}%`}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div className="h-full rounded-full" style={{ width: `${(r ?? 0) * 100}%`, background: h.color }} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
