import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackButton, Button, Card, useToast } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { getMeta, setMeta } from '../lib/db'
import { addDays, formatDay, range, weekStart } from '../lib/dates'
import { useProgress } from '../lib/progress'
import { dayTally } from '../lib/records'
import { saveReward } from '../lib/rewards'
import { completionRate, isDone, pointsOn } from '../lib/streaks'

/** Weekly review: a short look back at this week, then one focus habit for the next. */
export default function Review() {
  const navigate = useNavigate()
  const toast = useToast()
  const progress = useProgress()
  const currentFocus = useLiveQuery(async () => { const f = await getMeta('focus'); return f ? (JSON.parse(f) as { habit_id: string; until: string }) : null })
  const [focusId, setFocusId] = useState<string | null>(null)
  if (!progress) return null

  const { today } = progress
  const monday = weekStart(today)
  const days = range(monday, today)
  const prevDays = range(addDays(monday, -7), addDays(monday, -1))
  const rate = (ds: string[]) => {
    let due = 0
    let done = 0
    for (const d of ds) {
      const t = dayTally(progress.habits, d)
      due += t.due
      done += t.done
    }
    return due ? done / due : null
  }
  const thisWeek = rate(days)
  const lastWeek = rate(prevDays)
  const active = progress.habits.filter((p) => !p.habit.archived)
  const build = active.filter((p) => p.habit.type === 'build')
  const weekRate = (p: (typeof active)[number]) => completionRate(p.habit, p.checkins, today, days.length)
  const wins = build.filter((p) => (weekRate(p) ?? 0) >= 0.99)
  const sorted = [...build].filter((p) => weekRate(p) !== null).sort((a, b) => (weekRate(b) ?? 0) - (weekRate(a) ?? 0))
  const best = sorted[0]
  const struggling = sorted.length > 1 ? sorted.at(-1) : undefined
  const weekPoints = days.reduce((n, d) => n + build.reduce((m, p) => m + pointsOn(p.habit, p.checkins.find((c) => c.date === d)), 0), 0)
    + progress.rewards.filter((r) => r.date >= monday).reduce((n, r) => n + r.points, 0)
  const checkIns = days.reduce((n, d) => n + build.filter((p) => isDone(p.habit, p.checkins.find((c) => c.date === d))).length, 0)
  const reviewed = progress.rewards.some((r) => r.id === `review_${monday}`)
  const chosen = focusId ?? (currentFocus && currentFocus.until >= today ? currentFocus.habit_id : null)

  const finish = async () => {
    if (chosen) await setMeta('focus', JSON.stringify({ habit_id: chosen, until: addDays(today, 7) }))
    const isNew = await saveReward({ id: `review_${monday}`, date: today, kind: 'review', points: 25, item: 'review' })
    if (isNew) bigCelebration()
    toast(isNew ? 'Review done! +25 points' : 'Focus saved')
    navigate('/')
  }

  return (
    <div>
      <BackButton className="mb-2" />
      <h1 className="text-3xl font-black tracking-tight">Weekly review</h1>
      <p className="mb-5 font-semibold text-muted">Week of {formatDay(monday, { month: 'long', day: 'numeric' })}. Two minutes to look back and plan ahead.</p>

      <Card className="mb-4 !p-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-sky) 25%, var(--card)), var(--card))' }}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-3xl font-black">{thisWeek === null ? '–' : `${Math.round(thisWeek * 100)}%`}</div><div className="text-[14px] font-bold text-muted">of your plan</div></div>
          <div><div className="text-3xl font-black">{checkIns}</div><div className="text-[14px] font-bold text-muted">check-ins</div></div>
          <div><div className="text-3xl font-black text-level">+{weekPoints}</div><div className="text-[14px] font-bold text-muted">points</div></div>
        </div>
        {thisWeek !== null && lastWeek !== null && (
          <p className="mt-3 text-center text-sm font-bold">
            {thisWeek >= lastWeek ? `▲ Up ${Math.round((thisWeek - lastWeek) * 100)}% from last week. Nice!` : `▼ Down ${Math.round((lastWeek - thisWeek) * 100)}% from last week. Let's make next week easier.`}
          </p>
        )}
      </Card>

      <Card className="mb-4 space-y-3 text-sm font-semibold">
        <div className="text-[18px] font-black">Wins</div>
        {wins.length ? <p>You did these every time this week: <b>{wins.map((p) => `${p.habit.emoji} ${p.habit.name}`).join(', ')}</b></p> : <p className="text-muted">No perfect habits this week, but every check-in still counted.</p>}
        {best && <p>Best habit: <b>{best.habit.emoji} {best.habit.name}</b> ({Math.round((weekRate(best) ?? 0) * 100)}%)</p>}
        {struggling && (weekRate(struggling) ?? 0) < 0.7 && (
          <p>Hardest this week: <b>{struggling.habit.emoji} {struggling.habit.name}</b>. Could you make it easier, use the 2-minute version, or stack it after something you already do?</p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="mb-1 text-[18px] font-black">Pick one focus for next week</div>
        <p className="mb-3 text-[14px] font-semibold text-muted">It goes to the top of your Today list, so it gets your best energy.</p>
        <div className="space-y-2">
          {active.map((p) => (
            <button key={p.habit.id} onClick={() => setFocusId(p.habit.id)}
              className={`bouncy flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${chosen === p.habit.id ? 'border-lavender bg-lavender/10' : 'border-line'}`}>
              <span className="text-xl">{p.habit.emoji}</span>
              <span className="flex-1 font-bold">{p.habit.name}</span>
              <span className="text-xs font-black text-muted">{weekRate(p) === null ? '' : `${Math.round((weekRate(p) ?? 0) * 100)}%`}</span>
              {chosen === p.habit.id && <span>🎯</span>}
            </button>
          ))}
        </div>
      </Card>

      <Button className="w-full text-lg" onClick={finish}>{reviewed ? 'Save focus' : 'Finish review (+25)'}</Button>
    </div>
  )
}
