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
  const size = items.length <= 4 ? 44 : items.length <= 7 ? 36 : 30
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Today's habits">
      {items.map((p, i) => {
        const shape = SHAPES[i % SHAPES.length]
        const body = (
          <motion.span
            className={`block ${p.done ? 'puffy' : 'clay-in'}`}
            style={{ width: size * 1.18, height: size, borderRadius: shape, background: p.done ? p.color : undefined }}
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
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full">
                {body}
              </motion.button>
            ) : body}
          </li>
        )
      })}
    </ul>
  )
}
