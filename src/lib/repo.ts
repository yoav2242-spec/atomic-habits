import { db, DATA_TABLES, setMeta, type DataTable } from './db'
import { isDone } from './streaks'
import type { Checkin, Habit, Identity, ScorecardItem } from './types'

// All changes go through save(), which stamps the edit time. Deleting marks a
// row deleted instead of erasing it, so a mistaken delete can still be found in a backup.

const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

async function save<T extends { id: string }>(table: DataTable, row: T) {
  await db.table(table).put({ ...row, updated_at: now() })
}

export const HABIT_COLORS = ['#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#3b82f6', '#06b6d4', '#10b981', '#84cc16']

export function newHabit(sort_order: number): Habit {
  return {
    id: newId(), updated_at: now(), deleted: false, type: 'build', name: '', emoji: '✨', color: HABIT_COLORS[0],
    identity_id: null, schedule: { kind: 'daily' }, target_count: 1, cue_time: null, location: '',
    stack_after_habit_id: null, stack_after_text: '', cue_trigger: '', hide_plan: '', why: '', temptation_bundle: '',
    two_min_version: '', friction_plan: '', contract: '', archived: false, sort_order, created_at: now(),
  }
}

export const saveHabit = (h: Habit) => save('habits', h)
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
  await save('checkins', { ...base, ...patch, deleted: false })
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
