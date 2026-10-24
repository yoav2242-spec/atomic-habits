import { useMemo } from 'react'
import { useCheckinsByHabit, useHabits, useIdentities, useToday } from './hooks'
import {
  badgesFor, completionRate, habitPoints, habitStats, levelFor, pointsOn, suggestLevelUp, type HabitStats,
} from './streaks'
import type { Checkin, Habit, Identity } from './types'

// Everything the screens show about progress, worked out once from the saved data.

export interface HabitProgress {
  habit: Habit
  checkins: Checkin[]
  stats: HabitStats
  points: number
  rate30: number | null
  badges: number[]
  levelUp: boolean
}

export interface Progress {
  today: string
  habits: HabitProgress[]
  byId: Map<string, HabitProgress>
  identities: Identity[]
  checkinsByHabit: Map<string, Checkin[]>
  totalPoints: number
  level: ReturnType<typeof levelFor>
  todayPoints: number
  badgeCount: number
}

export function computeProgress(habits: Habit[], checkinsByHabit: Map<string, Checkin[]>, identities: Identity[], today: string): Progress {
  const list = habits.map((habit): HabitProgress => {
    const checkins = checkinsByHabit.get(habit.id) ?? []
    const stats = habitStats(habit, checkins, today)
    const rate30 = completionRate(habit, checkins, today, 30)
    return {
      habit, checkins, stats, rate30,
      points: habitPoints(habit, checkins, stats, today),
      badges: badgesFor(stats.best),
      levelUp: suggestLevelUp(habit, stats, rate30, today),
    }
  })
  const totalPoints = list.reduce((n, p) => n + p.points, 0)
  return {
    today,
    habits: list,
    byId: new Map(list.map((p) => [p.habit.id, p])),
    identities,
    checkinsByHabit,
    totalPoints,
    level: levelFor(totalPoints),
    todayPoints: list.reduce((n, p) => n + pointsOn(p.habit, p.checkins.find((c) => c.date === today)), 0),
    badgeCount: list.reduce((n, p) => n + p.badges.length, 0),
  }
}

export function useProgress(): Progress | undefined {
  const today = useToday()
  const habits = useHabits()
  const checkins = useCheckinsByHabit()
  const identities = useIdentities()
  return useMemo(
    () => (habits && checkins && identities ? computeProgress(habits, checkins, identities, today) : undefined),
    [habits, checkins, identities, today],
  )
}
