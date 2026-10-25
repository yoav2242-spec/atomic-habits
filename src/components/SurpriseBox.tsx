import { useState } from 'react'
import { Link } from 'react-router-dom'
import { bigCelebration } from '../lib/celebrate'
import type { Progress } from '../lib/progress'
import { openBox, THEMES, unlockedThemes, type BoxPrize } from '../lib/rewards'
import { CountUp } from './RecapStory'
import { Button, buttonClass, Modal } from './ui'

/** The daily bonus: unlocks once everything for the day is done, and pays out points (sometimes a sticker or theme too). */
export function SurpriseBox({ progress, ready }: { progress: Progress; ready: boolean }) {
  const [prize, setPrize] = useState<BoxPrize | null>(null)
  const [shaking, setShaking] = useState(false)
  const date = progress.today
  const opened = progress.rewards.find((r) => r.id === `box_${date}`)

  const open = async () => {
    setShaking(true)
    const locked = THEMES.map((t) => t.id).filter((id) => !unlockedThemes(progress.level.level, progress.rewards).includes(id))
    await new Promise((r) => setTimeout(r, 500))
    const p = await openBox(date, locked)
    setShaking(false)
    setPrize(p)
    bigCelebration()
  }

  if (opened && !prize) {
    return (
      <Link to="/rewards" className="tray bouncy flex min-h-16 items-center gap-3 rounded-[22px] p-4 text-[16px] font-bold">
        <span className="flex-1 text-muted">Today's bonus is collected. A new one tomorrow.</span>
        <span className="shrink-0 font-extrabold text-muted">History ›</span>
      </Link>
    )
  }

  return (
    <>
      {!opened && (
        <button
          disabled={!ready || shaking}
          onClick={open}
          className={`bouncy flex min-h-20 w-full items-center gap-4 rounded-[24px] p-4 text-left ${ready ? 'puffy bg-sage text-on-pastel' : 'tray'}`}
        >
          <span className="flex-1">
            <span className="block text-[18px] font-black">{ready ? 'Daily bonus unlocked' : 'Daily bonus'}</span>
            <span className={`text-[15px] font-bold ${ready ? 'text-on-pastel/75' : 'text-muted'}`}>
              {ready ? (shaking ? 'Adding it up…' : 'Tap to collect your points') : "Finish all of today's habits to unlock it"}
            </span>
          </span>
          {ready && <span className="shrink-0 text-[17px] font-black">Collect</span>}
        </button>
      )}

      <Modal open={!!prize} onClose={() => setPrize(null)} title="">
        {prize && (
          <div className="-mt-4">
            <p className="text-[17px] font-extrabold text-sage-deep">Daily bonus</p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[64px] font-black leading-none tracking-[-0.04em]"><CountUp to={prize.points} prefix="+" /></span>
              <span className="text-[20px] font-extrabold text-muted">points</span>
            </div>
            <p className="mb-6 mt-3 text-[17px] font-semibold leading-snug text-muted">
              {prize.kind === 'sticker' ? 'Also added a sticker to your collection.'
                : prize.kind === 'theme' ? `Also unlocked the ${THEMES.find((t) => t.id === prize.themeId)?.name} colour theme early.`
                : prize.kind === 'fact' ? prize.text : 'Finishing every habit, every day, is how the numbers grow.'}
            </p>
            <div className="flex gap-2">
              <Link to="/rewards" className={buttonClass('secondary', 'flex-1')}>History</Link>
              <Button className="flex-1" onClick={() => setPrize(null)}>Continue</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
