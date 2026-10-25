import { useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, useToast } from '../components/ui'
import { db } from '../lib/db'
import { addDays, formatDay, range, WEEKDAY_LONG, weekday } from '../lib/dates'
import { useProgress } from '../lib/progress'
import { dayTally } from '../lib/records'
import { isDone, isScheduled, pointsOn } from '../lib/streaks'

function Slide({ from, to, children }: { from: string; to: string; children: ReactNode }) {
  return (
    <div className="animate-rise mb-3 rounded-[2rem] p-6 text-on-pastel shadow-[0_10px_30px_-12px_rgba(60,60,90,0.5)]" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {children}
    </div>
  )
}

/** A Wrapped-style look back at one month. */
export default function Recap() {
  const { ym = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const progress = useProgress()

  useEffect(() => {
    if (ym) db.meta.put({ key: `recap_seen:${ym}`, value: '1' })
  }, [ym])

  if (!progress) return null
  const { today } = progress
  const first = `${ym}-01`
  const last = addDays(`${addDays(first, 32).slice(0, 7)}-01`, -1)
  const days = range(first, last < today ? last : today)
  const monthName = formatDay(first, { month: 'long', year: 'numeric' })
  const prevYm = addDays(first, -1).slice(0, 7)
  const nextYm = addDays(last, 1).slice(0, 7)

  const build = progress.habits.filter((p) => p.habit.type === 'build')
  const breaking = progress.habits.filter((p) => p.habit.type === 'break')
  const inMonth = (d: string) => d >= first && d <= last
  const checkIns = build.reduce((n, p) => n + p.checkins.filter((c) => inMonth(c.date) && isDone(p.habit, c)).length, 0)
  const points = days.reduce((n, d) => n + build.reduce((m, p) => m + pointsOn(p.habit, p.checkins.find((c) => c.date === d)), 0), 0)
    + progress.rewards.filter((r) => inMonth(r.date)).reduce((n, r) => n + r.points, 0)
  const perfect = days.filter((d) => { const t = dayTally(progress.habits, d); return t.due > 0 && t.done === t.due }).length
  const slips = breaking.reduce((n, p) => n + p.checkins.filter((c) => inMonth(c.date) && c.kind === 'slip').length, 0)

  // Each habit's best run of done days inside the month, and its completion.
  const perHabit = build.map((p) => {
    let run = 0
    let bestRun = 0
    let due = 0
    let done = 0
    for (const d of days) {
      if (!isScheduled(p.habit, d)) continue
      const ok = isDone(p.habit, p.checkins.find((c) => c.date === d))
      due++
      if (ok) { done++; run++; bestRun = Math.max(bestRun, run) } else run = 0
    }
    return { p, bestRun, rate: due ? done / due : 0, done }
  }).filter((x) => x.done > 0)
  const star = [...perHabit].sort((a, b) => b.rate - a.rate || b.done - a.done)[0]
  const longest = [...perHabit].sort((a, b) => b.bestRun - a.bestRun)[0]

  const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const ds = days.filter((d) => weekday(d) === wd)
    const done = ds.reduce((n, d) => n + dayTally(progress.habits, d).done, 0)
    return { wd, done }
  })
  const topDay = [...byWeekday].sort((a, b) => b.done - a.done)[0]

  const votesBy = progress.identities.map((i) => ({
    name: i.name,
    votes: progress.habits.filter((p) => p.habit.identity_id === i.id).reduce((n, p) => n + p.checkins.filter((c) => inMonth(c.date) && isDone(p.habit, c)).length, 0),
  })).filter((v) => v.votes > 0).sort((a, b) => b.votes - a.votes)

  const share = async () => {
    const text = `My ${monthName} in Atomic: ${checkIns} check-ins, ${perfect} perfect days, ${points} points${star ? `. Star habit: ${star.p.habit.name}` : ''} 🌱`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); toast('Copied to clipboard') }
    } catch {
      // Share sheet closed.
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="-ml-1 flex min-h-11 items-center pr-3 text-[16px] font-bold text-muted">‹ Back</button>
        <div className="flex gap-1.5">
          <button onClick={() => navigate(`/recap/${prevYm}`, { replace: true })} className="clay-sm bouncy h-11 w-11 rounded-full font-black" aria-label="Previous month">‹</button>
          <button onClick={() => navigate(`/recap/${nextYm}`, { replace: true })} disabled={nextYm > today.slice(0, 7)} className="clay-sm bouncy h-11 w-11 rounded-full font-black disabled:opacity-30" aria-label="Next month">›</button>
        </div>
      </div>

      <Slide from="var(--color-lavender)" to="var(--color-rose)">
        <div className="text-sm font-extrabold text-on-pastel/70">Your month in habits</div>
        <div className="mt-1 text-4xl font-black">{monthName}</div>
        <div className="mt-6 text-6xl font-black">{checkIns}</div>
        <div className="font-bold text-on-pastel/70">check-ins. Each one a vote for who you're becoming.</div>
      </Slide>

      {checkIns === 0 && breaking.length === 0 ? (
        <p className="p-4 text-center font-semibold text-muted">Nothing tracked this month yet.</p>
      ) : (
        <>
          <Slide from="var(--color-sage)" to="var(--color-sky)">
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-5xl font-black">{perfect}</div><div className="font-bold text-on-pastel/70">perfect days 💯</div></div>
              <div><div className="text-5xl font-black">+{points}</div><div className="font-bold text-on-pastel/70">points ⭐</div></div>
            </div>
          </Slide>

          {star && (
            <Slide from="var(--color-butter)" to="var(--color-peach)">
              <div className="text-sm font-extrabold text-on-pastel/70">⭐ Star habit</div>
              <div className="mt-2 text-5xl">{star.p.habit.emoji}</div>
              <div className="text-2xl font-black">{star.p.habit.name}</div>
              <div className="font-bold text-on-pastel/70">{Math.round(star.rate * 100)}% of the time. Amazing.</div>
            </Slide>
          )}

          {longest && longest.bestRun >= 2 && (
            <Slide from="var(--color-peach)" to="var(--color-rose)">
              <div className="text-sm font-extrabold text-on-pastel/70">🔥 Longest run</div>
              <div className="mt-2 text-5xl font-black">{longest.bestRun} days</div>
              <div className="font-bold text-on-pastel/70">of {longest.p.habit.emoji} {longest.p.habit.name} in a row</div>
            </Slide>
          )}

          {topDay && topDay.done > 0 && (
            <Slide from="var(--color-sky)" to="var(--color-lavender)">
              <div className="text-sm font-extrabold text-on-pastel/70">📅 Your power day</div>
              <div className="mt-2 text-4xl font-black">{WEEKDAY_LONG[topDay.wd]}s</div>
              <div className="font-bold text-on-pastel/70">You got the most done on {WEEKDAY_LONG[topDay.wd]}s this month.</div>
            </Slide>
          )}

          {(votesBy.length > 0 || breaking.length > 0) && (
            <Slide from="var(--color-lavender)" to="var(--color-sky)">
              {votesBy.length > 0 && (
                <>
                  <div className="mb-2 text-sm font-extrabold text-on-pastel/70">🪞 Who you became</div>
                  {votesBy.slice(0, 3).map((v) => (
                    <div key={v.name} className="flex justify-between text-lg font-black"><span>I am {v.name}</span><span>{v.votes} votes</span></div>
                  ))}
                </>
              )}
              {breaking.length > 0 && (
                <div className={`font-bold text-on-pastel/70 ${votesBy.length ? 'mt-4' : ''}`}>
                  ✂️ Breaking bad habits: {slips === 0 ? 'zero slips all month! 🎉' : `${slips} slip${slips === 1 ? '' : 's'}, and you kept going.`}
                </div>
              )}
            </Slide>
          )}
        </>
      )}

      <Button variant="lavender" className="mt-2 w-full" onClick={share}>📤 Share my month</Button>
      <p className="mt-2 text-center text-[14px] font-semibold text-muted">Or take a screenshot to keep it.</p>
    </div>
  )
}
