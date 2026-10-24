import { todayKey } from './dates'
import type { Habit } from './types'

// Opening the phone's Clock app with a new alarm already filled in (Android).

export const isAndroid = () => /Android/i.test(navigator.userAgent)

/**
 * An Android "set alarm" link: the Clock app opens with the habit's time and name,
 * and the person picks the sound and days there before saving.
 */
export function clockAlarmUrl(h: Habit): string | null {
  if (!h.cue_time) return null
  const [hour, minute] = h.cue_time.split(':').map(Number)
  const label = encodeURIComponent(`${h.emoji} ${h.name}`)
  return `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=${hour};i.android.intent.extra.alarm.MINUTES=${minute};S.android.intent.extra.alarm.MESSAGE=${label};end`
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * A Google Calendar "new event" link: a repeating 15-minute event at the habit's time,
 * on the habit's days. Calendar then sends its usual notification for it.
 */
export function googleCalendarUrl(h: Habit): string | null {
  if (!h.cue_time) return null
  const [hour, minute] = h.cue_time.split(':').map(Number)
  const day = todayKey().replace(/-/g, '')
  const pad = (n: number) => String(n).padStart(2, '0')
  const endMinutes = hour * 60 + minute + 15
  const start = `${day}T${pad(hour)}${pad(minute)}00`
  const end = endMinutes < 24 * 60 ? `${day}T${pad(Math.floor(endMinutes / 60))}${pad(endMinutes % 60)}00` : `${day}T235900`
  const rule = h.schedule.kind === 'weekdays' && h.schedule.days.length
    ? `RRULE:FREQ=WEEKLY;BYDAY=${h.schedule.days.map((d) => BYDAY[d]).join(',')}`
    : 'RRULE:FREQ=DAILY'
  const details = [
    h.location && `Where: ${h.location}`,
    h.two_min_version && `Busy? Just ${h.two_min_version}.`,
    'From your Atomic habit tracker.',
  ].filter(Boolean).join('\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${h.emoji} ${h.name}`,
    dates: `${start}/${end}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recur: rule,
    details,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
