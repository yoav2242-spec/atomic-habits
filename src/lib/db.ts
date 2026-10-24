import Dexie, { type Table } from 'dexie'
import type { Checkin, Habit, Identity, Reward, ScorecardItem } from './types'
import { inSandbox } from './workspace'

// Everything is stored on the phone in the browser's built-in database.

export class AtomicDB extends Dexie {
  identities!: Table<Identity, string>
  habits!: Table<Habit, string>
  checkins!: Table<Checkin, string>
  scorecard_items!: Table<ScorecardItem, string>
  rewards!: Table<Reward, string>
  meta!: Table<{ key: string; value: string }, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      identities: 'id',
      habits: 'id',
      checkins: 'id, habit_id',
      scorecard_items: 'id',
      meta: 'key',
    })
    // v2: habit levels, and scorecard routines linked to habits.
    this.version(2).upgrade(async (tx) => {
      await tx.table('habits').toCollection().modify((h) => {
        h.level ??= 1
        h.level_history ??= []
        h.levelup_snooze ??= null
      })
      await tx.table('scorecard_items').toCollection().modify((s) => {
        s.habit_id ??= null
      })
    })
    // v3: rewards from quests, surprise boxes and weekly reviews.
    this.version(3).stores({ rewards: 'id, date' })
    // v5: per-habit reminders and vibration.
    this.version(5).upgrade(async (tx) => {
      await tx.table('habits').toCollection().modify((h) => {
        h.remind ??= false
        h.vibrate ??= 'gentle'
      })
    })
    // v4: amount habits (2400 ml, one 800 ml bottle per tap).
    this.version(4).upgrade(async (tx) => {
      await tx.table('habits').toCollection().modify((h) => {
        h.unit ??= ''
        h.step ??= 1
        h.step_label ??= ''
      })
    })
  }
}

/** The real data, or the separate test copy while the private test workspace is on. */
export const db = new AtomicDB(inSandbox ? 'atomic-sandbox' : 'atomic')

export const DATA_TABLES = ['identities', 'habits', 'checkins', 'scorecard_items', 'rewards'] as const
export type DataTable = (typeof DATA_TABLES)[number]

export async function getMeta(key: string) {
  return (await db.meta.get(key))?.value
}

export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value })
}

/** Ask the browser never to clear this app's data to free up space. */
export async function protectStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  return (await navigator.storage.persisted()) || navigator.storage.persist()
}
