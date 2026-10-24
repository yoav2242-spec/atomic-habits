import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db, getMeta, setMeta } from './db'
import type { Reward } from './types'

// Rewards: color themes, stickers, fun facts, and the surprise box. Everything is
// worked out from the date, so a day's box always holds the same prize.

/** A small repeatable random number generator, seeded from text. */
export function seeded(text: string) {
  let h = 1779033703 ^ text.length
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export const THEMES = [
  { id: 'sage', name: 'Sage', level: 1, accent: '#7fb69b', deep: '#5c9479' },
  { id: 'lavender', name: 'Lavender', level: 3, accent: '#a497d6', deep: '#8273bf' },
  { id: 'sky', name: 'Sky', level: 5, accent: '#7eaed4', deep: '#5b8db5' },
  { id: 'peach', name: 'Peach', level: 8, accent: '#ee9f80', deep: '#cc7c5d' },
  { id: 'rose', name: 'Rose', level: 12, accent: '#e091a8', deep: '#bf6e86' },
  { id: 'sunshine', name: 'Sunshine', level: 16, accent: '#e3bd5f', deep: '#bf9a3c' },
  { id: 'lagoon', name: 'Lagoon', level: 20, accent: '#6fb3ad', deep: '#4f908a' },
]

export const STICKERS: { emoji: string; rarity: 'common' | 'rare' | 'legendary' }[] = [
  ...['🐢', '🐝', '🐞', '🦋', '🌻', '🍀', '🍓', '🥑', '☕', '📚', '🎈', '🧩'].map((emoji) => ({ emoji, rarity: 'common' as const })),
  ...['🦊', '🦉', '🐼', '🐳', '🌈', '🍄', '🎸', '🚀'].map((emoji) => ({ emoji, rarity: 'rare' as const })),
  ...['🦄', '🐉', '👑', '💎'].map((emoji) => ({ emoji, rarity: 'legendary' as const })),
]

const FACTS = [
  'Habits can take anywhere from 18 to 254 days to feel automatic. There is no deadline, just keep showing up.',
  'Doing a habit in the same place and at the same time makes it automatic faster.',
  'Writing down when and where you will do something makes you far more likely to follow through.',
  'Missing one day barely affects how a habit forms. Missing many in a row does.',
  'Small rewards right after a habit teach your brain to want to repeat it.',
  'Willpower works best when you need it least. Good habits rely on setup, not willpower.',
  'Seeing your progress (like a streak or a chart) is a reward all by itself.',
  'Changing your surroundings is often easier than changing your mind.',
]

export type BoxPrize = { kind: 'points'; points: number } | { kind: 'sticker'; emoji: string; rarity: string; points: number } | { kind: 'theme'; themeId: string; points: number } | { kind: 'fact'; text: string; points: number }

/** What's inside a day's box. Themes only appear while some are still locked. */
export function boxPrize(date: string, lockedThemes: string[]): BoxPrize {
  const rand = seeded(`box:${date}`)
  const roll = rand()
  if (roll < 0.1 && lockedThemes.length) return { kind: 'theme', themeId: lockedThemes[Math.floor(rand() * lockedThemes.length)], points: 10 }
  if (roll < 0.42) {
    const r = rand()
    const pool = STICKERS.filter((s) => s.rarity === (r < 0.08 ? 'legendary' : r < 0.33 ? 'rare' : 'common'))
    const s = pool[Math.floor(rand() * pool.length)]
    return { kind: 'sticker', emoji: s.emoji, rarity: s.rarity, points: 10 }
  }
  if (roll < 0.57) return { kind: 'fact', text: FACTS[Math.floor(rand() * FACTS.length)], points: 10 }
  return { kind: 'points', points: 10 + Math.floor(rand() * 5) * 5 }
}

export async function openBox(date: string, lockedThemes: string[]): Promise<BoxPrize> {
  const prize = boxPrize(date, lockedThemes)
  const item = prize.kind === 'sticker' ? `sticker:${prize.emoji}` : prize.kind === 'theme' ? `theme:${prize.themeId}` : prize.kind === 'fact' ? `fact:${prize.text}` : 'points'
  await saveReward({ id: `box_${date}`, date, kind: 'box', points: prize.points, item })
  return prize
}

export async function saveReward(r: Omit<Reward, 'updated_at' | 'deleted'>) {
  if (await db.rewards.get(r.id)) return false
  await db.rewards.put({ ...r, updated_at: new Date().toISOString(), deleted: false })
  return true
}

export function useRewards(): Reward[] | undefined {
  return useLiveQuery(async () => (await db.rewards.toArray()).filter((r) => !r.deleted))
}

export function unlockedThemes(level: number, rewards: Reward[]) {
  const won = new Set(rewards.filter((r) => r.item.startsWith('theme:')).map((r) => r.item.slice(6)))
  return THEMES.filter((t) => level >= t.level || won.has(t.id)).map((t) => t.id)
}

export const setTheme = (id: string) => setMeta('theme', id)

/** Applies the chosen color theme to the whole app. */
export function useThemeColors() {
  const id = useLiveQuery(() => getMeta('theme'))
  useEffect(() => {
    const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
    const root = document.documentElement.style
    root.setProperty('--accent', t.accent)
    root.setProperty('--accent-deep', t.deep)
  }, [id])
}
