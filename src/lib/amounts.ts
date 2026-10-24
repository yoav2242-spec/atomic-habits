import type { Habit } from './types'

// Habits can count times ("3 times a day") or measure an amount ("2,400 ml, one 800 ml bottle per tap").

export const isAmount = (h: Habit) => !!h.unit
export const stepOf = (h: Habit) => Math.max(1, h.step || 1)

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 })

/** "1,600 / 2,400 ml" or "3/8". */
export function progressText(h: Habit, count: number) {
  return isAmount(h) ? `${fmt(count)} / ${fmt(h.target_count)} ${h.unit}` : `${count}/${Math.max(1, h.target_count)}`
}

/** "2 of 3 bottles" for amount habits with a container, otherwise ''. */
export function servingsText(h: Habit, count: number) {
  if (!isAmount(h) || !h.step_label) return ''
  const total = Math.ceil(h.target_count / stepOf(h))
  const done = Math.floor((count / stepOf(h)) * 10) / 10
  return `${fmt(done)} of ${total} ${h.step_label}${total === 1 ? '' : 's'}`
}

/** "3 bottles of 800 ml" — how a goal breaks down into containers. */
export function goalBreakdown(h: Habit) {
  if (!isAmount(h)) return ''
  const n = h.target_count / stepOf(h)
  const label = h.step_label || 'tap'
  return `${fmt(n)} ${label}${n === 1 ? '' : 's'} of ${fmt(stepOf(h))} ${h.unit}`
}

/** Short goal for lists: "2,400 ml" or "×8". */
export function goalLabel(h: Habit) {
  if (isAmount(h)) return `${fmt(h.target_count)} ${h.unit}`
  return h.target_count > 1 ? `×${h.target_count}` : ''
}

export const UNITS = ['ml', 'L', 'minutes', 'pages', 'km', 'steps', 'reps']
export const CONTAINERS: Record<string, { label: string; size: number }[]> = {
  ml: [
    { label: 'cup', size: 250 },
    { label: 'glass', size: 300 },
    { label: 'bottle', size: 500 },
    { label: 'bottle', size: 800 },
    { label: 'bottle', size: 1000 },
  ],
}
