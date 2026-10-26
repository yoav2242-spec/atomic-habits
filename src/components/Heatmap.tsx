import type { ReactNode } from 'react'
import { addDays, formatDay, weekStart, type DateKey } from '../lib/dates'

/** A grid with one column per week (Mon at top) and one rounded square per day. Tap a day to edit it. */
export function Heatmap({ today, weeks, cell, onPick }: {
  today: DateKey; weeks: number
  cell: (date: DateKey) => { color: string; title: string; icon?: ReactNode } | null
  onPick?: (date: DateKey) => void
}) {
  const first = addDays(weekStart(today), -(weeks - 1) * 7)
  const days: DateKey[] = []
  for (let i = 0; i < weeks * 7; i++) days.push(addDays(first, i))
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
      {days.map((d) => {
        const future = d > today
        const c = future ? null : cell(d)
        return (
          <button
            key={d}
            type="button"
            disabled={future || !onPick}
            onClick={() => onPick?.(d)}
            title={c ? `${formatDay(d, { month: 'short', day: 'numeric' })}: ${c.title}` : formatDay(d, { month: 'short', day: 'numeric' })}
            className={`flex aspect-square items-center justify-center rounded-[5px] text-[8px] leading-none ${future ? 'bg-transparent' : 'tray'} ${d === today ? 'ring-2 ring-ink/40' : ''} ${onPick && !future ? 'bouncy' : ''}`}
            style={c ? { background: c.color } : undefined}
          >
            {c?.icon}
          </button>
        )
      })}
    </div>
  )
}
