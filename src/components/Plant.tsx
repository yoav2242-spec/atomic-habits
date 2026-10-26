/** How a habit's plant looks after a number of practice days: seed, sprout, young plant, flowering, young tree, and after a year a big, full tree. */
export function plantStage(days: number) {
  if (days === 0) return 'Seed'
  if (days < 7) return 'Sprout'
  if (days < 21) return 'Young plant'
  if (days < 66) return 'In flower'
  if (days < 365) return 'Young tree'
  return 'Full-grown tree'
}

/** 0 for a seed, 1 for a tree a year old: drives how large the plant is drawn. */
export function plantGrowth(days: number) {
  if (days < 66) return (days / 66) * 0.35
  return 0.35 + 0.65 * Math.min(1, (days - 66) / (365 - 66))
}

// The same habit always grows the same shape.
function seeded(id: string) {
  let a = [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) | 0, 7)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GROUND = 186

function Leaf({ x, y, angle, size, fill }: { x: number; y: number; angle: number; size: number; fill: string }) {
  return <path d={`M0 0 C ${size * 0.35} ${-size * 0.45}, ${size * 0.85} ${-size * 0.4}, ${size} 0 C ${size * 0.85} ${size * 0.4}, ${size * 0.35} ${size * 0.45}, 0 0 Z`} fill={fill} transform={`translate(${x} ${y}) rotate(${angle})`} />
}

function Flower({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r} fill={color} />
      ))}
      <circle cx={x} cy={y} r={r * 0.75} fill="var(--color-butter)" />
    </g>
  )
}

/** One habit as a drawn plant. Droops and loses colour while it needs water, but never dies. */
export function Plant({ days, color, id, thirsty = false, sway = true, className = '' }: { days: number; color: string; id: string; thirsty?: boolean; sway?: boolean; className?: string }) {
  const rand = seeded(id)
  const leaf = 'var(--leaf)'
  const deep = 'var(--leaf-deep)'
  const light = 'var(--leaf-light)'
  const parts: React.ReactNode[] = []

  if (days === 0) {
    parts.push(<ellipse key="seed" cx={100} cy={GROUND - 8} rx={11} ry={7.5} fill="var(--trunk)" />)
    parts.push(<path key="crack" d={`M96 ${GROUND - 11} q4 3 8 0`} stroke="var(--soil)" strokeWidth={2} fill="none" strokeLinecap="round" />)
  } else if (days < 66) {
    // A green plant: taller with more leaves as the days add up, flowers from three weeks.
    const top = days < 7 ? GROUND - 34 - days * 3 : days < 21 ? GROUND - 62 - (days - 7) * 2.6 : GROUND - 98 - (days - 21) * 1.1
    const pairs = days < 7 ? 1 : days < 21 ? 2 : 3
    const lean = (rand() - 0.5) * 14
    parts.push(<path key="stem" d={`M100 ${GROUND} Q ${100 + lean} ${(GROUND + top) / 2} ${100 + lean * 0.4} ${top}`} stroke={deep} strokeWidth={days < 21 ? 4 : 5} fill="none" strokeLinecap="round" />)
    for (let i = 0; i < pairs; i++) {
      const y = top + 8 + ((GROUND - top - 24) * (i + 0.4)) / pairs
      const size = (days < 7 ? 20 : 28) + i * 3
      parts.push(<Leaf key={`l${i}`} x={100 + lean * 0.5} y={y} angle={-35 - rand() * 20} size={size} fill={i % 2 ? leaf : light} />)
      parts.push(<Leaf key={`r${i}`} x={100 + lean * 0.5} y={y + 6} angle={-145 + rand() * 20} size={size} fill={i % 2 ? light : leaf} />)
    }
    if (days < 21) parts.push(<Leaf key="tip" x={100 + lean * 0.4} y={top + 2} angle={-90 + lean} size={days < 7 ? 16 : 20} fill={leaf} />)
    else {
      const flowers = Math.min(3, 1 + Math.floor((days - 21) / 15))
      const spots = [[100 + lean * 0.4, top], [72, top + 26], [128, top + 18]]
      for (let i = 1; i < flowers; i++) parts.push(<path key={`b${i}`} d={`M${100 + lean * 0.45} ${top + 34} Q ${spots[i][0]} ${spots[i][1] + 22} ${spots[i][0]} ${spots[i][1]}`} stroke={deep} strokeWidth={3.5} fill="none" strokeLinecap="round" />)
      for (let i = 0; i < flowers; i++) parts.push(<Flower key={`f${i}`} x={spots[i][0]} y={spots[i][1]} r={i ? 6 : 8} color={color} />)
    }
  } else {
    // A tree: the trunk thickens and the crown fills out until, at a year, it's lush and full of blossom.
    const t = Math.min(1, (days - 66) / (365 - 66))
    const R = 40 + 46 * t
    const cy = 92 - 18 * t
    const trunkW = 9 + 9 * t
    parts.push(<path key="trunk" d={`M${100 - trunkW} ${GROUND} C ${100 - trunkW * 0.5} ${GROUND - 30}, ${100 - trunkW * 0.4} ${cy + 40}, 96 ${cy + 10} L 104 ${cy + 10} C ${100 + trunkW * 0.4} ${cy + 40}, ${100 + trunkW * 0.5} ${GROUND - 30}, ${100 + trunkW} ${GROUND} Z`} fill="var(--trunk)" />)
    parts.push(<path key="branch1" d={`M100 ${cy + 40} Q ${80 - 10 * t} ${cy + 26} ${74 - 14 * t} ${cy + 6}`} stroke="var(--trunk)" strokeWidth={4 + 3 * t} fill="none" strokeLinecap="round" />)
    parts.push(<path key="branch2" d={`M100 ${cy + 34} Q ${120 + 10 * t} ${cy + 22} ${128 + 14 * t} ${cy}`} stroke="var(--trunk)" strokeWidth={4 + 3 * t} fill="none" strokeLinecap="round" />)
    const blobs = 7 + Math.round(10 * t)
    const tones = [deep, leaf, light]
    // Darker clumps at the back, lighter ones in front, so the crown reads as round.
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < Math.ceil(blobs / 3); i++) {
        const a = rand() * Math.PI * 2
        const d = rand() * R * (0.62 - layer * 0.12)
        const r = R * (0.42 + rand() * 0.16 - layer * 0.06)
        parts.push(<circle key={`c${layer}-${i}`} cx={100 + Math.cos(a) * d * 1.08} cy={cy + Math.sin(a) * d * 0.78 - layer * 3} r={r} fill={tones[layer]} />)
      }
    }
    const blossoms = 4 + Math.round(20 * t)
    for (let i = 0; i < blossoms; i++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * R * 0.85
      parts.push(<circle key={`p${i}`} cx={100 + Math.cos(a) * d * 1.05} cy={cy + Math.sin(a) * d * 0.75} r={3.2 + rand() * 2.4} fill={color} />)
    }
    if (days >= 365) {
      // A year: a few fallen petals and grass round its feet.
      for (let i = 0; i < 6; i++) parts.push(<ellipse key={`fp${i}`} cx={46 + rand() * 108} cy={GROUND + 1 + rand() * 6} rx={3} ry={1.8} fill={color} />)
    }
  }

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden style={{ overflow: 'visible' }}>
      <ellipse cx={100} cy={GROUND + 3} rx={days >= 66 ? 70 : 46} ry={days >= 66 ? 11 : 8} fill="var(--soil)" />
      <g className={sway && days > 0 && !thirsty ? 'plant-sway' : undefined}
        style={{ transformOrigin: `100px ${GROUND}px`, transform: thirsty ? 'rotate(-7deg)' : undefined, filter: thirsty ? 'saturate(0.3) brightness(0.95)' : undefined, animationDelay: `${-rand() * 4}s` }}>
        {parts}
      </g>
    </svg>
  )
}
