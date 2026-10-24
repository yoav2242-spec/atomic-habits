import { addDays, range, weekStart } from './dates'
import type { HabitProgress, Progress } from './progress'
import { isDone, isScheduled, startDate } from './streaks'

// Personal bests, worked out from the whole history.

export interface DayTally { due: number; done: number }

/** Done / due for daily and some-days habits on one day (X-a-week habits are judged per week). */
export function dayTally(habits: HabitProgress[], d: string): DayTally {
  let due = 0
  let done = 0
  for (const p of habits) {
    const h = p.habit
    if (h.archived || h.type !== 'build' || h.schedule.kind === 'weekly' || d < startDate(h, p.checkins) || !isScheduled(h, d)) continue
    due++
    if (isDone(h, p.checkins.find((c) => c.date === d))) done++
  }
  return { due, done }
}

export interface Records {
  bestStreak: { value: number; habit?: string; unit: string }
  mostInADay: { value: number; date?: string }
  perfectRun: { best: number; current: number }
  perfectDays: number
  bestWeek: { rate: number; week?: string }
}

export function computeRecords(progress: Progress): Records {
  const { today, habits } = progress
  const build = habits.filter((p) => p.habit.type === 'build')
  const best = [...habits].sort((a, b) => b.stats.best - a.stats.best)[0]
  const first = habits.reduce((min, p) => { const s = startDate(p.habit, p.checkins); return s < min ? s : min }, today)

  let mostInADay = { value: 0, date: undefined as string | undefined }
  let run = 0
  let bestRun = 0
  let perfectDays = 0
  const days = range(first, today)
  for (const d of days) {
    const doneCount = build.filter((p) => isDone(p.habit, p.checkins.find((c) => c.date === d))).length
    if (doneCount > mostInADay.value) mostInADay = { value: doneCount, date: d }
    const t = dayTally(habits, d)
    const perfect = t.due > 0 && t.done === t.due
    if (perfect) {
      run++
      perfectDays++
      bestRun = Math.max(bestRun, run)
    } else if (d !== today && t.due > 0) {
      run = 0
    }
  }

  let bestWeek = { rate: 0, week: undefined as string | undefined }
  for (let w = weekStart(first); addDays(w, 6) < today; w = addDays(w, 7)) {
    let due = 0
    let done = 0
    for (const d of range(w, addDays(w, 6))) {
      const t = dayTally(habits, d)
      due += t.due
      done += t.done
    }
    if (due >= 3 && done / due > bestWeek.rate) bestWeek = { rate: done / due, week: w }
  }

  return {
    bestStreak: { value: best?.stats.best ?? 0, habit: best?.habit.name, unit: best?.stats.unit ?? 'day' },
    mostInADay,
    perfectRun: { best: bestRun, current: run },
    perfectDays,
    bestWeek,
  }
}
