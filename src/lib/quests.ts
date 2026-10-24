import type { Progress } from './progress'
import { seeded } from './rewards'
import { isDone, isScheduled } from './streaks'

// Three small bonus challenges a day, picked from the date so they're the same all day.

export interface QuestContext {
  progress: Progress
  flags: Set<string> // things done today, like "visited_stats" or "read_tip"
  comeback: boolean
}

export interface Quest {
  id: string
  icon: string
  title: string
  points: number
  check: (ctx: QuestContext) => boolean
}

function today(ctx: QuestContext) {
  const date = ctx.progress.today
  const build = ctx.progress.habits.filter((p) => !p.habit.archived && p.habit.type === 'build')
  const due = build.filter((p) => isScheduled(p.habit, date) && p.habit.schedule.kind !== 'weekly')
  const doneToday = build.map((p) => p.checkins.find((c) => c.date === date)).filter((c, i) => c && isDone(build[i].habit, c))
  const hours = doneToday.map((c) => new Date(c!.updated_at).getHours())
  return { date, build, due, doneToday, hours }
}

const POOL: (Quest & { needs?: (ctx: QuestContext) => boolean })[] = [
  { id: 'early2', icon: '🌅', title: 'Finish 2 habits before noon', points: 15, needs: (c) => today(c).build.length >= 2, check: (c) => today(c).hours.filter((h) => h < 12).length >= 2 },
  { id: 'note', icon: '📝', title: 'Write a note on any habit', points: 15, check: (c) => c.progress.habits.some((p) => p.checkins.some((x) => x.date === c.progress.today && x.note)) },
  { id: 'all', icon: '💯', title: "Complete all of today's habits", points: 20, needs: (c) => today(c).due.length >= 1, check: (c) => { const t = today(c); return t.due.every((p) => isDone(p.habit, p.checkins.find((x) => x.date === t.date))) } },
  { id: 'full3', icon: '💪', title: 'Do 3 habits the full way (not the 2-minute version)', points: 15, needs: (c) => today(c).build.length >= 3, check: (c) => today(c).doneToday.filter((x) => x!.kind === 'full').length >= 3 },
  { id: 'before9', icon: '⏰', title: 'Check off a habit before 9 am', points: 15, check: (c) => today(c).hours.some((h) => h < 9) },
  { id: 'progress', icon: '📊', title: 'Look at your Progress page', points: 10, check: (c) => c.flags.has('visited_stats') },
  { id: 'tip', icon: '💡', title: "Read today's tip", points: 10, check: (c) => c.flags.has('read_tip') },
  {
    id: 'weakest', icon: '💛', title: 'Do your "needs some love" habit today', points: 20,
    needs: (c) => weakestHabit(c) !== undefined,
    check: (c) => { const w = weakestHabit(c)!; return isDone(w.habit, w.checkins.find((x) => x.date === c.progress.today)) },
  },
  { id: 'two', icon: '✌️', title: 'Check off 2 habits', points: 10, needs: (c) => today(c).build.length >= 2, check: (c) => today(c).doneToday.length >= 2 },
]

function weakestHabit(c: QuestContext) {
  const rated = c.progress.habits.filter((p) => !p.habit.archived && p.habit.type === 'build' && p.rate30 !== null)
  if (rated.length < 2) return undefined
  return [...rated].sort((a, b) => (a.rate30 ?? 0) - (b.rate30 ?? 0))[0]
}

export const COMEBACK: Quest = {
  id: 'comeback', icon: '🤗', title: 'Comeback quest: do any one habit today', points: 25,
  check: (c) => today(c).doneToday.length >= 1,
}

export function questsFor(ctx: QuestContext): Quest[] {
  const rand = seeded(`quests:${ctx.progress.today}`)
  const open = POOL.filter((q) => !q.needs || q.needs(ctx))
  const picked: Quest[] = []
  while (picked.length < 3 && open.length) picked.push(open.splice(Math.floor(rand() * open.length), 1)[0])
  return ctx.comeback ? [COMEBACK, ...picked] : picked
}

export function weakestName(ctx: QuestContext) {
  return weakestHabit(ctx)?.habit.name
}
