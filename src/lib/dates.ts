import { clockNow } from './workspace'

// Dates are local calendar days as "YYYY-MM-DD". Arithmetic runs in UTC so
// daylight-saving changes never shift a day.
export type DateKey = string

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const todayKey = () => toKey(clockNow())

function toUTC(k: DateKey): number {
  const [y, m, d] = k.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): DateKey {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const addDays = (k: DateKey, n: number) => fromUTC(toUTC(k) + n * DAY)
export const weekday = (k: DateKey) => new Date(toUTC(k)).getUTCDay()
/** Monday of the week containing k. */
export const weekStart = (k: DateKey) => addDays(k, -((weekday(k) + 6) % 7))
/** b − a in days. */
export const diffDays = (a: DateKey, b: DateKey) => Math.round((toUTC(b) - toUTC(a)) / DAY)

export function range(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = []
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k)
  return out
}

export function formatDay(k: DateKey, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return new Date(toUTC(k)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' })
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
