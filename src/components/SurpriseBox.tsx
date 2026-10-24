import { useState } from 'react'
import { Link } from 'react-router-dom'
import { bigCelebration } from '../lib/celebrate'
import type { Progress } from '../lib/progress'
import { openBox, THEMES, unlockedThemes, type BoxPrize } from '../lib/rewards'
import { Button, buttonClass, Modal } from './ui'

/** The day's mystery box: opens once you've finished everything for the day. */
export function SurpriseBox({ progress, ready }: { progress: Progress; ready: boolean }) {
  const [prize, setPrize] = useState<BoxPrize | null>(null)
  const [shaking, setShaking] = useState(false)
  const date = progress.today
  const opened = progress.rewards.find((r) => r.id === `box_${date}`)

  const open = async () => {
    setShaking(true)
    const locked = THEMES.map((t) => t.id).filter((id) => !unlockedThemes(progress.level.level, progress.rewards).includes(id))
    await new Promise((r) => setTimeout(r, 900))
    const p = await openBox(date, locked)
    setShaking(false)
    setPrize(p)
    bigCelebration()
  }

  if (opened && !prize) {
    return (
      <Link to="/rewards" className="bouncy mb-5 flex items-center gap-3 rounded-3xl border border-line bg-card p-3 text-sm font-bold shadow-sm">
        <span className="text-2xl">🎁</span>
        <span className="flex-1 text-muted">Today's box is opened. A new one tomorrow!</span>
        <span className="text-muted">Rewards ›</span>
      </Link>
    )
  }

  return (
    <>
      {!opened && (
        <button
          disabled={!ready || shaking}
          onClick={open}
          className={`bouncy mb-5 flex w-full items-center gap-3 rounded-3xl p-4 text-left shadow-sm ${ready ? 'text-white' : 'border border-dashed border-line bg-card'}`}
          style={ready ? { background: 'linear-gradient(135deg, var(--color-lavender), var(--color-rose))', boxShadow: '0 4px 0 0 var(--color-lavender-deep)' } : undefined}
        >
          <span className={`text-4xl ${shaking ? 'animate-wiggle' : ready ? 'animate-pop' : 'opacity-40 grayscale'}`}>🎁</span>
          <span className="flex-1">
            <span className="block font-black">{ready ? 'Your surprise box is ready!' : "Today's surprise box"}</span>
            <span className={`text-xs font-bold ${ready ? 'text-white/85' : 'text-muted'}`}>
              {ready ? (shaking ? 'Opening…' : 'Tap to open it') : "Finish all of today's habits to unlock it"}
            </span>
          </span>
        </button>
      )}

      <Modal open={!!prize} onClose={() => setPrize(null)} title="">
        {prize && (
          <div className="-mt-6 text-center">
            <div className="animate-pop mb-2 text-7xl">
              {prize.kind === 'sticker' ? prize.emoji : prize.kind === 'theme' ? '🎨' : prize.kind === 'fact' ? '💡' : '⭐'}
            </div>
            <h2 className="mb-2 text-2xl font-black">
              {prize.kind === 'sticker' ? `${prize.rarity === 'legendary' ? 'LEGENDARY' : prize.rarity === 'rare' ? 'Rare' : 'New'} sticker!`
                : prize.kind === 'theme' ? `New theme: ${THEMES.find((t) => t.id === prize.themeId)?.name}!`
                : prize.kind === 'fact' ? 'Did you know?' : `+${prize.points} bonus points!`}
            </h2>
            <p className="mb-6 font-semibold text-muted">
              {prize.kind === 'sticker' ? 'Added to your sticker collection. Can you collect them all?'
                : prize.kind === 'theme' ? 'Unlocked early! Switch to it on the Rewards page.'
                : prize.kind === 'fact' ? prize.text : 'Small wins add up.'}
              {prize.kind !== 'points' && ` +${prize.points} points.`}
            </p>
            <div className="flex gap-2">
              <Link to="/rewards" className={buttonClass('secondary', 'flex-1')}>See rewards</Link>
              <Button className="flex-1" onClick={() => setPrize(null)}>Yay!</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
