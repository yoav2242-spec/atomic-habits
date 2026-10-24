import confetti from 'canvas-confetti'

const COLORS = ['#7fb69b', '#7eaed4', '#a497d6', '#ee9f80', '#e3bd5f', '#e091a8']

/** A small burst of confetti from an element (the check button), plus a short buzz. */
export function burst(el?: Element | null) {
  const r = el?.getBoundingClientRect()
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 }
  confetti({ particleCount: 36, spread: 70, startVelocity: 26, scalar: 0.8, ticks: 110, origin, colors: COLORS, disableForReducedMotion: true })
  navigator.vibrate?.(15)
}

/** The big one: day complete, new badge, level up. */
export function bigCelebration() {
  const fire = (x: number, angle: number) =>
    confetti({ particleCount: 70, angle, spread: 65, startVelocity: 48, origin: { x, y: 0.75 }, colors: COLORS, disableForReducedMotion: true })
  fire(0, 60)
  fire(1, 120)
  setTimeout(() => confetti({ particleCount: 90, spread: 110, startVelocity: 35, origin: { x: 0.5, y: 0.35 }, colors: COLORS, disableForReducedMotion: true }), 250)
  navigator.vibrate?.([20, 60, 30])
}
