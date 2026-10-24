import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { completionRate, habitStats, votes, walkStreak } from './streaks'
import type { Checkin, Habit, Schedule } from './types'

const TODAY = '2026-10-24' // a Saturday

function habit(schedule: Schedule = { kind: 'daily' }, extra: Partial<Habit> = {}): Habit {
  return {
    id: 'h', updated_at: '', deleted: false, type: 'build', name: 'Read', emoji: '📖', color: '#f59e0b',
    identity_id: null, schedule, target_count: 1, cue_time: null, location: '', stack_after_habit_id: null,
    stack_after_text: '', cue_trigger: '', hide_plan: '', why: '', temptation_bundle: '', two_min_version: '', friction_plan: '',
    contract: '', archived: false, sort_order: 0, created_at: '2026-10-01T08:00:00', ...extra,
  }
}

const ci = (date: string, kind: Checkin['kind'] = 'full', count = 1): Checkin =>
  ({ id: `h_${date}`, habit_id: 'h', date, kind, count, note: '', updated_at: '', deleted: false })

/** Check-ins on the given offsets from today (0 = today, 1 = yesterday …). */
const daysAgo = (...n: number[]) => n.map((d) => ci(addDays(TODAY, -d)))

describe('walkStreak (never miss twice)', () => {
  it('counts consecutive done periods', () => {
    expect(walkStreak([true, true, true], false)).toMatchObject({ current: 3, best: 3, atRisk: false })
  })
  it('one miss pauses the streak and flags it at risk', () => {
    expect(walkStreak([true, true, false], false)).toMatchObject({ current: 2, atRisk: true })
    expect(walkStreak([true, true, false, true], false)).toMatchObject({ current: 3, atRisk: false })
  })
  it('two misses in a row reset it', () => {
    expect(walkStreak([true, true, false, false], false)).toMatchObject({ current: 0, best: 2, atRisk: false })
    expect(walkStreak([true, true, false, false, true], false)).toMatchObject({ current: 1, best: 2 })
  })
  it('an unfinished current period is not a miss', () => {
    expect(walkStreak([true, true, false], true)).toMatchObject({ current: 2, atRisk: false })
    expect(walkStreak([true, false, false], true)).toMatchObject({ current: 1, atRisk: true })
  })
})

describe('habitStats', () => {
  it('daily habit: today not done yet keeps the streak', () => {
    const s = habitStats(habit(), daysAgo(1, 2, 3), TODAY)
    expect(s).toMatchObject({ current: 3, doneToday: false, atRisk: false, unit: 'day' })
  })
  it('daily habit: missed yesterday is at risk, missed two days resets', () => {
    expect(habitStats(habit(), daysAgo(2, 3), TODAY)).toMatchObject({ current: 2, atRisk: true })
    expect(habitStats(habit(), daysAgo(3, 4), TODAY)).toMatchObject({ current: 0, best: 2 })
  })
  it('weekday schedule skips unscheduled days', () => {
    // Mon/Wed/Fri. Today is Saturday, so the last scheduled day is Friday.
    const h = habit({ kind: 'weekdays', days: [1, 3, 5] })
    const s = habitStats(h, daysAgo(1, 3, 5), TODAY) // Fri, Wed, Mon
    expect(s).toMatchObject({ current: 3, atRisk: false })
  })
  it('two-minute version counts as done', () => {
    expect(habitStats(habit(), [ci(TODAY, 'two_min', 0)], TODAY)).toMatchObject({ current: 1, doneToday: true })
  })
  it('count habits need the target', () => {
    const h = habit({ kind: 'daily' }, { target_count: 8 })
    expect(habitStats(h, [ci(TODAY, 'full', 5)], TODAY).doneToday).toBe(false)
    expect(habitStats(h, [ci(TODAY, 'full', 8)], TODAY).doneToday).toBe(true)
  })
  it('weekly habit counts weeks that hit the target', () => {
    const h = habit({ kind: 'weekly', times: 2 }, { created_at: '2026-10-05T08:00:00' })
    // Weeks starting Oct 5, 12, 19 (current). Two done in each of the first two.
    const checkins = ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-20'].map((d) => ci(d))
    expect(habitStats(h, checkins, TODAY)).toMatchObject({ current: 2, unit: 'week', weekDone: 1, atRisk: false })
  })
  it('break habit counts days since the last slip', () => {
    const h = habit({ kind: 'daily' }, { type: 'break' })
    const s = habitStats(h, [ci('2026-10-10', 'slip'), ci('2026-10-20', 'slip')], TODAY)
    expect(s).toMatchObject({ current: 4, best: 10, doneToday: true })
  })
})

describe('completionRate and votes', () => {
  it('ignores today until done', () => {
    const h = habit({ kind: 'daily' }, { created_at: '2026-10-21T08:00:00' })
    expect(completionRate(h, daysAgo(1, 2), TODAY, 7)).toBe(2 / 3)
  })
  it('counts identity votes', () => {
    expect(votes(habit(), daysAgo(0, 1, 2), TODAY)).toBe(3)
  })
})
