import { addDays, diffDays, range, toKey, weekday, weekStart, type DateKey } from './dates'
import type { Checkin, Habit } from './types'

export interface HabitStats {
  current: number
  best: number
  unit: 'day' | 'week'
  /** Missed the last one: "never miss twice" says do it today. */
  atRisk: boolean
  doneToday: boolean
  /** Done days so far this week (for X-times-per-week habits). */
  weekDone: number
}

export function isScheduled(h: Habit, k: DateKey): boolean {
  return h.schedule.kind !== 'weekdays' || h.schedule.days.includes(weekday(k))
}

export function isDone(h: Habit, c: Checkin | undefined): boolean {
  if (!c || c.deleted || c.kind === 'slip') return false
  return c.kind === 'two_min' || c.count >= Math.max(1, h.target_count)
}

/** First day the habit counts from: its creation, or an earlier backfilled check-in. */
export function startDate(h: Habit, checkins: Checkin[]): DateKey {
  let start = toKey(new Date(h.created_at))
  for (const c of checkins) if (!c.deleted && c.date < start) start = c.date
  return start
}

/**
 * Streaks with "never miss twice": one missed period pauses the streak, two in
 * a row reset it. `statuses` run oldest → newest; when `lastIsCurrent` is set the
 * final period is still in progress, so a miss there doesn't count yet.
 */
export function walkStreak(statuses: boolean[], lastIsCurrent: boolean) {
  let run = 0
  let best = 0
  let misses = 0
  statuses.forEach((done, i) => {
    if (done) {
      run++
      misses = 0
      best = Math.max(best, run)
    } else if (!(lastIsCurrent && i === statuses.length - 1)) {
      misses++
      if (misses >= 2) run = 0
    }
  })
  const lastDone = statuses.length > 0 && statuses[statuses.length - 1]
  return { current: run, best, atRisk: misses === 1 && !lastDone }
}

export function byDate(checkins: Checkin[]): Map<DateKey, Checkin> {
  return new Map(checkins.filter((c) => !c.deleted).map((c) => [c.date, c]))
}

export function habitStats(h: Habit, checkins: Checkin[], today: DateKey): HabitStats {
  const map = byDate(checkins)
  const start = startDate(h, checkins)
  const doneOn = (k: DateKey) => isDone(h, map.get(k))

  if (h.type === 'break') {
    const slips = [...map.values()].filter((c) => c.kind === 'slip').map((c) => c.date).sort()
    let best = 0
    let prev = start
    for (const s of slips) {
      best = Math.max(best, diffDays(prev, s))
      prev = s
    }
    const current = Math.max(0, diffDays(prev, today))
    return { current, best: Math.max(best, current), unit: 'day', atRisk: false, doneToday: !map.has(today), weekDone: 0 }
  }

  const thisWeek = weekStart(today)
  const weekDone = range(thisWeek, today).filter(doneOn).length

  if (h.schedule.kind === 'weekly') {
    const times = Math.max(1, h.schedule.times)
    const weeks: boolean[] = []
    for (let w = weekStart(start); w <= thisWeek; w = addDays(w, 7)) {
      const end = addDays(w, 6) < today ? addDays(w, 6) : today
      weeks.push(range(w, end).filter(doneOn).length >= times)
    }
    return { ...walkStreak(weeks, true), unit: 'week', doneToday: doneOn(today), weekDone }
  }

  const days = range(start, today).filter((k) => isScheduled(h, k))
  const statuses = days.map(doneOn)
  const lastIsCurrent = days[days.length - 1] === today
  return { ...walkStreak(statuses, lastIsCurrent), unit: 'day', doneToday: doneOn(today), weekDone }
}

/** Share of scheduled days done over the last `days` days, or null with no data yet. */
export function completionRate(h: Habit, checkins: Checkin[], today: DateKey, days: number): number | null {
  const map = byDate(checkins)
  const start = startDate(h, checkins)
  const fromWindow = addDays(today, -(days - 1))
  const from = fromWindow > start ? fromWindow : start
  if (from > today) return null
  const span = range(from, today)

  if (h.type === 'break') {
    const clean = span.filter((k) => !map.has(k)).length
    return clean / span.length
  }
  if (h.schedule.kind === 'weekly') {
    const done = span.filter((k) => isDone(h, map.get(k))).length
    const target = (h.schedule.times * span.length) / 7
    return Math.min(1, done / Math.max(1, target))
  }
  // Today only counts once it's done; the day isn't over yet.
  const scheduled = span.filter((k) => isScheduled(h, k) && (k !== today || isDone(h, map.get(k))))
  if (scheduled.length === 0) return null
  return scheduled.filter((k) => isDone(h, map.get(k))).length / scheduled.length
}

/** Identity votes: each completed day of a build habit, each clean day of a break habit. */
export function votes(h: Habit, checkins: Checkin[], today: DateKey): number {
  const map = byDate(checkins)
  if (h.type === 'break') {
    const total = diffDays(startDate(h, checkins), today) + 1
    return Math.max(0, total - [...map.values()].filter((c) => c.kind === 'slip').length)
  }
  return [...map.values()].filter((c) => isDone(h, c)).length
}
