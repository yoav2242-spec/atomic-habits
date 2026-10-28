import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatDay, WEEKDAY_LONG, weekday } from '../lib/dates'
import { dateOf, dayRates, type RecapData } from '../lib/recap'

// The month (or year) told as a stack of clay slides. Everything moves as it scrolls into view.

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]
const pop = { type: 'spring', stiffness: 380, damping: 18 } as const

/** A number that counts up when it comes into view. */
export function CountUp({ to, prefix = '', className = '' }: { to: number; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const still = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!seen) return
    if (still) return setN(to)
    const a = animate(0, to, { duration: Math.min(1.8, 0.6 + to / 400), ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) })
    return () => a.stop()
  }, [seen, to, still])
  return <span ref={ref} className={`tabular-nums ${className}`}>{prefix}{n.toLocaleString()}</span>
}

/** One slide: a flat pastel field that rises and settles as it scrolls in. */
function Slide({ color, children, className = '' }: { color: string; children: ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 48, scale: 0.94, rotate: -1.2 }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      className={`puffy relative mb-4 overflow-hidden rounded-[32px] p-6 text-on-pastel ${className}`}
      style={{ background: color }}
    >
      {children}
    </motion.section>
  )
}

const Kicker = ({ children }: { children: ReactNode }) => <p className="text-[17px] font-extrabold opacity-70">{children}</p>

/** Children that appear one after another once the slide is on screen. */
const stagger = (step: number) => ({
  hidden: {},
  shown: { transition: { staggerChildren: step } },
})
const popIn = {
  hidden: { scale: 0, opacity: 0 },
  shown: { scale: 1, opacity: 1, transition: pop },
}

/** How a day looks: a pebble that's pressed in, half-full, or puffed up in sage. */
function dayStyle(r: number | null) {
  if (r === null) return { className: 'bg-on-pastel/5', style: undefined }
  if (r === 0) return { className: 'bg-on-pastel/10 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12)]', style: undefined }
  return { className: 'puffy', style: { background: `color-mix(in srgb, #5e9c7d ${35 + r * 65}%, #f5f7f4)` } }
}

function MonthPebbles({ data }: { data: RecapData }) {
  const rates = dayRates(data)
  const offset = (weekday(data.start) + 6) % 7
  return (
    <motion.div variants={stagger(0.025)} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.3 }}
      className="mt-6 grid grid-cols-7 gap-2" role="img" aria-label={`Every day of ${data.title}, filled in by how much you did`}>
      {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
      {rates.map((r, i) => {
        const s = dayStyle(r)
        return (
          <motion.span key={i} variants={popIn} title={formatDay(dateOf(data, i), { month: 'short', day: 'numeric' })}
            className={`aspect-[1.3] rounded-[45%] ${s.className}`} style={s.style} />
        )
      })}
    </motion.div>
  )
}

function YearPebbles({ data }: { data: RecapData }) {
  const rates = dayRates(data)
  const year = data.start.slice(0, 4)
  return (
    <motion.div variants={stagger(0.09)} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.2 }}
      className="mt-6 grid grid-cols-3 gap-x-4 gap-y-3" role="img" aria-label={`Every day of ${data.title}, month by month`}>
      {Array.from({ length: 12 }, (_, m) => {
        const mm = String(m + 1).padStart(2, '0')
        const first = `${year}-${mm}-01`
        const offset = (weekday(first) + 6) % 7
        const cells = rates.map((r, i) => ({ r, d: dateOf(data, i) })).filter((x) => x.d.slice(5, 7) === mm)
        return (
          <motion.div key={m} variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0, transition: pop } }}>
            <div className="mb-1 text-[14px] font-extrabold opacity-70">{formatDay(first, { month: 'short' })}</div>
            <div className="grid grid-cols-7 gap-[3px]">
              {Array.from({ length: offset }, (_, i) => <span key={`b${i}`} />)}
              {cells.map(({ r, d }) => {
                const s = dayStyle(r)
                return <span key={d} className={`aspect-square rounded-full ${s.className}`} style={s.style} />
              })}
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/** Floating clay pebbles drifting behind a slide. */
function Drift({ colors }: { colors: string[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {colors.map((c, i) => (
        <motion.span key={i} className="puffy absolute rounded-[45%]"
          style={{ background: c, width: 26 + (i % 3) * 14, height: 20 + (i % 3) * 10, left: `${8 + i * 19}%`, top: `${12 + ((i * 37) % 60)}%`, opacity: 0.55 }}
          animate={{ y: [0, -14, 0], rotate: [0, i % 2 ? 12 : -12, 0] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }} />
      ))}
    </div>
  )
}

export function RecapStory({ data, name }: { data: RecapData; name?: string }) {
  const period = data.kind === 'month' ? 'month' : 'year'
  const maxWeekday = Math.max(1, ...data.weekdays)
  const topDay = data.weekdays.indexOf(Math.max(...data.weekdays))
  const maxVotes = Math.max(1, ...data.identities.map((i) => i.votes))
  const activeDays = [...data.days].filter((c) => c !== '-' && c !== '0').length
  const empty = data.checkIns === 0 && data.slips === null

  return (
    <div>
      <Slide color="var(--color-lavender)">
        <Drift colors={['var(--color-rose)', 'var(--color-butter)', 'var(--color-sky)', 'var(--color-sage)']} />
        <div className="relative">
          <Kicker>{name ? `${name}'s ${period} in habits` : `Your ${period} in habits`}</Kicker>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...pop, delay: 0.1 }}
            className="mt-1 text-[38px] font-black leading-[1.05] tracking-[-0.02em]">{data.title}</motion.h1>
          <div className="mt-6 flex flex-wrap items-baseline gap-x-2">
            <CountUp to={data.checkIns} className="text-[68px] font-black leading-none tracking-[-0.04em]" />
            <span className="text-[19px] font-extrabold opacity-70">habits done</span>
          </div>
          {data.kind === 'month' ? <MonthPebbles data={data} /> : <YearPebbles data={data} />}
        </div>
      </Slide>

      {empty ? (
        <p className="p-4 text-center text-[17px] font-semibold text-muted">Nothing tracked in this {period} yet.</p>
      ) : (
        <>
          <Slide color="var(--color-sage)">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6">
              <div><CountUp to={data.perfect} className="block text-[54px] font-black leading-none" /><div className="mt-1 text-[17px] font-extrabold opacity-75">perfect {data.perfect === 1 ? 'day' : 'days'}</div></div>
              <div><CountUp to={data.points} prefix="+" className="block text-[54px] font-black leading-none" /><div className="mt-1 text-[17px] font-extrabold opacity-75">points</div></div>
              <div className="col-span-2">
                <CountUp to={activeDays} className="text-[34px] font-black" />
                <span className="text-[17px] font-extrabold opacity-75"> of {data.days.length} days you showed up</span>
                <div className="mt-2 h-4 overflow-hidden rounded-full bg-on-pastel/10 p-[3px]">
                  <motion.div className="puffy h-full rounded-full bg-[#f7f8f5]" initial={{ width: 0 }} whileInView={{ width: `${(activeDays / Math.max(1, data.days.length)) * 100}%` }}
                    viewport={{ once: true }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
                </div>
              </div>
            </div>
          </Slide>

          {data.star && (
            <Slide color="var(--color-butter)">
              <Kicker>Star habit</Kicker>
              <div className="mt-4 flex items-center gap-5">
                <motion.span className="puffy flex h-24 w-24 shrink-0 items-center justify-center rounded-[34px] text-[52px]" style={{ background: data.star.color }}
                  initial={{ scale: 0, rotate: -30 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }} transition={{ ...pop, delay: 0.15 }}>
                  <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>{data.star.emoji}</motion.span>
                </motion.span>
                <div className="min-w-0">
                  <div className="text-[26px] font-black leading-tight">{data.star.name}</div>
                  <div className="mt-1 text-[17px] font-extrabold opacity-75"><CountUp to={Math.round(data.star.rate * 100)} />% of the time</div>
                </div>
              </div>
            </Slide>
          )}

          {data.run && (
            <Slide color="var(--color-peach)">
              <Kicker>Longest run</Kicker>
              <div className="mt-1 text-[44px] font-black leading-none"><CountUp to={data.run.days} /> days</div>
              <div className="mt-1 text-[17px] font-extrabold opacity-75">of {data.run.emoji} {data.run.name} in a row</div>
              <motion.div variants={stagger(Math.max(0.015, 0.6 / data.run.days))} initial="hidden" whileInView="shown" viewport={{ once: true }} className="mt-5 flex flex-wrap gap-1.5">
                {Array.from({ length: Math.min(data.run.days, 60) }, (_, i) => (
                  <motion.span key={i} variants={popIn} className="puffy h-5 w-6 rounded-[45%]" style={{ background: data.run!.color }} />
                ))}
                {data.run.days > 60 && <span className="self-center text-[15px] font-black opacity-70">+{data.run.days - 60}</span>}
              </motion.div>
            </Slide>
          )}

          {data.weekdays.some((n) => n > 0) && (
            <Slide color="var(--color-sky)">
              <Kicker>Your power day</Kicker>
              <div className="mt-1 text-[34px] font-black leading-tight">{WEEKDAY_LONG[MON_FIRST[topDay]]}s</div>
              <div className="mt-5 flex h-36 items-end gap-2">
                {data.weekdays.map((n, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <motion.div className={`w-full rounded-[14px] ${i === topDay ? 'puffy bg-[#f7f8f5]' : 'bg-on-pastel/15'}`}
                      initial={{ height: 0 }} whileInView={{ height: `${Math.max(6, (n / maxWeekday) * 100)}%` }} viewport={{ once: true }}
                      transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.1 + i * 0.07 }} />
                    <span className="text-[14px] font-extrabold opacity-75">{WEEKDAY_LONG[MON_FIRST[i]].slice(0, 2)}</span>
                  </div>
                ))}
              </div>
            </Slide>
          )}

          {data.identities.length > 0 && (
            <Slide color="var(--color-rose)">
              <Kicker>Who you became</Kicker>
              <div className="mt-4 space-y-4">
                {data.identities.map((v, i) => (
                  <div key={v.name}>
                    <div className="flex justify-between text-[19px] font-black"><span>I am {v.name}</span><span><CountUp to={v.votes} /> votes</span></div>
                    <div className="mt-1.5 h-4 overflow-hidden rounded-full bg-on-pastel/10 p-[3px]">
                      <motion.div className="puffy h-full rounded-full bg-[#f7f8f5]" initial={{ width: 0 }} whileInView={{ width: `${(v.votes / maxVotes) * 100}%` }}
                        viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.15 }} />
                    </div>
                  </div>
                ))}
              </div>
            </Slide>
          )}

          {data.habits.length > 0 && (
            <Slide color="var(--color-card)" className="!text-ink">
              <Kicker>Every habit</Kicker>
              <motion.ul variants={stagger(0.08)} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.2 }} className="mt-4 space-y-3.5">
                {data.habits.map((h) => (
                  <motion.li key={h.name} variants={{ hidden: { opacity: 0, x: -20 }, shown: { opacity: 1, x: 0, transition: pop } }}>
                    <div className="flex items-center justify-between gap-3 text-[17px] font-extrabold">
                      <span className="min-w-0 truncate">{h.emoji} {h.name}</span>
                      <span className="shrink-0 tabular-nums">{Math.round(h.rate * 100)}%</span>
                    </div>
                    <div className="clay-in mt-1.5 h-3.5 overflow-hidden rounded-full p-[3px]">
                      <motion.div className="puffy h-full rounded-full" style={{ background: h.color }} initial={{ width: 0 }} whileInView={{ width: `${Math.max(4, h.rate * 100)}%` }}
                        viewport={{ once: true }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
              {data.slips !== null && (
                <p className="mt-5 text-[17px] font-bold text-muted">
                  {data.slips === 0 ? 'No slips' : `${data.slips} slip${data.slips === 1 ? '' : 's'}`}
                </p>
              )}
            </Slide>
          )}

          <Slide color="var(--color-sage)" className="text-center">
            <Drift colors={['var(--color-butter)', 'var(--color-lavender)', 'var(--color-rose)', 'var(--color-sky)', '#f7f8f5']} />
            <div className="relative py-6">
              <p className="text-[28px] font-black leading-tight">1% better every day</p>
            </div>
          </Slide>
        </>
      )}
    </div>
  )
}
