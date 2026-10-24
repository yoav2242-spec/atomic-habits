import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { completionRate, habitPoints, habitStats, levelFor, suggestLevelUp, votes, walkStreak } from './streaks'
import type { Checkin, Habit, Schedule } from './types'

const TODAY = '2026-10-24' // a Saturday

function habit(schedule: Schedule = { kind: 'daily' }, extra: Partial<Habit> = {}): Habit {
  return {
    id: 'h', updated_at: '', deleted: false, type: 'build', name: 'Read', emoji: '📖', color: '#f59e0b',
    identity_id: null, schedule, target_count: 1, cue_time: null, location: '', stack_after_habit_id: null,
    stack_after_text: '', cue_trigger: '', hide_plan: '', why: '', temptation_bundle: '', two_min_version: '', friction_plan: '',
    contract: '', level: 1, level_history: [], levelup_snooze: null, archived: false, sort_order: 0,
    created_at: '2026-10-01T08:00:00', ...extra,
  }
}

const ci = (date: string, kind: Checkin['kind'] = 'full', count = 1): Checkin =>
  ({ id: `h_${date}`, habit_id: 'h', date, kind, count, note: '', updated_at: '', deleted: false })

/** Check-ins on the given offsets from today (0 = today, 1 = yesterday …). */
const daysAgo = (...n: number[]) => n.map((d) => ci(addDays(TODAY, -d)))
const times = (n: number, v: boolean) => Array<boolean>(n).fill(v)

describe('walkStreak (freezes, never miss twice)', () => {
  it('counts consecutive done periods', () => {
    expect(walkStreak([true, true, true], false)).toMatchObject({ current: 3, best: 3, freezes: 0 })
  })
  it('a miss with no freeze resets the streak', () => {
    expect(walkStreak([true, true, false], false)).toMatchObject({ current: 0, best: 2, justReset: true, atRisk: false })
  })
  it('7 days in a row earns a freeze that saves one missed day', () => {
    expect(walkStreak(times(7, true), false)).toMatchObject({ freezes: 1 })
    const r = walkStreak([...times(7, true), false], false)
    expect(r).toMatchObject({ current: 7, freezes: 0, atRisk: true })
    expect(r.frozen.at(-1)).toBe(true)
    expect(walkStreak([...times(7, true), false, true], false)).toMatchObject({ current: 8, atRisk: false })
  })
  it('freezes never cover two days in a row', () => {
    const r = walkStreak([...times(14, true), false, false], false)
    expect(r).toMatchObject({ current: 0, best: 14, justReset: true })
    expect(r.freezes).toBe(1) // the second freeze was not spent
  })
  it('separate misses can each use a freeze', () => {
    expect(walkStreak([...times(14, true), false, true, false, true], false)).toMatchObject({ current: 16, freezes: 0 })
  })
  it('saves at most two freezes', () => {
    expect(walkStreak(times(30, true), false).freezes).toBe(2)
  })
  it('an unfinished current period is not a miss', () => {
    expect(walkStreak([true, true, false], true)).toMatchObject({ current: 2, atRisk: false, justReset: false })
    expect(walkStreak([...times(7, true), false, false], true)).toMatchObject({ current: 7, atRisk: true })
    expect(walkStreak([...times(7, true), false, true], true)).toMatchObject({ current: 8, atRisk: false })
  })
})

describe('habitStats', () => {
  it('daily habit: today not done yet keeps the streak', () => {
    const s = habitStats(habit(), daysAgo(1, 2, 3), TODAY)
    expect(s).toMatchObject({ current: 3, doneToday: false, atRisk: false, unit: 'day' })
  })
  it('daily habit: a freeze covers yesterday', () => {
    const s = habitStats(habit(), daysAgo(2, 3, 4, 5, 6, 7, 8), TODAY)
    expect(s).toMatchObject({ current: 7, atRisk: true })
    expect(s.frozen.has(addDays(TODAY, -1))).toBe(true)
    expect(habitStats(habit(), daysAgo(2, 3), TODAY)).toMatchObject({ current: 0, best: 2, justReset: true })
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
  it('making a count habit harder keeps past days done', () => {
    const h = habit({ kind: 'daily' }, { target_count: 9 }) // was 8
    const past = [{ ...ci(addDays(TODAY, -1), 'full', 8), target: 8 }, { ...ci(addDays(TODAY, -2), 'full', 8), target: 8 }]
    expect(habitStats(h, past, TODAY).current).toBe(2)
    expect(habitStats(h, [{ ...ci(TODAY, 'full', 8), target: 9 }], TODAY).doneToday).toBe(false)
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

describe('points, levels, level-up', () => {
  it('gives 10 per check-off, 5 per 2-minute version, 25 per badge', () => {
    const checkins = [...daysAgo(1, 2), ci(TODAY, 'two_min', 0)]
    const h = habit()
    expect(habitPoints(h, checkins, habitStats(h, checkins, TODAY), TODAY)).toBe(10 + 10 + 5 + 25) // 3-day badge
  })
  it('levels need more points each time', () => {
    expect(levelFor(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFor(100)).toEqual({ level: 2, into: 0, need: 150 })
    expect(levelFor(260)).toEqual({ level: 3, into: 10, need: 200 })
  })
  it('suggests a level-up after two steady weeks', () => {
    const h = habit({ kind: 'daily' }, { created_at: '2026-09-01T08:00:00' })
    const steady = daysAgo(...Array.from({ length: 30 }, (_, i) => i + 1))
    const s = habitStats(h, steady, TODAY)
    expect(suggestLevelUp(h, s, completionRate(h, steady, TODAY, 30), TODAY)).toBe(true)
    expect(suggestLevelUp({ ...h, levelup_snooze: '2026-11-01' }, s, 1, TODAY)).toBe(false)
    const fewDays = daysAgo(1, 2, 3)
    expect(suggestLevelUp(h, habitStats(h, fewDays, TODAY), 1, TODAY)).toBe(false)
  })
})
