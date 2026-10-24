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
