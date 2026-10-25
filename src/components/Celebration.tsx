import { motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { bigCelebration } from '../lib/celebrate'
import { CountUp } from './RecapStory'
import { Button, Modal, useDismissToast } from './ui'

export type CelebrationInfo =
  | { kind: 'badge'; days: number; unit: 'day' | 'week'; habitName: string; emoji: string }
  | { kind: 'level'; level: number }
  | { kind: 'day'; points: number; streakHabits: number; done?: number }
  | { kind: 'record'; title: string; body: string }

const BADGE_WORDS: Record<number, string> = {
  3: 'A solid start.',
  7: 'One full week.',
  14: 'Two weeks in a row.',
  21: 'Three weeks. This is becoming part of you.',
  30: 'A full month.',
  66: 'About how long a habit takes to feel automatic.',
  100: 'Triple digits.',
  200: 'Two hundred in a row.',
  365: 'A whole year. You are this person now.',
}

/** A milestone, told with its number: the figure counts up, the words say what it means. */
export function Celebration({ info, onClose }: { info: CelebrationInfo | null; onClose: () => void }) {
  const dismissToast = useDismissToast()
  useEffect(() => {
    if (!info) return
    dismissToast(true)
    bigCelebration()
    return () => dismissToast(false)
  }, [info, dismissToast])
  if (!info) return null

  const content: { label: string; figure: ReactNode; unit?: string; body: string } =
    info.kind === 'badge' ? {
      label: info.habitName,
      figure: <CountUp to={info.days} />,
      unit: `${info.unit}s in a row`,
      body: `${BADGE_WORDS[info.days] ?? 'Keep going.'} +25 points.`,
    } : info.kind === 'record' ? {
      label: 'New personal record',
      figure: <span>{info.title.match(/\d+/)?.[0] ?? ''}</span>,
      unit: info.title.replace(/^\d+\s*/, '').replace(/!$/, ''),
      body: info.body,
    } : info.kind === 'level' ? {
      label: 'Level up',
      figure: <CountUp to={info.level} />,
      unit: 'is your new level',
      body: 'Every check-off adds up. Keep casting votes for who you want to become.',
    } : {
      label: 'Day complete',
      figure: <CountUp to={info.points} prefix="+" />,
      unit: 'points today',
      body: `Everything on today's list is done.${info.streakHabits > 0 ? ` ${info.streakHabits} streak${info.streakHabits === 1 ? '' : 's'} kept going.` : ''}`,
    }

  return (
    <Modal open onClose={onClose} title="">
      <div className="-mt-4">
        <p className="text-[17px] font-extrabold text-sage-deep">{content.label}</p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="mt-1 flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[64px] font-black leading-none tracking-[-0.04em] tabular-nums">{content.figure}</span>
          {content.unit && <span className="text-[20px] font-extrabold text-muted">{content.unit}</span>}
        </motion.div>
        <p className="mb-6 mt-3 text-[17px] font-semibold leading-snug text-muted">{content.body}</p>
        <Button className="w-full text-[18px]" onClick={onClose}>Continue</Button>
      </div>
    </Modal>
  )
}
