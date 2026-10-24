export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { kind: 'weekly'; times: number } // any days, N times per Mon–Sun week

interface Synced {
  id: string
  updated_at: string
  deleted: boolean
}

export interface Identity extends Synced {
  name: string // "a reader", "an athlete"
}

export interface Habit extends Synced {
  type: 'build' | 'break'
  name: string
  emoji: string
  color: string
  identity_id: string | null
  schedule: Schedule
  target_count: number
  // 1st law: make it obvious
  cue_time: string | null // "HH:MM"
  location: string
  stack_after_habit_id: string | null
  stack_after_text: string
  cue_trigger: string // break habits: what sets it off
  hide_plan: string // break habits: how to make the cue invisible
  // 2nd law: make it attractive (or unattractive)
  why: string
  temptation_bundle: string
  // 3rd law: make it easy (or difficult)
  two_min_version: string
  friction_plan: string
  // 4th law: make it satisfying (or unsatisfying)
  contract: string
  archived: boolean
  sort_order: number
  created_at: string
}

export interface Checkin extends Synced {
  habit_id: string
  date: string // local "YYYY-MM-DD"
  count: number
  kind: 'full' | 'two_min' | 'slip'
  note: string
}

export interface ScorecardItem extends Synced {
  routine: string
  rating: '+' | '-' | '='
  sort_order: number
}
