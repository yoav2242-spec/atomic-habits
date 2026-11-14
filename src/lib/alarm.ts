import { todayKey } from './dates'
import type { Habit } from './types'

// A daily reminder for a habit, as a calendar file. Opening it in the phone's Calendar adds one
// event that repeats every day at the habit's time, with a notification right at that time.
// (A website can't set a repeating alarm in the Clock app: Chrome only opens apps that accept links
// from the browser, and the Clock app doesn't.)

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
  const rule = h.schedule.kind === 'weekdays' && h.schedule.days.length > 0 && h.schedule.days.length < 7
    ? `FREQ=WEEKLY;BYDAY=${h.schedule.days.map((d) => DAYS[d]).join(',')}`
    : 'FREQ=DAILY'
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

/** Downloads the reminder; tapping the downloaded file opens it in Calendar. False when the habit has no time. */
export function addDailyReminder(h: Habit): boolean {
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
