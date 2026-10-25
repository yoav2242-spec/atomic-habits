import { db } from './db'
import { createIdentity, newHabit, saveIdentity } from './repo'
import type { Habit } from './types'

// Ready-made habits with all four laws already filled in, for people new to the book.

export interface Template {
  identity: string
  habit: Partial<Habit> & Pick<Habit, 'name' | 'emoji' | 'color'>
}

export const TEMPLATES: Template[] = [
  { identity: 'a reader', habit: { name: 'Read 10 pages', emoji: '📖', color: '#a497d6', location: 'bed', stack_after_text: 'get into bed', two_min_version: 'read one page', why: 'I want to learn and wind down without a screen', temptation_bundle: 'a cup of herbal tea' } },
  { identity: 'a healthy person', habit: { name: 'Drink water', emoji: '💧', color: '#7eaed4', target_count: 2000, unit: 'ml', step: 500, step_label: 'bottle', calendar: false, two_min_version: 'drink one glass', why: 'More energy and fewer headaches', stack_after_text: 'wake up' } },
  { identity: 'an active person', habit: { name: 'Go for a walk', emoji: '🚶', color: '#7fb69b', two_min_version: 'walk to the end of the street', why: 'A clear head and a healthier body', temptation_bundle: 'my favorite podcast', stack_after_text: 'finish lunch' } },
  { identity: 'a calm person', habit: { name: 'Meditate 5 minutes', emoji: '🧘', color: '#6fb3ad', two_min_version: 'take 3 slow breaths', why: 'Less stress, more focus', stack_after_text: 'pour my morning coffee' } },
  { identity: 'an athlete', habit: { name: 'Work out', emoji: '💪', color: '#ee9f80', schedule: { kind: 'weekly', times: 3 }, two_min_version: 'put on my workout clothes', why: 'Feel strong and confident', temptation_bundle: 'my workout playlist' } },
  { identity: 'a writer', habit: { name: 'Write in my journal', emoji: '✍️', color: '#e3bd5f', location: 'desk', two_min_version: 'write one sentence', why: 'Understand my thoughts better', stack_after_text: 'finish dinner' } },
  { identity: 'a healthy person', habit: { name: 'Stretch', emoji: '🤸', color: '#e091a8', two_min_version: 'touch my toes once', why: 'Less back pain', stack_after_text: 'get out of bed' } },
  { identity: 'a learner', habit: { name: 'Practice a language', emoji: '🗣️', color: '#c4a284', two_min_version: 'learn one new word', why: 'Talk to more people in the world' } },
  { identity: 'a well-rested person', habit: { type: 'break', name: 'Phone in bed', emoji: '📵', color: '#a497d6', cue_trigger: 'phone on the nightstand', hide_plan: 'charge my phone in another room', why: 'I sleep badly and wake up tired', friction_plan: 'log out of social apps at night' } },
  { identity: 'a healthy person', habit: { type: 'break', name: 'Late-night snacks', emoji: '🍪', color: '#ee9f80', cue_trigger: 'snacks in the kitchen cupboard', hide_plan: "don't buy snacks; keep fruit visible instead", why: 'I feel heavy in the morning', friction_plan: 'brush my teeth right after dinner' } },
]

/** Builds a habit from a template, linking (or creating) its identity. Not saved yet. */
export async function habitFromTemplate(t: Template, sortOrder: number): Promise<Habit> {
  const identities = (await db.identities.toArray()).filter((i) => !i.deleted)
  let identity = identities.find((i) => i.name.toLowerCase() === t.identity)
  if (!identity) {
    identity = createIdentity(t.identity)
    await saveIdentity(identity)
  }
  return { ...newHabit(sortOrder), ...t.habit, identity_id: identity.id }
}
