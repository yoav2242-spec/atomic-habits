import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from './db'
import { todayKey } from './dates'
import { isDone } from './streaks'
import type { VibrationStyle } from './types'
import { inSandbox } from './workspace'

// Habit reminders as phone notifications.
// A small free helper online (Cloudflare) only knows *when* to wake the phone: the reminder
// times and the time zone. At each time the phone's own background worker checks which
// habits are still undone and shows those, so habit names and progress never leave the phone.

const API = (import.meta.env.VITE_REMINDER_API as string | undefined)?.replace(/\/$/, '')
const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const remindersReady = !!API && !!PUBLIC_KEY
export const notificationsSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const VIBRATIONS: { value: VibrationStyle; label: string; pattern: number[] }[] = [
  { value: 'gentle', label: 'Gentle', pattern: [120] },
  { value: 'double', label: 'Double tap', pattern: [90, 80, 90] },
  { value: 'heartbeat', label: 'Heartbeat', pattern: [70, 90, 140, 400, 70, 90, 140] },
  { value: 'long', label: 'Long', pattern: [600] },
  { value: 'silent', label: 'Silent', pattern: [] },
]

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'not-ready' | 'error'

export async function enableNotifications(): Promise<EnableResult> {
  if (!notificationsSupported()) return 'unsupported'
  if (!remindersReady) return 'not-ready'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY!) }))
    await syncReminders(sub)
    return 'ok'
  } catch (e) {
    console.error('could not turn on notifications', e)
    return 'error'
  }
}

export async function disableNotifications() {
  const sub = notificationsSupported() ? await currentSubscription() : null
  if (!sub) return
  await fetch(`${API}/unsubscribe`, { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe()
}

export async function notificationsOn(): Promise<boolean> {
  if (!notificationsSupported() || !remindersReady || Notification.permission !== 'granted') return false
  return !!(await currentSubscription())
}

/**
 * Tells the helper which minutes to wake the phone at. Times whose habits are all done
 * today are skipped for the rest of today.
 */
export async function syncReminders(existing?: PushSubscription | null) {
  if (inSandbox || !remindersReady || !notificationsSupported()) return
  const sub = existing ?? (await currentSubscription())
  if (!sub) return
  const today = todayKey()
  const habits = (await db.habits.toArray()).filter((h) => !h.deleted && !h.archived && h.remind && h.type === 'build' && h.cue_time)
  const checkins = await db.checkins.where('habit_id').anyOf(habits.map((h) => h.id)).toArray()
  const doneToday = new Set(habits.filter((h) => isDone(h, checkins.find((c) => c.habit_id === h.id && c.date === today && !c.deleted))).map((h) => h.id))
  const times = [...new Set(habits.map((h) => h.cue_time!))].sort()
  const skip = times.filter((t) => habits.filter((h) => h.cue_time === t).every((h) => doneToday.has(h.id)))
  await fetch(`${API}/subscribe`, {
    method: 'POST',
    body: JSON.stringify({ endpoint: sub.endpoint, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, times, skip_date: today, skip_times: skip }),
  })
}

/** Keeps the helper's list up to date as habits and check-offs change. */
export function useReminderSync() {
  const stamp = useLiveQuery(async () => {
    const habits = await db.habits.toArray()
    const today = await db.checkins.filter((c) => c.date === todayKey()).toArray()
    return habits.map((h) => `${h.id}${h.updated_at}${h.remind}${h.cue_time}`).join() + today.map((c) => c.updated_at).join()
  })
  useEffect(() => {
    if (stamp === undefined) return
    const t = setTimeout(() => syncReminders().catch(() => {}), 2000)
    return () => clearTimeout(t)
  }, [stamp])
}
