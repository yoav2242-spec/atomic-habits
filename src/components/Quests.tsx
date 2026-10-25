import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { burst } from '../lib/celebrate'
import { db } from '../lib/db'
import type { Progress } from '../lib/progress'
import { questsFor, weakestName, type Quest, type QuestContext } from '../lib/quests'
import { saveReward } from '../lib/rewards'
import { spring, useToast } from './ui'

/** Things done today that quests can ask for, stored as meta keys like "flag:2026-10-24:read_tip". */
export const markFlag = (date: string, flag: string) => db.meta.put({ key: `flag:${date}:${flag}`, value: '1' })

export interface QuestStatus {
  list: { q: Quest; done: boolean }[]
  done: number
  weakest?: string
}

/** Today's quests and which are done. Finished quests pay out once, the moment they're done. Use once per screen. */
export function useQuests(progress: Progress | undefined): QuestStatus | null {
  const toast = useToast()
  const date = progress?.today ?? ''
  const flags = useLiveQuery(async () => {
    const rows = await db.meta.where('key').startsWith(`flag:${date}:`).toArray()
    return new Set(rows.map((r) => r.key.split(':')[2]))
  }, [date])
  const comeback = useLiveQuery(async () => (await db.meta.get('comeback'))?.value === date, [date])

  const ctx: QuestContext | null = progress && flags && comeback !== undefined ? { progress, flags, comeback } : null
  const claimed = new Set(progress?.rewards.filter((r) => r.kind === 'quest' && r.date === date).map((r) => r.item) ?? [])
  const list = ctx ? questsFor(ctx).map((q) => ({ q, done: claimed.has(q.id) || q.check(ctx) })) : []

  useEffect(() => {
    for (const { q, done } of list) {
      if (!done || claimed.has(q.id)) continue
      saveReward({ id: `quest_${date}_${q.id}`, date, kind: 'quest', points: q.points, item: q.id }).then((isNew) => {
        if (!isNew) return
        burst()
        toast(`Quest done · +${q.points} points`)
      })
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ctx) return null
  return { list, done: list.filter((s) => s.done).length, weakest: weakestName(ctx) }
}

export function QuestList({ status }: { status: QuestStatus }) {
  return (
    <ul className="space-y-2.5">
      {status.list.map(({ q, done }) => (
        <motion.li layout transition={spring} key={q.id}
          className={`flex min-h-14 items-center gap-3 rounded-2xl px-3.5 py-3 ${done ? 'bg-[color-mix(in_srgb,var(--color-sage)_45%,var(--card))]' : 'tray'}`}>
          <motion.span key={String(done)} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-black ${done ? 'puffy bg-sage text-on-pastel' : 'border-2 border-muted/40'}`}>
            {done ? '✓' : ''}
          </motion.span>
          <span className={`flex-1 text-[16px] font-bold leading-tight ${done ? 'text-muted' : ''}`}>
            {q.title}
            {q.id === 'weakest' && status.weakest && <span className="block text-xs font-semibold opacity-70">({status.weakest})</span>}
          </span>
          <span className={`shrink-0 text-[16px] font-black tabular-nums ${done ? 'text-sage-deep' : 'text-muted'}`}>+{q.points}</span>
        </motion.li>
      ))}
    </ul>
  )
}
