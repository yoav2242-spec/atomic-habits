export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = Sunday … 6 = Saturday
  | { kind: 'weekly'; times: number } // any days, N times per Mon–Sun week

interface Synced {
  id: string
  updated_at: string
  deleted: boolean
}

export type VibrationStyle = 'gentle' | 'double' | 'heartbeat' | 'long' | 'silent'

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
  /** Daily goal: times per day, or an amount in `unit` (e.g. 2400 ml). */
  target_count: number
  /** '' = count times; otherwise the amount's unit, like "ml", "minutes" or "pages". */
  unit: string
  /** How much one tap of + adds (e.g. 800 for an 800 ml bottle). */
  step: number
  /** What one step is called: "bottle", "glass"… ('' = just the amount). */
  step_label: string
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
  // Reminders: a notification at cue_time, with this habit's own vibration.
  remind: boolean
  vibrate: VibrationStyle
  // Goldilocks rule: step the habit up (or down) as it gets easy
  level: number
  level_history: LevelChange[]
  levelup_snooze: string | null // don't suggest a level-up before this date
  archived: boolean
  sort_order: number
  created_at: string
}

export interface LevelChange {
  date: string
  level: number
  name: string
  target_count: number
}

export interface Checkin extends Synced {
  habit_id: string
  date: string // local "YYYY-MM-DD"
  count: number
  /** The daily goal on that day, so making a habit harder later doesn't undo past days. */
  target?: number
  kind: 'full' | 'two_min' | 'slip'
  note: string
}

/** Something earned outside of check-ins: a quest, a surprise box, a weekly review… */
export interface Reward extends Synced {
  date: string
  kind: 'quest' | 'box' | 'review'
  points: number
  /** What was won: "sticker:🦊", "theme:sky", "fact:…", or the quest id. */
  item: string
}

export interface ScorecardItem extends Synced {
  routine: string
  rating: '+' | '-' | '='
  sort_order: number
  habit_id: string | null // set once the routine is tracked as a habit
}
