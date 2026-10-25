import confetti from 'canvas-confetti'
import { buzz, confettiAllowed } from './prefs'

// Calm, grown-up confetti: few pieces, the app's own greens and blues, and gone quickly.
const COLORS = ['#8cc4a6', '#5c9479', '#8fb9de', '#c3cbc4']

/** A small puff from an element (the check button), plus a short buzz. */
export function burst(el?: Element | null) {
  buzz(12)
  if (!confettiAllowed()) return
  const r = el?.getBoundingClientRect()
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 }
  confetti({ particleCount: 12, spread: 50, startVelocity: 16, scalar: 0.6, ticks: 60, gravity: 1.2, origin, colors: COLORS, shapes: ['circle'], disableForReducedMotion: true })
}

/** For real milestones: a day complete, a new streak record, a new level. */
export function bigCelebration() {
  buzz([18, 50, 24])
  if (!confettiAllowed()) return
  confetti({ particleCount: 30, spread: 75, startVelocity: 30, scalar: 0.75, ticks: 120, origin: { x: 0.5, y: 0.3 }, colors: COLORS, shapes: ['circle'], disableForReducedMotion: true })
}
