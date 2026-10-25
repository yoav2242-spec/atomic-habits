import { addDays, todayKey, weekday } from './dates'
import { AtomicDB, db, DATA_TABLES } from './db'
import { saveHabit } from './repo'
import { habitFromTemplate, TEMPLATES } from './templates'
import type { Checkin, Habit, LevelChange } from './types'

// Test-workspace helpers: fake history and copying data. Only ever used on the test copy.

export type Profile = 'perfect' | 'good' | 'struggling'

const CHANCES: Record<Profile, { done: number; twoMin: number; slip: number }> = {
  perfect: { done: 1, twoMin: 0.05, slip: 0 },
  good: { done: 0.86, twoMin: 0.12, slip: 0.05 },
  struggling: { done: 0.5, twoMin: 0.25, slip: 0.25 },
}

const NOTES = ['Felt great today', 'Hard to start, glad I did it', 'Did it right after coffee', 'Tired, did the 2-minute version', 'Easy today', 'Did it with a friend', 'Almost skipped, but showed up']

/** How many habits a test copy has after this much history: a real collection grows over time. */
const habitsFor = (days: number) => (days >= 300 ? 10 : days >= 80 ? 8 : days >= 25 ? 6 : 4)

// Templates in the order a person might pick them up (the two "break" habits come in later).
const PICK_ORDER = [0, 1, 2, 4, 3, 8, 5, 6, 7, 9]

/** Each habit gets its own personality, so the history looks lived-in rather than uniform. */
interface Plan {
  habit: Habit
  start: number // days ago it began
  pauseAt: number | null // days ago it was paused, if it was
  strength: number // multiplies the profile's chance of doing it
  trend: number // how much better (or worse) it gets from start to today
  weekendDip: number // weekends are harder for some habits
}

/** Fills the last `days` days (before the pretend today) with made-up check-ins for a varied set of habits. */
export async function simulateHistory(days: number, profile: Profile): Promise<number> {
  const today = todayKey()
  let habits = (await db.habits.toArray()).filter((h) => !h.deleted)
  // Add habits until the collection fits the length of history.
  const used = new Set(habits.map((h) => h.name))
  for (const i of PICK_ORDER) {
    if (habits.length >= habitsFor(days)) break
    const t = TEMPLATES[i]
    if (!t || used.has(t.habit.name)) continue
    await saveHabit({ ...(await habitFromTemplate(t, habits.length)), archived: false })
    habits = (await db.habits.toArray()).filter((h) => !h.deleted)
  }

  const chance = CHANCES[profile]
  const stamp = new Date().toISOString()
  const rows: Checkin[] = []
  const gone: string[] = []

  const plans: Plan[] = habits.map((habit, i) => {
    // The first three start right away; later ones are picked up along the way.
    const start = i < 3 || days < 14 ? days : Math.max(5, Math.round(days * (0.85 - (i - 3) * (0.6 / Math.max(1, habits.length - 3)))))
    // On long histories, one habit got paused partway through.
    const pauseAt = days >= 60 && i === habits.length - 2 && habit.type === 'build' ? Math.round(start * 0.35) : null
    return {
      habit,
      start,
      pauseAt,
      strength: profile === 'perfect' ? 1 : [1.08, 1, 0.92, 1.05, 0.8, 0.97, 0.88, 1.02, 0.85, 0.95][i % 10],
      trend: profile === 'struggling' ? -0.12 : 0.12,
      weekendDip: i % 3 === 1 ? 0.8 : 0.95,
    }
  })

  for (const plan of plans) {
    const { habit: h } = plan
    const target = Math.max(1, h.target_count)
    // Long-running habits that go well get made a little harder once or twice.
    const levels: LevelChange[] = []
    if (plan.start >= 45 && h.type === 'build' && plan.strength >= 0.97 && profile !== 'struggling') {
      levels.push({ date: addDays(today, -Math.round(plan.start * 0.5)), level: 2, name: h.name, target_count: h.target_count })
      if (plan.start >= 200) levels.push({ date: addDays(today, -Math.round(plan.start * 0.2)), level: 3, name: h.name, target_count: h.target_count })
    }
    await db.habits.put({
      ...h,
      created_at: `${addDays(today, -plan.start)}T08:00:00`,
      archived: plan.pauseAt !== null,
      level_history: levels,
      level: 1 + levels.length,
      levelup_snooze: null,
    })

    for (let i = 1; i <= days; i++) {
      const date = addDays(today, -i)
      const id = `${h.id}_${date}`
      // Nothing before it started, or after it was paused.
      if (i > plan.start || (plan.pauseAt !== null && i < plan.pauseAt)) {
        gone.push(id)
        continue
      }
      const base = { id, habit_id: h.id, date, note: '', updated_at: stamp, deleted: false, target }
      const progressThrough = 1 - i / Math.max(1, plan.start) // 0 at the start, 1 today
      const wd = weekday(date)
      const p = Math.min(1, chance.done * plan.strength * (1 + plan.trend * (progressThrough - 0.5)) * (wd === 0 || wd === 6 ? plan.weekendDip : 1))
      if (h.type === 'break') {
        // Slips get rarer as the habit gets broken.
        if (Math.random() < chance.slip * (1.6 - progressThrough)) rows.push({ ...base, kind: 'slip', count: 1 })
        else gone.push(id)
        continue
      }
      const due = h.schedule.kind === 'weekdays' ? h.schedule.days.includes(wd)
        : h.schedule.kind === 'weekly' ? Math.random() < (h.schedule.times + 0.5) / 7 : true
      if (!due || (profile !== 'perfect' && Math.random() >= p)) {
        gone.push(id)
        continue
      }
      const twoMin = Math.random() < chance.twoMin
      rows.push({
        ...base,
        kind: twoMin ? 'two_min' : 'full',
        count: twoMin ? 0 : target,
        note: Math.random() < 0.06 ? NOTES[Math.floor(Math.random() * NOTES.length)] : '',
      })
    }
  }
  await db.checkins.bulkDelete(gone)
  await db.checkins.bulkPut(rows)
  return rows.length
}

/** Copies the real habits and history into the test copy, so tests use your own setup. */
export async function copyRealData(): Promise<number> {
  const real = new AtomicDB('atomic')
  let n = 0
  try {
    for (const t of DATA_TABLES) {
      const rows = await real.table(t).toArray()
      await db.table(t).bulkPut(rows)
      n += rows.length
    }
  } finally {
    real.close()
  }
  return n
}

/** Empties the test copy (the real data is a different database and is not touched). */
export async function clearTestCopy() {
  await Promise.all([...DATA_TABLES.map((t) => db.table(t).clear()), db.meta.clear()])
}
