import { addDays, range, weekday, type DateKey } from './dates'
import type { Progress } from './progress'
import { dayTally } from './records'
import { isDone, isScheduled, pointsOn } from './streaks'

/**
 * A month or a year, boiled down to what the recap shows. Small on purpose:
 * it's also packed into the link people share, so a friend's phone can draw it.
 */
export interface RecapData {
  v: 1
  kind: 'month' | 'year'
  title: string
  /** First day of the period (YYYY-MM-DD). */
  start: DateKey
  /** One character per day: '0'-'9' for how much got done (9 = everything), '-' for nothing planned. */
  days: string
  checkIns: number
  perfect: number
  points: number
  star?: RecapHabit & { rate: number }
  run?: RecapHabit & { days: number }
  /** Things done on each weekday, Monday first. */
  weekdays: number[]
  identities: { name: string; votes: number }[]
  habits: (RecapHabit & { rate: number; done: number })[]
  /** Slips on habits being broken, or null if there are none. */
  slips: number | null
}

export interface RecapHabit { emoji: string; name: string; color: string }

const brief = (h: { emoji: string; name: string; color: string }): RecapHabit => ({ emoji: h.emoji, name: h.name, color: h.color })

/** Everything the recap needs for the days from `first` to `last` (stopping at today). */
export function buildRecap(progress: Progress, kind: RecapData['kind'], first: DateKey, last: DateKey, title: string): RecapData {
  const { today } = progress
  const end = last < today ? last : today
  const days = first <= end ? range(first, end) : []
  const inPeriod = (d: string) => d >= first && d <= end
  const build = progress.habits.filter((p) => p.habit.type === 'build')
  const breaking = progress.habits.filter((p) => p.habit.type === 'break')

  const tallies = days.map((d) => dayTally(progress.habits, d))
  const dayChars = tallies.map((t) => (t.due ? String(Math.round((t.done / t.due) * 9)) : '-')).join('')
  const checkIns = build.reduce((n, p) => n + p.checkins.filter((c) => inPeriod(c.date) && isDone(p.habit, c)).length, 0)
  const points = build.reduce((n, p) => n + p.checkins.filter((c) => inPeriod(c.date)).reduce((m, c) => m + pointsOn(p.habit, c), 0), 0)
    + progress.rewards.filter((r) => inPeriod(r.date)).reduce((n, r) => n + r.points, 0)
  const perfect = tallies.filter((t) => t.due > 0 && t.done === t.due).length

  // Each habit's completion and its best run of done days inside the period.
  const perHabit = build.map((p) => {
    const doneDates = new Set(p.checkins.filter((c) => inPeriod(c.date) && isDone(p.habit, c)).map((c) => c.date))
    let run = 0
    let bestRun = 0
    let due = 0
    for (const d of days) {
      if (!isScheduled(p.habit, d) || p.habit.schedule.kind === 'weekly') {
        if (doneDates.has(d)) run++
        continue
      }
      due++
      if (doneDates.has(d)) { run++; bestRun = Math.max(bestRun, run) } else run = 0
    }
    const rate = p.habit.schedule.kind === 'weekly'
      ? Math.min(1, doneDates.size / Math.max(1, (days.length / 7) * p.habit.schedule.times))
      : due ? doneDates.size / due : 0
    return { h: p.habit, rate, done: doneDates.size, bestRun }
  }).filter((x) => x.done > 0)

  const star = [...perHabit].sort((a, b) => b.rate - a.rate || b.done - a.done)[0]
  const longest = [...perHabit].sort((a, b) => b.bestRun - a.bestRun)[0]

  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((wd) => days.reduce((n, d, i) => n + (weekday(d) === wd ? tallies[i].done : 0), 0))

  const identities = progress.identities.map((i) => ({
    name: i.name,
    votes: progress.habits.filter((p) => p.habit.identity_id === i.id).reduce((n, p) => n + p.checkins.filter((c) => inPeriod(c.date) && isDone(p.habit, c)).length, 0),
  })).filter((v) => v.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, 3)

  return {
    v: 1,
    kind,
    title,
    start: first,
    days: dayChars,
    checkIns,
    perfect,
    points,
    star: star && { ...brief(star.h), rate: star.rate },
    run: longest && longest.bestRun >= 2 ? { ...brief(longest.h), days: longest.bestRun } : undefined,
    weekdays,
    identities,
    habits: [...perHabit].sort((a, b) => b.rate - a.rate || b.done - a.done).slice(0, 8).map((x) => ({ ...brief(x.h), rate: x.rate, done: x.done })),
    slips: breaking.length ? breaking.reduce((n, p) => n + p.checkins.filter((c) => inPeriod(c.date) && c.kind === 'slip').length, 0) : null,
  }
}

/** The day rates back as numbers: 0..1, or null for a day with nothing planned. */
export const dayRates = (data: RecapData) => [...data.days].map((ch) => (ch === '-' ? null : Number(ch) / 9))
export const dateOf = (data: RecapData, i: number) => addDays(data.start, i)

// --- Packing into a link ---

export function encodeRecap(data: RecapData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeRecap(text: string): RecapData | null {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as RecapData
    const ok = data && data.v === 1 && (data.kind === 'month' || data.kind === 'year') && typeof data.title === 'string'
      && typeof data.days === 'string' && Array.isArray(data.habits) && Array.isArray(data.weekdays)
    return ok ? data : null
  } catch {
    return null
  }
}

/** A link that opens this recap, animated, in the app, on anyone's phone. */
export const recapLink = (data: RecapData) => `${location.origin}${location.pathname}#/shared/${encodeRecap(data)}`
