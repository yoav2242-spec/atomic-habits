import { todayKey } from './dates'
import { AtomicNative, isNativeApp } from './native'
import type { Habit } from './types'

// Two ways to remind you of a habit at its time:
//  - Calendar: a calendar file. Opening it in the phone's Calendar adds one event that repeats every day
//    at the habit's time, with a notification right at that time. This always works.
//  - Clock (Android): in the Atomic Android app, the app asks the Clock for a repeating alarm directly.
//    In Chrome, a link asks the Clock app for an alarm; some phones let Chrome open it and some don't,
//    so we check whether the Clock really opened. (A link can't pick the repeat days.)

export const isAndroid = () => /Android/i.test(navigator.userAgent)

function clockAlarmUrl(h: Habit): string | null {
  if (!h.cue_time) return null
  const [hour, minute] = h.cue_time.split(':').map(Number)
  const label = encodeURIComponent(h.name)
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${label};end`
}

/** The days an alarm should repeat on, as Android counts them (1 = Sunday ... 7 = Saturday). */
function alarmDays(h: Habit): number[] {
  if (h.schedule.kind === 'weekdays' && h.schedule.days.length > 0) return h.schedule.days.map((d) => d + 1)
  return [1, 2, 3, 4, 5, 6, 7]
}

/** Asks the Clock app for an alarm. Resolves true if the Clock opened (inside the app, or Atomic went to the background), false if the phone blocked it. */
export async function addToClock(h: Habit): Promise<boolean> {
  if (!h.cue_time) return false
  if (isNativeApp()) {
    const [hour, minutes] = h.cue_time.split(':').map(Number)
    try {
      await AtomicNative.setAlarm({ hour, minutes, message: h.name, days: alarmDays(h) })
      return true
    } catch {
      return false
    }
  }
  const url = clockAlarmUrl(h)
  if (!url || !isAndroid()) return false
  return new Promise((resolve) => {
    let left = false
    const onChange = () => { if (document.visibilityState === 'hidden') left = true }
    document.addEventListener('visibilitychange', onChange)
    location.href = url
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onChange)
      resolve(left)
    }, 1600)
  })
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Lines longer than 75 characters continue on the next line, starting with a space. */
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  out.push(rest)
  return out.join('\r\n')
}

/** "every day", or the chosen days for a habit that runs on some days. */
export function repeatLabel(h: Habit) {
  if (h.schedule.kind === 'weekdays' && h.schedule.days.length < 7) {
    return h.schedule.days.length ? [...h.schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAYS[d][0] + DAYS[d][1].toLowerCase()).join(', ') : 'every day'
  }
  return 'every day'
}

/** The calendar file text for a habit with a time, or null without one. */
export function reminderFile(h: Habit): { name: string; text: string } | null {
  if (!h.cue_time) return null
  const [hour, minute] = h.cue_time.split(':').map(Number)
  const start = `${todayKey().replace(/-/g, '')}T${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`
  const rule = rruleFor(h)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const name = escapeText(h.name)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atomic//Habits//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${h.id}@atomic-habits`,
    `DTSTAMP:${stamp}`,
    // No time zone on purpose: it rings at this clock time wherever the phone is.
    `DTSTART:${start}`,
    'DURATION:PT15M',
    `RRULE:${rule}`,
    `SUMMARY:${name}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${name}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const slug = h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'habit'
  return { name: `atomic-${slug}.ics`, text: lines.map(fold).join('\r\n') + '\r\n' }
}

const rruleFor = (h: Habit) =>
  h.schedule.kind === 'weekdays' && h.schedule.days.length > 0 && h.schedule.days.length < 7
    ? `FREQ=WEEKLY;BYDAY=${h.schedule.days.map((d) => DAYS[d]).join(',')}`
    : 'FREQ=DAILY'

/** The next time this habit's reminder falls, in milliseconds (today if it's still ahead, on one of the habit's days). */
function nextStartMillis(h: Habit): number {
  const [hour, minute] = (h.cue_time ?? '08:00').split(':').map(Number)
  const days = h.schedule.kind === 'weekdays' && h.schedule.days.length > 0 ? h.schedule.days : null
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  for (let i = 0; i < 8 && (d.getTime() <= Date.now() || (days && !days.includes(d.getDay()))); i++) d.setDate(d.getDate() + 1)
  return d.getTime()
}

/**
 * Adds the reminder to the phone's Calendar. In the Android app the Calendar's new-event screen opens, filled in.
 * In a browser a calendar file downloads; opening it adds the event. Returns what to tell the person, or null
 * when the habit has no time.
 */
export async function addDailyReminder(h: Habit): Promise<string | null> {
  if (!h.cue_time) return null
  if (isNativeApp()) {
    try {
      await AtomicNative.addCalendarEvent({ title: h.name, startMillis: nextStartMillis(h), durationMinutes: 15, rrule: rruleFor(h) })
      return 'Tap Save in Calendar'
    } catch {
      return "Couldn't open Calendar"
    }
  }
  return downloadReminderFile(h) ? 'Open the file, then tap Save' : null
}

/** Downloads the reminder as a calendar file; tapping the downloaded file opens it in Calendar. */
function downloadReminderFile(h: Habit): boolean {
  const file = reminderFile(h)
  if (!file) return false
  const url = URL.createObjectURL(new Blob([file.text], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return true
}
