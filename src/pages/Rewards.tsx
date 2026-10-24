import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Card, InfoTip, XPBar } from '../components/ui'
import { getMeta } from '../lib/db'
import { useProgress } from '../lib/progress'
import { setTheme, STICKERS, THEMES, unlockedThemes } from '../lib/rewards'

export default function Rewards() {
  const navigate = useNavigate()
  const progress = useProgress()
  const current = useLiveQuery(() => getMeta('theme'), [], 'sage')
  if (!progress) return null

  const unlocked = new Set(unlockedThemes(progress.level.level, progress.rewards))
  const stickerCounts = new Map<string, number>()
  for (const r of progress.rewards) if (r.item.startsWith('sticker:')) stickerCounts.set(r.item.slice(8), (stickerCounts.get(r.item.slice(8)) ?? 0) + 1)
  const boxes = progress.rewards.filter((r) => r.kind === 'box').length
  const quests = progress.rewards.filter((r) => r.kind === 'quest').length

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-bold text-muted">‹ Back</button>
      <h1 className="text-3xl font-black tracking-tight">🎁 Rewards</h1>
      <p className="mb-5 font-semibold text-muted">Level up to unlock new colors. Open surprise boxes to collect stickers.</p>

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-black">Level {progress.level.level} <InfoTip tip="points" /></span>
          <span className="text-xs font-bold text-muted">{boxes} box{boxes === 1 ? "" : "es"} opened · {quests} quest{quests === 1 ? "" : "s"} done</span>
        </div>
        <XPBar into={progress.level.into} need={progress.level.need} />
      </Card>

      <Card className="mb-4">
        <div className="mb-3 font-black">🎨 Color themes</div>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => {
            const open = unlocked.has(t.id)
            const active = (current ?? 'sage') === t.id
            return (
              <button key={t.id} disabled={!open} onClick={() => setTheme(t.id)}
                className={`bouncy flex flex-col items-center gap-1 rounded-2xl p-2 ${active ? 'ring-[3px] ring-ink/60' : ''} ${open ? 'bg-soft' : 'bg-soft opacity-50'}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm text-white" style={{ background: open ? t.accent : 'var(--line)', boxShadow: open ? `0 3px 0 0 ${t.deep}` : undefined }}>
                  {active ? '✓' : open ? '' : '🔒'}
                </span>
                <span className="text-[11px] font-extrabold">{t.name}</span>
                {!open && <span className="text-[10px] font-bold text-muted">Level {t.level}</span>}
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-1 font-black">🦊 Sticker collection</div>
        <p className="mb-3 text-xs font-semibold text-muted">{stickerCounts.size} of {STICKERS.length} collected. Finish your day to open a surprise box.</p>
        <div className="grid grid-cols-6 gap-2">
          {STICKERS.map((s) => {
            const n = stickerCounts.get(s.emoji) ?? 0
            return (
              <div key={s.emoji} className={`relative flex aspect-square items-center justify-center rounded-2xl text-2xl ${n ? '' : 'bg-soft'}`}
                style={n ? { background: s.rarity === 'legendary' ? 'color-mix(in srgb, var(--color-butter) 35%, var(--card))' : s.rarity === 'rare' ? 'color-mix(in srgb, var(--color-lavender) 25%, var(--card))' : 'var(--soft)' } : undefined}
                title={s.rarity}>
                <span className={n ? '' : 'opacity-20 grayscale'}>{n ? s.emoji : '❔'}</span>
                {n > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 text-[10px] font-black text-bg">×{n}</span>}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-muted">Purple background = rare · gold = legendary</p>
      </Card>
    </div>
  )
}
