import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { todayKey } from './dates'
import type { Checkin, Habit, Identity, ScorecardItem } from './types'

// Live views of the phone's data: screens re-render whenever a row changes.

export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.habits.toArray()
    return all.filter((h) => !h.deleted).sort((a, b) => a.sort_order - b.sort_order)
  })
}

/** All live check-ins, grouped by habit id. */
export function useCheckinsByHabit(): Map<string, Checkin[]> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, Checkin[]>()
    for (const c of await db.checkins.toArray()) {
      if (c.deleted) continue
      const list = map.get(c.habit_id)
      if (list) list.push(c)
      else map.set(c.habit_id, [c])
    }
    return map
  })
}

export function useIdentities(): Identity[] | undefined {
  return useLiveQuery(async () => (await db.identities.toArray()).filter((i) => !i.deleted).sort((a, b) => a.name.localeCompare(b.name)))
}

export function useScorecard(): ScorecardItem[] | undefined {
  return useLiveQuery(async () => (await db.scorecard_items.toArray()).filter((s) => !s.deleted).sort((a, b) => a.sort_order - b.sort_order))
}

/** Today's date, updating after midnight while the app stays open. */
export function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const id = setInterval(() => setToday(todayKey()), 30_000)
    return () => clearInterval(id)
  }, [])
  return today
}
