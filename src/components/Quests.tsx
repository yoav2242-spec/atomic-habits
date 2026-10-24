import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { burst } from '../lib/celebrate'
import { db } from '../lib/db'
import type { Progress } from '../lib/progress'
import { questsFor, weakestName, type QuestContext } from '../lib/quests'
import { saveReward } from '../lib/rewards'
import { useToast } from './ui'

/** Things done today that quests can ask for, stored as meta keys like "flag:2026-10-24:read_tip". */
export const markFlag = (date: string, flag: string) => db.meta.put({ key: `flag:${date}:${flag}`, value: '1' })

export function Quests({ progress }: { progress: Progress }) {
  const toast = useToast()
  const date = progress.today
  const flags = useLiveQuery(async () => {
    const rows = await db.meta.where('key').startsWith(`flag:${date}:`).toArray()
    return new Set(rows.map((r) => r.key.split(':')[2]))
  }, [date])
  const comeback = useLiveQuery(async () => (await db.meta.get('comeback'))?.value === date, [date])

  const ctx: QuestContext | null = flags && comeback !== undefined ? { progress, flags, comeback } : null
  const quests = ctx ? questsFor(ctx) : []
  const claimed = new Set(progress.rewards.filter((r) => r.kind === 'quest' && r.date === date).map((r) => r.item))
  const status = ctx ? quests.map((q) => ({ q, done: claimed.has(q.id) || q.check(ctx) })) : []

  // Finished quests pay out once, the moment they're done.
  useEffect(() => {
    for (const { q, done } of status) {
      if (!done || claimed.has(q.id)) continue
      saveReward({ id: `quest_${date}_${q.id}`, date, kind: 'quest', points: q.points, item: q.id }).then((isNew) => {
        if (!isNew) return
        burst()
        toast(`${q.icon} Quest complete! +${q.points}`)
      })
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx || quests.length === 0) return null
  const doneCount = status.filter((s) => s.done).length
  const weakest = weakestName(ctx)

  return (
    <div className="mb-5 rounded-3xl border border-line bg-card p-4 shadow-[0_2px_10px_-4px_rgba(60,60,90,0.12)]">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-black">🎯 Daily quests</span>
        <span className="text-xs font-black text-muted">{doneCount}/{status.length} · new ones tomorrow</span>
      </div>
      <ul className="space-y-2">
        {status.map(({ q, done }) => (
          <li key={q.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${done ? 'bg-sage/15' : q.id === 'comeback' ? 'bg-butter/20' : 'bg-soft'}`}>
            <span className={`text-xl ${done ? 'animate-pop' : ''}`}>{done ? '✅' : q.icon}</span>
            <span className={`flex-1 text-sm font-bold leading-tight ${done ? 'text-muted line-through' : ''}`}>
              {q.title}
              {q.id === 'weakest' && weakest && <span className="block text-xs font-semibold text-muted">({weakest})</span>}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${done ? 'bg-sage text-white' : 'bg-card text-muted'}`}>+{q.points}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
