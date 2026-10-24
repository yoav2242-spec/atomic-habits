import { addDays, todayKey, weekday } from './dates'
import { AtomicDB, db, DATA_TABLES } from './db'
import { saveHabit } from './repo'
import { habitFromTemplate, TEMPLATES } from './templates'
import type { Checkin } from './types'

// Test-workspace helpers: fake history and copying data. Only ever used on the test copy.

export type Profile = 'perfect' | 'good' | 'struggling'

const CHANCES: Record<Profile, { done: number; twoMin: number; slip: number }> = {
  perfect: { done: 1, twoMin: 0.05, slip: 0 },
  good: { done: 0.86, twoMin: 0.12, slip: 0.05 },
  struggling: { done: 0.5, twoMin: 0.25, slip: 0.25 },
}

const NOTES = ['Felt great today', 'Hard to start, glad I did it', 'Did it right after coffee', 'Tired, did the 2-minute version', 'Easy today']

/** Fills the last `days` days (before the pretend today) with made-up check-ins. */
export async function simulateHistory(days: number, profile: Profile): Promise<number> {
  const today = todayKey()
  let habits = (await db.habits.toArray()).filter((h) => !h.deleted && !h.archived)
  if (habits.length === 0) {
    for (const i of [0, 1, 2, 4, 8]) await saveHabit(await habitFromTemplate(TEMPLATES[i], Date.now() + i))
    habits = (await db.habits.toArray()).filter((h) => !h.deleted)
  }
  const chance = CHANCES[profile]
  const stamp = new Date().toISOString()
  const rows: Checkin[] = []
  const gone: string[] = []

  for (const h of habits) {
    await db.habits.put({ ...h, created_at: `${addDays(today, -days)}T08:00:00`, level_history: [], level: 1, levelup_snooze: null })
    const target = Math.max(1, h.target_count)
    for (let i = 1; i <= days; i++) {
      const date = addDays(today, -i)
      const id = `${h.id}_${date}`
      const base = { id, habit_id: h.id, date, note: '', updated_at: stamp, deleted: false, target }
      if (h.type === 'break') {
        if (Math.random() < chance.slip) rows.push({ ...base, kind: 'slip', count: 1 })
        else gone.push(id)
        continue
      }
      const due = h.schedule.kind === 'weekdays' ? h.schedule.days.includes(weekday(date))
        : h.schedule.kind === 'weekly' ? Math.random() < (h.schedule.times + 0.5) / 7 : true
      if (!due || Math.random() >= chance.done) {
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
