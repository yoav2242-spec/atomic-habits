import { addDays, diffDays, range, toKey, weekday, weekStart, type DateKey } from './dates'
import type { Checkin, Habit } from './types'

export interface HabitStats {
  current: number
  best: number
  unit: 'day' | 'week'
  /** Streak freezes saved up (earned every 7 days / 4 weeks, at most 2). */
  freezes: number
  /** The last finished day was saved by a freeze, so today can't be: do it today. */
  atRisk: boolean
  /** The last finished day was missed and nothing saved it: the streak just reset. */
  justReset: boolean
  doneToday: boolean
  /** Done days so far this week (for X-times-per-week habits). */
  weekDone: number
  /** Periods frozen, by date key (day, or Monday of the week). */
  frozen: Set<DateKey>
}

export const MAX_FREEZES = 2
export const MILESTONES = [3, 7, 14, 21, 30, 66, 100, 200, 365]

export function isScheduled(h: Habit, k: DateKey): boolean {
  return h.schedule.kind !== 'weekdays' || h.schedule.days.includes(weekday(k))
}

export function isDone(h: Habit, c: Checkin | undefined): boolean {
  if (!c || c.deleted || c.kind === 'slip') return false
  return c.kind === 'two_min' || c.count >= Math.max(1, c.target ?? h.target_count)
}

/** First day the habit counts from: its creation, or an earlier filled-in day. */
export function startDate(h: Habit, checkins: Checkin[]): DateKey {
  let start = toKey(new Date(h.created_at))
  for (const c of checkins) if (!c.deleted && c.date < start) start = c.date
  return start
}

/**
 * Streak rules. `statuses` run oldest → newest; when `lastIsCurrent` is set the
 * final period is still in progress, so a miss there doesn't count yet.
 * - Every `earnEvery` done periods in a row earns a freeze (up to MAX_FREEZES).
 * - A missed period uses a freeze automatically, keeping the streak.
 * - Freezes never cover two periods in a row: "never miss twice".
 */
export function walkStreak(statuses: boolean[], lastIsCurrent: boolean, earnEvery = 7) {
  let run = 0
  let best = 0
  let freezes = 0
  let prevFrozen = false
  const frozen: boolean[] = []
  let lastFinished: 'done' | 'frozen' | 'reset' | null = null
  statuses.forEach((done, i) => {
    const isCurrent = lastIsCurrent && i === statuses.length - 1
    if (done) {
      run++
      best = Math.max(best, run)
      if (run % earnEvery === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
      prevFrozen = false
      frozen.push(false)
      if (!isCurrent) lastFinished = 'done'
    } else if (isCurrent) {
      frozen.push(false)
    } else if (run > 0 && freezes > 0 && !prevFrozen) {
      freezes--
      prevFrozen = true
      frozen.push(true)
      lastFinished = 'frozen'
    } else {
      const hadStreak = run > 0 || prevFrozen
      run = 0
      prevFrozen = false
      frozen.push(false)
      lastFinished = hadStreak ? 'reset' : null
    }
  })
  const currentDone = lastIsCurrent && statuses[statuses.length - 1]
  return {
    current: run,
    best,
    freezes,
    frozen,
    atRisk: lastFinished === 'frozen' && !currentDone,
    justReset: lastFinished === 'reset' && !currentDone,
  }
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
    return {
      current, best: Math.max(best, current), unit: 'day', freezes: 0, atRisk: false, justReset: false,
      doneToday: map.get(today)?.kind !== 'slip', weekDone: 0, frozen: new Set(),
    }
  }

  const thisWeek = weekStart(today)
  const weekDone = range(thisWeek, today).filter(doneOn).length

  if (h.schedule.kind === 'weekly') {
    const times = Math.max(1, h.schedule.times)
    const weeks: DateKey[] = []
    for (let w = weekStart(start); w <= thisWeek; w = addDays(w, 7)) weeks.push(w)
    const statuses = weeks.map((w) => range(w, addDays(w, 6) < today ? addDays(w, 6) : today).filter(doneOn).length >= times)
    const r = walkStreak(statuses, true, 4)
    return { ...r, frozen: new Set(weeks.filter((_, i) => r.frozen[i])), unit: 'week', doneToday: doneOn(today), weekDone }
  }

  const days = range(start, today).filter((k) => isScheduled(h, k))
  const r = walkStreak(days.map(doneOn), days[days.length - 1] === today)
  return { ...r, frozen: new Set(days.filter((_, i) => r.frozen[i])), unit: 'day', doneToday: doneOn(today), weekDone }
}

/** Share of scheduled days done over the last `days` days, or null with no data yet. */
export function completionRate(h: Habit, checkins: Checkin[], today: DateKey, days: number): number | null {
  const map = byDate(checkins)
  const start = startDate(h, checkins)
  const fromWindow = addDays(today, -(days - 1))
  const from = fromWindow > start ? fromWindow : start
  if (from > today) return null
  const span = range(from, today)

  if (h.type === 'break') return span.filter((k) => map.get(k)?.kind !== 'slip').length / span.length
  if (h.schedule.kind === 'weekly') {
    const done = span.filter((k) => isDone(h, map.get(k))).length
    return Math.min(1, done / Math.max(1, (h.schedule.times * span.length) / 7))
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

// --- Points, levels and badges. All worked out from the history, so undo is always fair. ---

export const POINTS = { full: 10, two_min: 5, clean_day: 5, badge: 25 }

export const badgesFor = (best: number) => MILESTONES.filter((m) => best >= m)
export const nextMilestone = (current: number) => MILESTONES.find((m) => m > current) ?? null

export function habitPoints(h: Habit, checkins: Checkin[], stats: HabitStats, today: DateKey): number {
  const badgeBonus = badgesFor(stats.best).length * POINTS.badge
  if (h.type === 'break') return votes(h, checkins, today) * POINTS.clean_day + badgeBonus
  let pts = 0
  for (const c of byDate(checkins).values()) {
    if (isDone(h, c)) pts += c.kind === 'two_min' ? POINTS.two_min : POINTS.full
  }
  return pts + badgeBonus
}

/** Points earned by check-ins on one day. */
export function pointsOn(h: Habit, c: Checkin | undefined): number {
  if (h.type === 'break' || !isDone(h, c)) return 0
  return c!.kind === 'two_min' ? POINTS.two_min : POINTS.full
}

/** Level from points: 100 points for level 2, then each level needs 50 more than the last. */
export function levelFor(points: number) {
  let level = 1
  let need = 100
  let into = points
  while (into >= need) {
    into -= need
    level++
    need += 50
  }
  return { level, into, need }
}

/** Goldilocks rule: suggest making it harder once it's become steady and easy. */
export function suggestLevelUp(h: Habit, stats: HabitStats, rate30: number | null, today: DateKey): boolean {
  if (h.type !== 'build' || h.archived) return false
  if (h.levelup_snooze && today < h.levelup_snooze) return false
  const lastChange = h.level_history?.at(-1)?.date ?? toKey(new Date(h.created_at))
  if (diffDays(lastChange, today) < 14) return false
  return stats.current >= (stats.unit === 'week' ? 3 : 14) && (rate30 ?? 0) >= 0.85
}
