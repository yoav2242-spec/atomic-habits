// The private test workspace. It runs the app on a separate test copy of the data
// (its own database), so pretend dates and fake history never touch real habits.
// Everything is remembered in this browser only.

const KEYS = { unlocked: 'atomic:workspace', sandbox: 'atomic:sandbox', offset: 'atomic:day-offset' }

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the workspace just stays off.
  }
}

export const workspaceUnlocked = () => read(KEYS.unlocked) === '1'
export const unlockWorkspace = () => write(KEYS.unlocked, '1')
export const lockWorkspace = () => {
  write(KEYS.unlocked, null)
  write(KEYS.sandbox, null)
  write(KEYS.offset, null)
}

/** True while the app shows the test copy instead of the real data. Fixed for the page's lifetime. */
export const inSandbox = read(KEYS.sandbox) === '1'

export function setSandbox(on: boolean) {
  write(KEYS.sandbox, on ? '1' : null)
  if (!on) write(KEYS.offset, null)
  location.reload()
}

/** Days added to the real date. Only ever applies inside the test copy. */
export const dayOffset = inSandbox ? Number(read(KEYS.offset) ?? 0) || 0 : 0

export function setDayOffset(days: number) {
  write(KEYS.offset, days ? String(days) : null)
  location.reload()
}

/** "Now", moved by the pretend date when testing. Use instead of new Date() for anything date-based. */
export function clockNow(): Date {
  const d = new Date()
  if (dayOffset) d.setDate(d.getDate() + dayOffset)
  return d
}
