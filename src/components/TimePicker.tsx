import { Clock } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { buzz } from '../lib/prefs'
import { Button, Modal, spring } from './ui'

const QUICK = [
  { label: 'Wake up', time: '07:00' },
  { label: 'Morning', time: '08:30' },
  { label: 'Lunch', time: '13:00' },
  { label: 'Afternoon', time: '17:00' },
  { label: 'Evening', time: '20:00' },
  { label: 'Bedtime', time: '22:00' },
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const ROW = 48
const pad = (n: number) => String(n).padStart(2, '0')

/** A scrolling column that snaps to one value, with the chosen one in the middle. */
function Wheel({ values, value, onChange, label }: { values: number[]; value: number; onChange: (v: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const i = Math.max(0, values.indexOf(value))
    // Scroll to the current value now, and again once the sheet has finished sizing.
    ref.current?.scrollTo({ top: i * ROW })
    const t = setTimeout(() => ref.current?.scrollTo({ top: i * ROW }), 60)
    setShown(values[i])
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round((ref.current?.scrollTop ?? 0) / ROW)))
    if (values[i] === shown) return
    setShown(values[i])
    onChange(values[i])
    buzz(4)
  }

  return (
    <div className="clay-in relative h-[240px] flex-1 overflow-hidden rounded-[22px]">
      {/* The selected row: a puffy band across the middle. */}
      <div className="clay-sm pointer-events-none absolute inset-x-2 top-1/2 h-12 -translate-y-1/2 rounded-2xl" />
      <div ref={ref} onScroll={onScroll} aria-label={label} role="listbox"
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingBlock: 240 / 2 - ROW / 2 }}>
        {values.map((v, i) => (
          <button key={v} type="button" role="option" aria-selected={v === shown}
            onClick={() => ref.current?.scrollTo({ top: i * ROW, behavior: 'smooth' })}
            className={`flex h-12 w-full snap-center items-center justify-center text-2xl tabular-nums transition-all duration-200 ${v === shown ? 'font-black text-ink' : 'font-bold text-muted opacity-50'}`}>
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Tap to pick a time: quick choices plus smooth hour and minute wheels. */
export function TimePicker({ value, onChange, placeholder = 'Pick a time' }: { value: string | null; onChange: (t: string | null) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [h, m] = (value ?? '08:00').split(':').map(Number)
  const [hour, setHour] = useState(h)
  const [minute, setMinute] = useState(Math.round(m / 5) * 5 % 60)

  const openPicker = () => {
    setHour(h)
    setMinute(Math.round(m / 5) * 5 % 60)
    setOpen(true)
  }
  const pick = (t: string) => {
    onChange(t)
    setOpen(false)
  }

  return (
    <>
      <motion.button type="button" whileTap={{ scaleX: 1.04, scaleY: 0.94 }} transition={spring} onClick={openPicker}
        className="clay-in flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl px-4 text-left">
        <Clock size={18} className="shrink-0 text-muted" />
        <span className={`text-lg tabular-nums ${value ? 'font-black' : 'font-semibold text-muted'}`}>{value ?? placeholder}</span>
      </motion.button>

      <Modal open={open} onClose={() => setOpen(false)} title="What time?">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {QUICK.map((q) => (
            <button key={q.time} type="button" onClick={() => pick(q.time)}
              className={`min-h-14 rounded-[18px] px-2 py-2 text-center ${value === q.time ? "puffy bg-sage text-on-pastel" : "clay-sm"}`}>
              <span className="block text-[13px] font-bold opacity-75">{q.label}</span>
              <span className="block text-base font-black tabular-nums">{q.time}</span>
            </button>
          ))}
        </div>
        <div className="mb-2 text-[13px] font-bold text-muted">Or scroll to any time</div>
        <div className="flex items-center gap-2">
          <Wheel label="Hour" values={HOURS} value={hour} onChange={setHour} />
          <span className="text-3xl font-black text-muted">:</span>
          <Wheel label="Minutes" values={MINUTES} value={minute} onChange={setMinute} />
        </div>
        <div className="mt-5 flex gap-2">
          {value && <Button variant="secondary" onClick={() => { onChange(null); setOpen(false) }}>No time</Button>}
          <Button className="flex-1" onClick={() => pick(`${pad(hour)}:${pad(minute)}`)}>Set {pad(hour)}:{pad(minute)}</Button>
        </div>
      </Modal>
    </>
  )
}
