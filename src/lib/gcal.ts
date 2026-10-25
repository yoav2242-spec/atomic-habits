import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db, getMeta, setMeta } from './db'
import { todayKey } from './dates'
import type { Habit } from './types'
import { inSandbox } from './workspace'

// Google Calendar: Atomic signs in with Google, makes its own "Habits" calendar, and keeps
// one repeating event per habit (with a reminder right on time). The phone talks to Google
// directly. Google's permission only covers calendars Atomic creates, not your other ones.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const API = 'https://www.googleapis.com/calendar/v3'
const CALENDAR_NAME = 'Habits'

export const googleReady = !!CLIENT_ID

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void; callback: (r: TokenResponse) => void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (c: object) => TokenClient; revoke: (token: string, done?: () => void) => void } } }
  }
}

let scriptLoad: Promise<void> | null = null
function loadGoogle(): Promise<void> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptLoad = null; reject(new Error('Could not reach Google. Check your internet.')) }
    document.head.appendChild(s)
  })
  return scriptLoad
}

/** Asks Google for permission (a Google window opens). Must start from a tap. */
async function signIn(prompt: '' | 'consent'): Promise<string> {
  await loadGoogle()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: async (r: TokenResponse) => {
        if (!r.access_token) return reject(new Error(r.error === 'access_denied' ? 'Google access was not allowed.' : 'Google sign-in did not finish.'))
        await setMeta('gcal_token', JSON.stringify({ token: r.access_token, exp: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 }))
        resolve(r.access_token)
      },
      error_callback: () => reject(new Error('Google sign-in was closed.')),
    })
    client.requestAccessToken({ prompt })
  })
}

/** A still-valid sign-in, or null if Google needs to be asked again (needs a tap). */
async function savedToken(): Promise<string | null> {
  const raw = await getMeta('gcal_token')
  if (!raw) return null
  const { token, exp } = JSON.parse(raw) as { token: string; exp: number }
  return Date.now() < exp ? token : null
}

async function call<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 404 || res.status === 410) return null
  if (res.status === 401) {
    await db.meta.delete('gcal_token')
    throw new Error('signed-out')
  }
  if (!res.ok) throw new Error(`Google Calendar error ${res.status}`)
  return res.status === 204 ? ({} as T) : res.json()
}

/** The "Habits" calendar's id, creating the calendar if it doesn't exist (or was deleted). */
async function habitsCalendar(token: string): Promise<string> {
  const known = await getMeta('gcal_calendar')
  if (known && (await call(token, `/calendars/${encodeURIComponent(known)}`))) return known
  const created = await call<{ id: string }>(token, '/calendars', 'POST', {
    summary: CALENDAR_NAME,
    description: 'Your habits from Atomic. Turn this calendar on or off to show or hide them.',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  await setMeta('gcal_calendar', created!.id)
  // Old event links belonged to the previous calendar.
  await db.meta.where('key').startsWith('gcal_event:').delete()
  await db.meta.where('key').startsWith('gcal_hash:').delete()
  return created!.id
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const pad = (n: number) => String(n).padStart(2, '0')

function wantsEvent(h: Habit) {
  return !h.deleted && !h.archived && h.type === 'build' && !!h.cue_time
}

function eventFor(h: Habit) {
  const [hour, minute] = h.cue_time!.split(':').map(Number)
  const end = Math.min(hour * 60 + minute + 15, 24 * 60 - 1)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const day = todayKey()
  return {
    summary: `${h.emoji} ${h.name}`,
    description: [h.location && `Where: ${h.location}`, h.two_min_version && `Busy? Just ${h.two_min_version}.`, 'From your Atomic habit tracker.'].filter(Boolean).join('\n'),
    start: { dateTime: `${day}T${pad(hour)}:${pad(minute)}:00`, timeZone: tz },
    end: { dateTime: `${day}T${pad(Math.floor(end / 60))}:${pad(end % 60)}:00`, timeZone: tz },
    recurrence: [h.schedule.kind === 'weekdays' && h.schedule.days.length ? `RRULE:FREQ=WEEKLY;BYDAY=${h.schedule.days.map((d) => BYDAY[d]).join(',')}` : 'RRULE:FREQ=DAILY'],
    // A reminder right at the habit's time, not Calendar's usual "10 minutes before".
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    extendedProperties: { private: { atomicHabitId: h.id } },
  }
}

/** Adds, updates or removes each habit's event so the Habits calendar matches the app. */
async function syncWith(token: string) {
  const calendar = await habitsCalendar(token)
  const cal = encodeURIComponent(calendar)
  for (const h of await db.habits.toArray()) {
    const eventId = await getMeta(`gcal_event:${h.id}`)
    const hash = wantsEvent(h) ? JSON.stringify(eventFor(h)).replace(/"dateTime":"[^T]+T/g, '') : 'none'
    if (hash === (await getMeta(`gcal_hash:${h.id}`))) continue
    if (!wantsEvent(h)) {
      if (eventId) await call(token, `/calendars/${cal}/events/${eventId}`, 'DELETE')
      await db.meta.bulkDelete([`gcal_event:${h.id}`, `gcal_hash:${h.id}`])
      continue
    }
    const updated = eventId ? await call<{ id: string }>(token, `/calendars/${cal}/events/${eventId}`, 'PUT', eventFor(h)) : null
    const saved = updated ?? (await call<{ id: string }>(token, `/calendars/${cal}/events`, 'POST', eventFor(h)))
    await setMeta(`gcal_event:${h.id}`, saved!.id)
    await setMeta(`gcal_hash:${h.id}`, hash)
  }
  await setMeta('gcal_synced', new Date().toISOString())
}

export type GoogleState = 'off' | 'connected' | 'needs-tap'

/** First connection (from a tap): asks Google, makes the calendar and adds every habit. */
export async function connectGoogle() {
  const token = await signIn('consent')
  await setMeta('gcal_on', '1')
  await syncWith(token)
}

/** Sync now if signed in; if Google's sign-in expired, ask again only when called from a tap. */
export async function syncGoogle(fromTap = false): Promise<GoogleState> {
  if (inSandbox || !googleReady || !(await getMeta('gcal_on'))) return 'off'
  let token = await savedToken()
  if (!token) {
    if (!fromTap) return 'needs-tap'
    token = await signIn('')
  }
  try {
    await syncWith(token)
  } catch (e) {
    if ((e as Error).message === 'signed-out') return 'needs-tap'
    throw e
  }
  return 'connected'
}

/** Stops syncing. Optionally deletes the Habits calendar from Google too. */
export async function disconnectGoogle(deleteCalendar: boolean) {
  const token = await savedToken()
  const calendar = await getMeta('gcal_calendar')
  if (deleteCalendar && token && calendar) await call(token, `/calendars/${encodeURIComponent(calendar)}`, 'DELETE').catch(() => {})
  if (token) window.google?.accounts.oauth2.revoke(token)
  await db.meta.where('key').startsWith('gcal_').delete()
}

export function useGoogleStatus() {
  return useLiveQuery(async () => ({
    on: !!(await getMeta('gcal_on')),
    synced: await getMeta('gcal_synced'),
    signedIn: !!(await savedToken()),
  }))
}

/** Keeps the Habits calendar up to date as habits change (while Google's sign-in is fresh). */
export function useGoogleSync() {
  const stamp = useLiveQuery(async () => (await db.habits.toArray()).map((h) => `${h.id}${h.updated_at}`).join())
  useEffect(() => {
    if (stamp === undefined) return
    const t = setTimeout(() => syncGoogle().catch((e) => console.warn('calendar sync', e)), 2500)
    return () => clearTimeout(t)
  }, [stamp])
}
