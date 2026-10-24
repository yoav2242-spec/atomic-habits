import { useEffect } from 'react'
import { bigCelebration } from '../lib/celebrate'
import { Button, Modal, useDismissToast } from './ui'

export type CelebrationInfo =
  | { kind: 'badge'; days: number; unit: 'day' | 'week'; habitName: string; emoji: string }
  | { kind: 'level'; level: number }
  | { kind: 'day'; points: number; streakHabits: number }
  | { kind: 'record'; title: string; body: string }

const BADGE_WORDS: Record<number, string> = {
  3: 'A great start.',
  7: 'One whole week!',
  14: 'Two weeks strong.',
  21: 'Three weeks. This is becoming part of you.',
  30: 'A full month!',
  66: 'About how long it takes a habit to feel automatic. Amazing.',
  100: 'Triple digits. Legendary.',
  200: 'Unstoppable.',
  365: 'A whole year. You are this person now.',
}

export function Celebration({ info, onClose }: { info: CelebrationInfo | null; onClose: () => void }) {
  const dismissToast = useDismissToast()
  useEffect(() => {
    if (!info) return
    dismissToast(true)
    bigCelebration()
    return () => dismissToast(false)
  }, [info, dismissToast])
  if (!info) return null

  const content =
    info.kind === 'badge' ? {
      icon: '🏅', title: `${info.days}-${info.unit} streak!`,
      body: `${info.emoji} ${info.habitName}. ${BADGE_WORDS[info.days] ?? 'Keep going!'} +25 bonus points.`,
    } : info.kind === 'record' ? {
      icon: '🏆', title: info.title, body: info.body,
    } : info.kind === 'level' ? {
      icon: '⭐', title: `Level ${info.level}!`,
      body: 'All those small check-offs are adding up. Keep casting votes for who you want to become.',
    } : {
      icon: '🎉', title: 'Day complete!',
      body: `You did everything today and earned ${info.points} points. ${info.streakHabits > 0 ? `${info.streakHabits} streak${info.streakHabits === 1 ? '' : 's'} kept alive.` : ''} Your surprise box is ready to open! 🎁`,
    }

  return (
    <Modal open onClose={onClose} title="">
      <div className="-mt-6 text-center">
        <div className="animate-pop mb-2 text-7xl">{content.icon}</div>
        <h2 className="mb-2 text-3xl font-black">{content.title}</h2>
        <p className="mb-6 font-semibold text-muted">{content.body}</p>
        <Button className="w-full" onClick={onClose}>Awesome!</Button>
      </div>
    </Modal>
  )
}
