import { Reorder, useDragControls } from 'motion/react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, PageHeader } from '../components/ui'
import { goalLabel } from '../lib/amounts'
import { WEEKDAY_SHORT } from '../lib/dates'
import { buzz } from '../lib/prefs'
import { useProgress } from '../lib/progress'
import { setOrder } from '../lib/repo'
import type { Habit } from '../lib/types'

export function scheduleLabel(h: Habit) {
  if (h.type === 'break') return 'Breaking'
  const s = h.schedule
  if (s.kind === 'daily') return 'Every day'
  if (s.kind === 'weekly') return `${s.times}× a week`
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ') || 'No days picked'
}

const HOLD_MS = 380
const rowClass = 'clay relative flex touch-manipulation select-none items-center gap-3.5 rounded-[24px] py-3.5 pl-3.5 pr-2 [-webkit-touch-callout:none]'

/** What a habit row shows: its emoji, name and plan, and an Edit button. */
function RowBody({ h, streak, onOpen }: { h: Habit; streak?: number; onOpen?: (e: React.MouseEvent) => void }) {
  return (
    <>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-2xl" style={{ background: `color-mix(in srgb, ${h.color} 38%, var(--card))` }}>{h.emoji}</span>
      <Link to={`/habits/${h.id}`} onClick={onOpen} draggable={false} className="min-w-0 flex-1 py-1">
        <div className="truncate text-[18px] font-extrabold leading-tight">{h.name}</div>
        <div className="mt-0.5 truncate text-[16px] font-bold text-muted">
          {scheduleLabel(h)}{goalLabel(h) && ` · ${goalLabel(h)}`}{h.cue_time && ` · ${h.cue_time}`}{h.level > 1 ? ` · level ${h.level}` : ''}
          {!!streak && <span className="text-[var(--flame)]"> · {streak} in a row</span>}
        </div>
      </Link>
      <Link to={`/habits/${h.id}/edit`} onClick={onOpen} draggable={false} aria-label={`Edit ${h.name}`}
        className="tray bouncy flex min-h-11 shrink-0 items-center rounded-full px-4 text-[16px] font-extrabold text-muted">
        Edit
      </Link>
    </>
  )
}

/** A habit you can press and hold, then drag to a new place in the list. */
function DraggableRow({ h, streak, onDrop }: { h: Habit; streak?: number; onDrop: () => void }) {
  const controls = useDragControls()
  const el = useRef<HTMLLIElement>(null)
  const [lifted, setLifted] = useState(false)
  const liftedRef = useRef(false)
  const dragged = useRef(false) // a drag just happened: the tap that ends it shouldn't open the habit
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  const drop = () => {
    if (!liftedRef.current) return
    liftedRef.current = false
    setLifted(false)
  }

  // While a habit is lifted, the finger moves the habit instead of scrolling the page.
  useEffect(() => {
    const node = el.current
    if (!node) return
    const hold = (e: TouchEvent) => { if (liftedRef.current) e.preventDefault() }
    node.addEventListener('touchmove', hold, { passive: false })
    return () => node.removeEventListener('touchmove', hold)
  }, [])
  useEffect(() => cancelPress, [])

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    dragged.current = false
    cancelPress()
    const start = e
    press.current = {
      x: e.clientX, y: e.clientY,
      timer: setTimeout(() => {
        press.current = null
        liftedRef.current = true
        dragged.current = true
        setLifted(true)
        buzz(12)
        // Once dragging, the finger's release is only reported to the page, not to this row.
        const release = () => {
          window.removeEventListener('pointerup', release, true)
          window.removeEventListener('pointercancel', release, true)
          drop()
          onDrop()
        }
        window.addEventListener('pointerup', release, true)
        window.addEventListener('pointercancel', release, true)
        controls.start(start.nativeEvent)
      }, HOLD_MS),
    }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    // Moving before the hold finishes means scrolling, not dragging.
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress()
  }
  const onPointerUp = () => {
    cancelPress()
    drop()
  }

  return (
    <Reorder.Item
      ref={el}
      value={h.id}
      dragListener={false}
      dragControls={controls}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      animate={{ scale: lifted ? 1.045 : 1, rotate: lifted ? -0.8 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={rowClass}
      style={{ zIndex: lifted ? 20 : 0, boxShadow: lifted ? '0 22px 40px -16px rgba(10, 30, 15, 0.45)' : undefined }}
    >
      <RowBody h={h} streak={streak} onOpen={(e) => { if (dragged.current) e.preventDefault() }} />
    </Reorder.Item>
  )
}

export default function Habits() {
  const progress = useProgress()
  const [showArchived, setShowArchived] = useState(false)
  const habits = progress?.habits.map((p) => p.habit) ?? []
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  // The order on screen, which changes live while dragging and is saved when the habit is dropped.
  const [ids, setIds] = useState<string[]>([])
  const idsRef = useRef(ids)
  idsRef.current = ids
  const activeKey = active.map((h) => h.id).join()
  useEffect(() => setIds(active.map((h) => h.id)), [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!progress) return null
  const byId = new Map(active.map((h) => [h.id, h]))
  const shown = ids.filter((id) => byId.has(id))
  const save = () => setOrder(idsRef.current.map((id) => byId.get(id)).filter((h): h is Habit => !!h))

  return (
    <div>
      <PageHeader title="My habits"
        subtitle={active.length > 1 ? 'Press and hold to move' : undefined}
        action={<Link to="/habits/new" className={buttonClass('primary', '!px-5 !py-2.5')}>+ New</Link>} />
      {active.length === 0 && <p className="text-[18px] font-semibold text-muted">No habits yet</p>}
      <Reorder.Group as="ul" axis="y" values={shown} onReorder={setIds} className="space-y-3">
        {shown.map((id) => <DraggableRow key={id} h={byId.get(id)!} streak={progress.byId.get(id)?.stats.current} onDrop={save} />)}
      </Reorder.Group>
      <Link to="/scorecard" className="tray mt-5 block rounded-[20px] p-4 text-[17px] font-bold leading-snug text-muted">
        Already doing some? <span className="text-ink underline underline-offset-2">Habits Scorecard</span>
      </Link>
      {archived.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowArchived(!showArchived)} className="flex min-h-11 items-center px-1 text-[18px] font-extrabold text-muted">
            {showArchived ? 'Hide' : 'Show'} paused habits ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-3 opacity-70">
              {archived.map((h) => <li key={h.id} className={rowClass}><RowBody h={h} /></li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
