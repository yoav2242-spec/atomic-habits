import { Leaf, Sprout, TreeDeciduous } from 'lucide-react'
import { addDays, diffDays } from './dates'
import type { HabitProgress } from './progress'
import { byDate, completionRate, isDone, startDate } from './streaks'

// A habit's journey: starting → growing → automatic (about 66 days, from research
// on how long habits take to form), and whether it's being kept up.

export const STAGES = [
  { key: 'starting', icon: Sprout, label: 'Starting', from: 0, to: 21, about: 'The first three weeks. The hardest part: keep it tiny.' },
  { key: 'growing', icon: Leaf, label: 'Growing', from: 21, to: 66, about: "It's getting easier. Keep showing up." },
  { key: 'automatic', icon: TreeDeciduous, label: 'Automatic', from: 66, to: Infinity, about: 'Part of who you are. Just keep it up, or level it up.' },
] as const

export type StageKey = (typeof STAGES)[number]['key']

/** Days the habit has been done (or kept clean), which is what makes it automatic. */
export function practiceDays(p: HabitProgress, today: string) {
  const map = byDate(p.checkins)
  if (p.habit.type === 'break') {
    const total = diffDays(startDate(p.habit, p.checkins), today) + 1
    return Math.max(0, total - [...map.values()].filter((c) => c.kind === 'slip').length)
  }
  return [...map.values()].filter((c) => isDone(p.habit, c)).length
}

export function stageOf(p: HabitProgress, today: string) {
  const days = practiceDays(p, today)
  const stage = STAGES.find((s) => days < s.to) ?? STAGES[2]
  const progress = stage.to === Infinity ? 1 : (days - stage.from) / (stage.to - stage.from)
  return { stage, days, progress, toNext: stage.to === Infinity ? 0 : stage.to - days }
}

/** Last 14 days compared with the 14 before: positive means improving. */
export function trend(p: HabitProgress, today: string): number | null {
  const recent = completionRate(p.habit, p.checkins, today, 14)
  const olderToday = addDays(today, -14)
  const older = completionRate(p.habit, p.checkins.filter((c) => c.date <= olderToday), olderToday, 14)
  if (recent === null || older === null || startDate(p.habit, p.checkins) > addDays(today, -20)) return null
  return recent - older
}
