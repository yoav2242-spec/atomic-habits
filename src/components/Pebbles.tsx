import { motion } from 'motion/react'
import { spring } from './ui'

// Hand-pinched shapes, so the row reads as clay pebbles rather than a progress bar.
const SHAPES = [
  '46% 54% 50% 50% / 56% 48% 52% 44%',
  '55% 45% 52% 48% / 46% 56% 44% 54%',
  '50% 50% 44% 56% / 52% 44% 56% 48%',
  '44% 56% 56% 44% / 50% 54% 46% 50%',
  '52% 48% 46% 54% / 44% 52% 48% 56%',
]

export interface Pebble { id: string; color: string; done: boolean; label?: string }

/** Today as a row of clay pebbles, one per habit: pressed-in until done, then puffed up in the habit's colour. */
export function Pebbles({ items, onPick }: { items: Pebble[]; onPick?: (id: string) => void }) {
  if (items.length === 0) return null
  // Fewer habits make bigger pebbles; many habits wrap onto a second row.
  const size = items.length <= 4 ? 44 : items.length <= 6 ? 32 : 26
  // Up to eight share one row; each gets an equal slice, still a full fingertip tall.
  const cols = items.length <= 4 ? undefined : Math.min(items.length, 8)
  return (
    <ul className={cols ? 'grid gap-1' : 'flex flex-wrap gap-2'} style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined} aria-label="Today's habits">
      {items.map((p, i) => {
        const shape = SHAPES[i % SHAPES.length]
        const body = (
          <motion.span
            className={`block ${p.done ? 'puffy' : 'clay-in'}`}
            style={{ width: size * 1.18, height: size, borderRadius: shape, background: p.done ? p.color : `color-mix(in oklab, ${p.color} 16%, var(--soft))` }}
            initial={false}
            animate={p.done ? { scaleX: [1, 1.22, 0.92, 1.03, 1], scaleY: [1, 0.8, 1.08, 0.98, 1] } : { scaleX: 1, scaleY: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          />
        )
        return (
          <li key={p.id}>
            {onPick ? (
              <motion.button type="button" whileTap={{ scaleX: 1.12, scaleY: 0.86 }} transition={spring} onClick={() => onPick(p.id)}
                aria-label={`${p.label ?? 'Habit'}: ${p.done ? 'done' : 'not done yet'}`}
                className={`flex min-h-11 items-center justify-center rounded-full ${cols ? 'w-full' : 'min-w-11'}`}>
                {body}
              </motion.button>
            ) : body}
          </li>
        )
      })}
    </ul>
  )
}
