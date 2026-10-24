import { addDays, formatDay, weekStart, type DateKey } from '../lib/dates'

/** A GitHub-style grid: one column per week (Mon at top), one square per day. */
export function Heatmap({ today, weeks, cell }: { today: DateKey; weeks: number; cell: (date: DateKey) => { color: string; title: string } | null }) {
  const first = addDays(weekStart(today), -(weeks - 1) * 7)
  const days: DateKey[] = []
  for (let i = 0; i < weeks * 7; i++) days.push(addDays(first, i))
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
      {days.map((d) => {
        const c = d <= today ? cell(d) : null
        return (
          <div
            key={d}
            title={c ? `${formatDay(d, { month: 'short', day: 'numeric' })}: ${c.title}` : undefined}
            className="aspect-square rounded-[3px] bg-stone-200/60 dark:bg-stone-800/60"
            style={c ? { background: c.color } : d > today ? { background: 'transparent' } : undefined}
          />
        )
      })}
    </div>
  )
}
