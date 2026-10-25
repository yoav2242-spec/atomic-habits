// Small, dependency-free SVG charts in the app's calm palette.

/** Rounded bars, values 0..1. */
export function BarChart({ values, labels, color = 'var(--color-sage)', highlightLast = true, height = 120 }: {
  values: (number | null)[]; labels: string[]; color?: string; highlightLast?: boolean; height?: number
}) {
  const n = values.length
  const gap = 6
  const w = 300
  const bw = (w - gap * (n - 1)) / n
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {values.map((v, i) => {
          const h = Math.max(4, (v ?? 0) * (height - 4))
          return (
            <g key={i}>
              <rect x={i * (bw + gap)} y={0} width={bw} height={height} rx={Math.min(8, bw / 2)} fill="var(--soft)" />
              <rect
                x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={Math.min(8, bw / 2)}
                fill={color} opacity={v === null ? 0 : highlightLast && i === n - 1 ? 1 : 0.65}
                style={{ transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
            </g>
          )
        })}
      </svg>
      <div className="mt-1.5 flex">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[12px] font-bold text-muted">{l}</span>
        ))}
      </div>
    </div>
  )
}

/** A smooth filled line, any positive values. */
export function AreaChart({ values, color = 'var(--color-level)', height = 110 }: { values: number[]; color?: string; height?: number }) {
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * 300, height - 6 - (v / max) * (height - 12)] as const)
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ')
  return (
    <svg viewBox={`0 0 300 ${height}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none">
      <path d={`${line} L300,${height} L0,${height} Z`} fill={color} fillOpacity={0.16} />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Tiny day-by-day strip: filled = done. */
export function Strip({ values, color }: { values: (0 | 0.5 | 1 | null)[]; color: string }) {
  return (
    <div className="flex gap-[2px]">
      {values.map((v, i) => (
        <span key={i} className="h-5 flex-1 rounded-[3px]" style={{ background: v ? color : 'var(--soft)', opacity: v === 0.5 ? 0.55 : v === null ? 0.35 : 1 }} />
      ))}
    </div>
  )
}
