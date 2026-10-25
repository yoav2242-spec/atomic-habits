import { addDays, todayKey, weekday } from './dates'
import { clockNow } from './workspace'
import { db, DATA_TABLES, setMeta, type DataTable } from './db'
import { isDone } from './streaks'
import type { Checkin, Habit, Identity, ScorecardItem } from './types'

// All changes go through save(), which stamps the edit time. Deleting marks a
// row deleted instead of erasing it, so a mistaken delete can still be found in a backup.

const now = () => clockNow().toISOString()
export const newId = () => crypto.randomUUID()

async function save<T extends { id: string }>(table: DataTable, row: T) {
  await db.table(table).put({ ...row, updated_at: now() })
}

/** Calm colors: sage, sky, lavender, peach, butter, rose, teal, sand. */
export const HABIT_COLORS = ['#7fb69b', '#7eaed4', '#a497d6', '#ee9f80', '#e3bd5f', '#e091a8', '#6fb3ad', '#c4a284']

export function newHabit(sort_order: number): Habit {
  return {
    id: newId(), updated_at: now(), deleted: false, type: 'build', name: '', emoji: '✨', color: HABIT_COLORS[0],
    identity_id: null, schedule: { kind: 'daily' }, target_count: 1, unit: '', step: 1, step_label: '', cue_time: null, location: '',
    stack_after_habit_id: null, stack_after_text: '', cue_trigger: '', hide_plan: '', why: '', temptation_bundle: '',
    two_min_version: '', friction_plan: '', contract: '', remind: false, calendar: true, vibrate: 'gentle', level: 1, level_history: [], levelup_snooze: null,
    archived: false, sort_order, created_at: now(),
  }
}

/** Change how hard the habit is (new name and/or daily count), keeping a history of steps. */
/** Days saved before goals were stored on each day: pin them to the old goal before it changes. */
async function pinPastGoals(h: Habit) {
  await db.checkins.where('habit_id').equals(h.id).modify((c) => {
    c.target ??= Math.max(1, h.target_count)
  })
}

export async function changeLevel(h: Habit, name: string, target_count: number, direction: 1 | -1) {
  const level = Math.max(1, (h.level ?? 1) + direction)
  await pinPastGoals(h)
  const step = { date: todayKey(), level, name, target_count }
  await save('habits', { ...h, name, target_count, level, level_history: [...(h.level_history ?? []), step], levelup_snooze: null })
}

/** "Not yet": don't suggest a level-up again for a week. */
export const snoozeLevelUp = (h: Habit) => save('habits', { ...h, levelup_snooze: addDays(todayKey(), 7) })

/**
 * "I've already been doing this": mark the last `days` days before today as done
 * (build habit), or start the clean-day count that many days ago (break habit).
 */
export async function addPastProgress(h: Habit, days: number) {
  if (days <= 0) return
  if (h.type === 'break') {
    const start = addDays(todayKey(), -days)
    if (start < h.created_at.slice(0, 10)) await save('habits', { ...h, created_at: `${start}T12:00:00` })
    return
  }
  for (let i = 1; i <= days; i++) {
    const date = addDays(todayKey(), -i)
    if (h.schedule.kind === 'weekdays' && !h.schedule.days.includes(weekday(date))) continue
    const live = await liveCheckin(h, date)
    if (!isDone(h, live)) await patchCheckin(h, date, { kind: 'full', count: Math.max(1, h.target_count) })
  }
}

export type DayState = 'done' | 'two_min' | 'none' | 'slip'

/** Set any day directly, from the habit's calendar. */
export async function setDay(h: Habit, date: string, state: DayState, count?: number) {
  if (state === 'none') {
    const live = await liveCheckin(h, date)
    return live?.note ? patchCheckin(h, date, { kind: 'full', count: 0 }) : patchCheckin(h, date, null)
  }
  if (state === 'slip') return patchCheckin(h, date, { kind: 'slip', count: Math.max(1, count ?? 1) })
  if (state === 'two_min') return patchCheckin(h, date, { kind: 'two_min', count: 0 })
  return patchCheckin(h, date, { kind: 'full', count: count ?? Math.max(1, h.target_count) })
}

export async function saveHabit(h: Habit) {
  // Changing the daily goal must not undo days that met the old goal.
  const before = await db.habits.get(h.id)
  if (before && before.target_count !== h.target_count) await pinPastGoals(before)
  await save('habits', h)
}
export const deleteHabit = (h: Habit) => save('habits', { ...h, deleted: true })
export const setArchived = (h: Habit, archived: boolean) => save('habits', { ...h, archived })

export async function swapOrder(a: Habit, b: Habit) {
  await save('habits', { ...a, sort_order: b.sort_order })
  await save('habits', { ...b, sort_order: a.sort_order })
}

// --- Check-ins: one row per habit per day ---

const checkinId = (h: Habit, date: string) => `${h.id}_${date}`

async function liveCheckin(h: Habit, date: string) {
  const c = await db.checkins.get(checkinId(h, date))
  return c && !c.deleted ? c : undefined
}

async function patchCheckin(h: Habit, date: string, patch: Partial<Checkin> | null) {
  const existing = await db.checkins.get(checkinId(h, date))
  if (patch === null) {
    if (existing && !existing.deleted) await save('checkins', { ...existing, deleted: true })
    return
  }
  const base: Checkin = existing ?? {
    id: checkinId(h, date), habit_id: h.id, date, count: 0, kind: 'full', note: '', updated_at: now(), deleted: false,
  }
  // Editing a day records today's goal for it; untouched past days keep theirs.
  await save('checkins', { ...base, ...patch, target: Math.max(1, h.target_count), deleted: false })
}

/** Tap the check: mark done (full or two-minute), or undo if it's already done that way. */
export async function toggleDone(h: Habit, date: string, kind: 'full' | 'two_min' = 'full') {
  const live = await liveCheckin(h, date)
  if (live && isDone(h, live) && live.kind === kind) {
    // Keep a note that was written; otherwise remove the day.
    return live.note ? patchCheckin(h, date, { count: 0, kind: 'full' }) : patchCheckin(h, date, null)
  }
  return patchCheckin(h, date, { kind, count: kind === 'full' ? Math.max(1, h.target_count) : 0 })
}

/** +1 / −1 for count habits like "8 glasses of water". */
export async function increment(h: Habit, date: string, delta: number) {
  const live = await liveCheckin(h, date)
  const count = Math.max(0, (live?.kind === 'full' ? live.count : 0) + delta)
  return patchCheckin(h, date, { kind: 'full', count })
}

export async function setNote(h: Habit, date: string, note: string) {
  const live = await liveCheckin(h, date)
  if (!live) {
    if (!note) return
    return patchCheckin(h, date, { kind: 'full', count: 0, note })
  }
  return patchCheckin(h, date, { note })
}

export async function logSlip(h: Habit, date: string, note = '') {
  const live = await liveCheckin(h, date)
  return patchCheckin(h, date, { kind: 'slip', count: (live?.count ?? 0) + 1, note: note || live?.note || '' })
}

export const undoSlip = (h: Habit, date: string) => patchCheckin(h, date, null)

/** Undo: put a day back exactly as it was before the last tap. */
export async function restoreCheckin(h: Habit, date: string, previous: Checkin | undefined) {
  if (!previous || previous.deleted) return patchCheckin(h, date, null)
  await save('checkins', previous)
}

export const getCheckin = (h: Habit, date: string) => liveCheckin(h, date)

// --- Identities and scorecard ---

export const createIdentity = (name: string): Identity => ({ id: newId(), name, updated_at: now(), deleted: false })
export const saveIdentity = (i: Identity) => save('identities', i)
export const deleteIdentity = (i: Identity) => save('identities', { ...i, deleted: true })

export const saveScorecardItem = (s: ScorecardItem) => save('scorecard_items', s)
export const deleteScorecardItem = (s: ScorecardItem) => save('scorecard_items', { ...s, deleted: true })

// --- Backup file ---

export async function exportBackup(): Promise<string> {
  const out: Record<string, unknown[]> = {}
  for (const t of DATA_TABLES) out[t] = await db.table(t).toArray()
  await setMeta('last_backup', now())
  return JSON.stringify({ app: 'atomic', version: 1, exported_at: now(), ...out }, null, 2)
}

/** Restores a backup. Rows in the file replace rows with the same id; others are kept. */
export async function importBackup(json: string): Promise<number> {
  const data = JSON.parse(json)
  if (data?.app !== 'atomic') throw new Error('This file is not an Atomic backup.')
  let n = 0
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) {
      const rows = Array.isArray(data[t]) ? data[t] : []
      await db.table(t).bulkPut(rows)
      n += rows.length
    }
  })
  return n
}
