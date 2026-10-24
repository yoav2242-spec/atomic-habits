/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

// Keeps a copy of the whole app on the phone so it opens with no internet,
// and shows habit reminders when the reminder helper wakes the phone.

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
// Standalone pages (like the style preview) open as themselves, not as the app.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\/[\w-]+\.html$/] }))

// --- Reminders ---

// Same patterns as VIBRATIONS in lib/reminders.ts.
const PATTERNS: Record<string, number[]> = {
  gentle: [120],
  double: [90, 80, 90],
  heartbeat: [70, 90, 140, 400, 70, 90, 140],
  long: [600],
  silent: [],
}

interface StoredHabit {
  id: string
  name: string
  emoji: string
  type: string
  deleted: boolean
  archived: boolean
  remind?: boolean
  vibrate?: string
  cue_time: string | null
  location: string
  two_min_version: string
  target_count: number
  schedule: { kind: string; days?: number[] }
}

interface StoredCheckin {
  id: string
  habit_id: string
  date: string
  count: number
  target?: number
  kind: string
  note: string
  deleted: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('atomic')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

const isDone = (h: StoredHabit, c?: StoredCheckin) =>
  !!c && !c.deleted && c.kind !== 'slip' && (c.kind === 'two_min' || c.count >= Math.max(1, c.target ?? h.target_count))

async function showDueReminders() {
  const db = await openDb()
  const [habits, checkins] = await Promise.all([getAll<StoredHabit>(db, 'habits'), getAll<StoredCheckin>(db, 'checkins')])
  db.close()
  const now = new Date()
  const today = dayKey(now)
  const minutes = now.getHours() * 60 + now.getMinutes()
  const due = habits.filter((h) => {
    if (h.deleted || h.archived || !h.remind || h.type !== 'build' || !h.cue_time) return false
    const [hh, mm] = h.cue_time.split(':').map(Number)
    if (Math.abs(hh * 60 + mm - minutes) > 6) return false
    if (h.schedule.kind === 'weekdays' && !h.schedule.days?.includes(now.getDay())) return false
    return !isDone(h, checkins.find((c) => c.habit_id === h.id && c.date === today))
  })
  for (const h of due) {
    const style = h.vibrate ?? 'gentle'
    await self.registration.showNotification(`${h.emoji} ${h.name}`, {
      body: h.two_min_version ? `Time for it${h.location ? ` in ${h.location}` : ''}. Busy? Just ${h.two_min_version}.` : `Time for it${h.location ? ` in ${h.location}` : ''}.`,
      tag: `habit-${h.id}`,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      silent: style === 'silent',
      data: { habitId: h.id, date: today },
      // vibrate and actions work on Android Chrome; TypeScript's DOM types don't list them yet.
      ...({ vibrate: PATTERNS[style] ?? PATTERNS.gentle, actions: [{ action: 'done', title: '✓ Done' }] } as object),
    })
  }
}

/** "✓ Done" on a notification: check the habit off without opening the app. */
async function markDone(habitId: string, date: string) {
  const db = await openDb()
  const habits = await getAll<StoredHabit>(db, 'habits')
  const h = habits.find((x) => x.id === habitId)
  if (!h) return db.close()
  const target = Math.max(1, h.target_count)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('checkins', 'readwrite')
    const store = tx.objectStore('checkins')
    const id = `${habitId}_${date}`
    const get = store.get(id)
    get.onsuccess = () => {
      const old = get.result as StoredCheckin | undefined
      store.put({ id, habit_id: habitId, date, count: target, target, kind: 'full', note: old?.note ?? '', updated_at: new Date().toISOString(), deleted: false })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

self.addEventListener('push', (event) => {
  event.waitUntil(showDueReminders())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { habitId, date } = event.notification.data ?? {}
  if (event.action === 'done' && habitId) {
    event.waitUntil(markDone(habitId, date))
    return
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows[0]) return windows[0].focus()
      return self.clients.openWindow('./')
    })(),
  )
})
