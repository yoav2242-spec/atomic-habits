import { Bean, Droplet, Flower, Flower2, Leaf, Sprout, TreeDeciduous, TreePine, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { HabitProgress } from '../lib/progress'
import { practiceDays } from '../lib/stages'
import { isDone } from '../lib/streaks'

const TREES = [TreeDeciduous, TreePine, Flower2, Flower]

/** How a habit's plant looks after a number of practice days. */
export function plantFor(days: number, id: string): { Icon: LucideIcon; label: string; size: number } {
  const tree = TREES[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TREES.length]
  if (days === 0) return { Icon: Bean, label: 'Seed', size: 22 }
  if (days < 7) return { Icon: Sprout, label: 'Sprout', size: 28 }
  if (days < 21) return { Icon: Leaf, label: 'Young plant', size: 32 }
  if (days < 66) return { Icon: Sprout, label: 'Growing', size: 38 }
  return { Icon: tree, label: days >= 100 ? 'In full bloom' : 'Fully grown', size: 44 }
}

/** Every habit as a plant: it grows with practice and droops (never dies) after a miss. */
export function Garden({ habits, today }: { habits: HabitProgress[]; today: string }) {
  if (habits.length === 0) return null
  return (
    <div className="tray overflow-hidden rounded-[24px]">
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
            <Link key={p.habit.id} to={`/habits/${p.habit.id}`} className="bouncy flex w-[76px] flex-col items-center text-center" title={`${plant.label} · ${days} days`}>
              <span className="relative flex h-12 items-end leading-none">
                {thirsty && <Droplet aria-label="needs water" className="absolute -right-3 -top-1 text-sky" size={14} strokeWidth={2.6} />}
                <span
                  className={`inline-block origin-bottom transition-all duration-500 ${doneToday && p.habit.type === 'build' ? 'animate-pop' : ''}`}
                  style={{ color: thirsty ? 'var(--muted)' : `color-mix(in oklab, ${p.habit.color} 70%, var(--ink))`, transform: thirsty ? 'rotate(-14deg)' : undefined, opacity: thirsty ? 0.7 : 1 }}
                >
                  <plant.Icon size={plant.size} strokeWidth={2} aria-hidden />
                </span>
              </span>
              <span className="mt-1.5 h-1.5 w-10 rounded-full" style={{ background: `color-mix(in srgb, ${p.habit.color} 55%, #8a6a4a)` }} />
              <span className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-tight text-muted">{p.habit.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
