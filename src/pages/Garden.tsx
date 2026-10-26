import { Droplet } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Plant, plantGrowth, plantStage } from '../components/Plant'
import { BackButton, buttonClass, softSpring } from '../components/ui'
import { useProgress } from '../lib/progress'
import { practiceDays } from '../lib/stages'
import { isDone } from '../lib/streaks'

/** Every habit as a plant on one page: it grows with each practice day, and after a year it's a big, full tree. */
export default function Garden() {
  const progress = useProgress()
  if (!progress) return null
  const today = progress.today

  const plants = progress.habits
    .filter((p) => !p.habit.archived)
    .map((p) => {
      const days = practiceDays(p, today)
      const doneToday = p.habit.type === 'break' ? p.stats.doneToday : isDone(p.habit, p.checkins.find((c) => c.date === today))
      // Droops after a miss (or a longer break) until it's done again today.
      const thirsty = p.habit.type === 'break' ? !doneToday : !doneToday && days > 0 && (p.stats.atRisk || p.stats.current === 0)
      return { p, days, thirsty }
    })
    .sort((a, b) => b.days - a.days)

  const trees = plants.filter((x) => x.days >= 66).length
  const oldest = plants[0]

  return (
    <div>
      <BackButton className="mb-2" />
      <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.02em]">Your garden</h1>
      <p className="mt-2 text-[16px] font-semibold leading-snug text-muted">
        Each habit is a plant. It grows every day you do it, and droops (but never dies) when you miss.
      </p>

      {plants.length === 0 ? (
        <div className="tray mt-6 rounded-[28px] p-6 text-center">
          <Plant days={0} color="var(--color-sage)" id="empty" className="mx-auto h-24 w-24" />
          <p className="mb-5 mt-3 font-semibold text-muted">Nothing planted yet. Your first habit is your first seed.</p>
          <Link to="/habits/new" className={buttonClass('primary', 'w-full')}>Plant a habit</Link>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[16px] font-bold">
            <span><b className="text-[22px] font-black tabular-nums">{plants.length}</b> <span className="text-muted">plant{plants.length === 1 ? '' : 's'}</span></span>
            <span><b className="text-[22px] font-black tabular-nums">{trees}</b> <span className="text-muted">grown into tree{trees === 1 ? '' : 's'}</span></span>
            {oldest.days > 0 && <span><b className="text-[22px] font-black tabular-nums">{oldest.days}</b> <span className="text-muted">days, your oldest</span></span>}
          </div>

          {/* The bed: a flat patch of sky, the biggest plants first. */}
          <div className="mt-4 overflow-hidden rounded-[30px] px-3 pb-5 pt-6" style={{ background: 'color-mix(in oklab, var(--color-sky) 16%, var(--card))' }}>
            <ul className="flex flex-wrap items-end justify-center gap-x-1 gap-y-7">
              {plants.map(({ p, days, thirsty }, i) => {
                // Two to a row while they grow; a tree a year old gets the whole row.
                const width = days >= 365 ? 300 : Math.round(92 + 66 * Math.min(1, plantGrowth(days) / 0.95))
                return (
                  <motion.li key={p.habit.id} style={{ width }} className="min-w-0"
                    initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: Math.min(i, 8) * 0.06 }}>
                    <Link to={`/habits/${p.habit.id}`} className="bouncy block text-center" aria-label={`${p.habit.name}: ${plantStage(days)}, ${days} days`}>
                      <Plant days={days} color={p.habit.color} id={p.habit.id} thirsty={thirsty} className="block h-auto w-full" />
                      <span className="mt-1 block px-1 text-[15px] font-extrabold leading-tight line-clamp-2">{p.habit.name}</span>
                      <span className="mt-0.5 flex items-center justify-center gap-1 text-[13px] font-bold text-muted tabular-nums">
                        {thirsty && <Droplet size={13} strokeWidth={2.6} className="text-sky" aria-label="needs water" />}
                        {days} day{days === 1 ? '' : 's'} · {plantStage(days).toLowerCase()}
                      </span>
                    </Link>
                  </motion.li>
                )
              })}
            </ul>
          </div>
        </>
      )}

    </div>
  )
}
