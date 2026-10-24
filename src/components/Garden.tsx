import { Link } from 'react-router-dom'
import type { HabitProgress } from '../lib/progress'
import { practiceDays } from '../lib/stages'
import { isDone } from '../lib/streaks'

const TREES = ['🌳', '🌲', '🌴', '🌻', '🌷', '🌸']

/** How a habit's plant looks after a number of practice days. */
export function plantFor(days: number, id: string) {
  const tree = TREES[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TREES.length]
  if (days === 0) return { emoji: '🌰', label: 'Seed', size: 26 }
  if (days < 7) return { emoji: '🌱', label: 'Sprout', size: 30 }
  if (days < 21) return { emoji: '🌿', label: 'Young plant', size: 34 }
  if (days < 66) return { emoji: '🪴', label: 'Growing', size: 38 }
  return { emoji: tree, label: days >= 100 ? 'In full bloom' : 'Fully grown', size: 44 }
}

/** Every habit as a plant: it grows with practice and droops (never dies) after a miss. */
export function Garden({ habits, today }: { habits: HabitProgress[]; today: string }) {
  if (habits.length === 0) return null
  return (
    <div className="clay-in overflow-hidden rounded-[24px]"
      style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-sky) 18%, var(--card)) 0%, var(--card) 55%, color-mix(in srgb, var(--color-sage) 28%, var(--card)) 100%)' }}>
      <div className="flex items-center justify-between px-4 pt-3 text-xs font-black uppercase tracking-wider text-muted">
        <span>Sunny today</span>
        <span>🌤️</span>
      </div>
      <div className="flex flex-wrap items-end justify-around gap-x-2 gap-y-3 px-3 pb-3 pt-2">
        {habits.map((p) => {
          const days = practiceDays(p, today)
          const plant = plantFor(days, p.habit.id)
          const doneToday = p.habit.type === 'break' ? p.stats.doneToday : isDone(p.habit, p.checkins.find((c) => c.date === today))
          // Droops after a miss (or a longer break) until it's done again today.
          const thirsty = p.habit.type === 'break'
            ? !doneToday
            : !doneToday && days > 0 && (p.stats.atRisk || p.stats.current === 0)
          return (
            <Link key={p.habit.id} to={`/habits/${p.habit.id}`} className="bouncy flex w-16 flex-col items-center text-center" title={`${plant.label} · ${days} days`}>
              <span className="relative leading-none">
                {doneToday && p.habit.type === 'build' && <span className="absolute -right-2 -top-1 text-xs">✨</span>}
                {thirsty && <span className="absolute -right-2 -top-1 text-xs">💧</span>}
                <span
                  className={`inline-block transition-all duration-500 ${doneToday && p.habit.type === 'build' ? 'animate-pop' : ''}`}
                  style={{ fontSize: plant.size, filter: thirsty ? 'saturate(0.35)' : undefined, transform: thirsty ? 'rotate(-14deg)' : undefined, opacity: thirsty ? 0.75 : 1 }}
                >
                  {plant.emoji}
                </span>
              </span>
              <span className="mt-1 h-1.5 w-10 rounded-full" style={{ background: `color-mix(in srgb, ${p.habit.color} 55%, #8a6a4a)` }} />
              <span className="mt-1 line-clamp-1 text-[10px] font-extrabold text-muted">{p.habit.emoji} {p.habit.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
