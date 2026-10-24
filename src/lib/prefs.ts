import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from './db'

// Personal settings, saved on the phone with the rest of the data.

export interface Prefs {
  name: string
  theme: 'auto' | 'light' | 'dark'
  motion: 'full' | 'calm'
  confetti: boolean
  haptics: boolean
}

export const DEFAULT_PREFS: Prefs = { name: '', theme: 'auto', motion: 'full', confetti: true, haptics: true }

/** The latest settings, for code that runs outside React (confetti, vibration). */
let current: Prefs = DEFAULT_PREFS

export function usePrefs(): Prefs {
  const stored = useLiveQuery(async () => (await db.meta.get('prefs'))?.value)
  const prefs = { ...DEFAULT_PREFS, ...(stored ? JSON.parse(stored) : {}) } as Prefs
  current = prefs
  return prefs
}

export async function setPrefs(patch: Partial<Prefs>) {
  // One transaction, so two quick changes can't overwrite each other.
  await db.transaction('rw', db.meta, async () => {
    const stored = (await db.meta.get('prefs'))?.value
    await db.meta.put({ key: 'prefs', value: JSON.stringify({ ...DEFAULT_PREFS, ...(stored ? JSON.parse(stored) : {}), ...patch }) })
  })
}

/** Puts the theme and motion settings onto the page. */
export function useApplyPrefs(prefs: Prefs) {
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
    root.dataset.motion = prefs.motion
  }, [prefs.theme, prefs.motion])
}

/** A short vibration, if the person allows it. */
export function buzz(pattern: number | number[]) {
  if (current.haptics) navigator.vibrate?.(pattern)
}

export const confettiAllowed = () => current.confetti && current.motion === 'full'
