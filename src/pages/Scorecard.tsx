import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Field, InfoTip, Modal, Segmented, Stepper, useConfirm, useToast } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { useScorecard } from '../lib/hooks'
import { useProgress } from '../lib/progress'
import { addPastProgress, deleteScorecardItem, newHabit, newId, saveHabit, saveScorecardItem } from '../lib/repo'
import { ROUTINE_SUGGESTIONS } from '../lib/suggestions'
import type { ScorecardItem } from '../lib/types'

const RATINGS: { value: ScorecardItem['rating']; label: string; on: string }[] = [
  { value: '+', label: '+', on: 'bg-sage text-white' },
  { value: '=', label: '=', on: 'bg-muted text-white' },
  { value: '-', label: '−', on: 'bg-rose text-white' },
]
const RATING_DOT = { '+': 'var(--color-sage)', '=': 'var(--muted)', '-': 'var(--color-rose)' }

type Drag = { from: number; to: number; startY: number; dy: number; rowH: number; mids: number[] }

export default function Scorecard() {
  const items = useScorecard()
  const progress = useProgress()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const [tracking, setTracking] = useState<ScorecardItem | null>(null)
  const [trackName, setTrackName] = useState('')
  const [days, setDays] = useState(0)
  const [editing, setEditing] = useState<ScorecardItem | null>(null)
  const [editText, setEditText] = useState('')
  const [editRating, setEditRating] = useState<ScorecardItem['rating']>('=')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  if (!items || !progress) return null

  const nextOrder = () => (items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1)
  const add = async (routine: string, rating: ScorecardItem['rating'] = '=') => {
    if (!routine.trim()) return
    const id = newId()
    await saveScorecardItem({ id, routine: routine.trim(), rating, sort_order: nextOrder(), habit_id: null, updated_at: '', deleted: false })
    setJustAdded(id)
    navigator.vibrate?.(8)
  }

  // Suggestions not already on the list. Using one makes the next one slide in.
  const taken = new Set(items.map((i) => i.routine.toLowerCase()))
  const suggestions = ROUTINE_SUGGESTIONS.filter((s) => !taken.has(s.text.toLowerCase()))
  const firstTime = items.length < 5
  const shown = suggestions.slice(0, firstTime ? 12 : 8)

  // --- Drag the ⠿ handle to reorder ---
  const startDrag = (e: React.PointerEvent, from: number) => {
    const rows = [...(listRef.current?.children ?? [])] as HTMLElement[]
    const rects = rows.map((r) => r.getBoundingClientRect())
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // keep getting moves while the finger leaves the handle
    } catch {
      // No real pointer to capture; dragging still works while over the handle.
    }
    setDrag({ from, to: from, startY: e.clientY, dy: 0, rowH: rects[from].height + 8, mids: rects.map((r) => r.top + r.height / 2) })
  }
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return
    const dy = e.clientY - drag.startY
    const center = drag.mids[drag.from] + dy
    const to = drag.mids.filter((m, i) => i !== drag.from && m < center).length
    setDrag({ ...drag, dy, to })
  }
  const endDrag = async () => {
    if (!drag) return
    const { from, to } = drag
    setDrag(null)
    if (from !== to) await reorder(from, to)
  }
  const reorder = async (from: number, to: number) => {
    const list = [...items]
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved)
    for (let i = 0; i < list.length; i++) if (list[i].sort_order !== i + 1) await saveScorecardItem({ ...list[i], sort_order: i + 1 })
  }
  const shiftFor = (i: number) => {
    if (!drag) return 0
    if (i === drag.from) return drag.dy
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.rowH
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.rowH
    return 0
  }

  const openEdit = (item: ScorecardItem) => {
    setEditing(item)
    setEditText(item.routine)
    setEditRating(item.rating)
  }
  const saveEdit = async () => {
    if (editing && editText.trim()) await saveScorecardItem({ ...editing, routine: editText.trim(), rating: editRating })
    setEditing(null)
  }
  const editIndex = editing ? items.findIndex((i) => i.id === editing.id) : -1

  const count = (r: ScorecardItem['rating']) => items.filter((i) => i.rating === r).length
  const isBad = tracking?.rating === '-'
  const track = async () => {
    if (!tracking || !trackName.trim()) return
    const habit = { ...newHabit(Date.now()), name: trackName.trim(), type: isBad ? 'break' as const : 'build' as const, emoji: isBad ? '✂️' : '🌱', color: isBad ? '#ee9f80' : '#7fb69b' }
    await saveHabit(habit)
    await addPastProgress(habit, days)
    await saveScorecardItem({ ...tracking, habit_id: habit.id })
    setTracking(null)
    bigCelebration()
    toast(days ? `Tracking it, with ${days} days already done!` : 'Now tracking it!')
  }

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-bold text-muted">‹ Back</button>
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-black tracking-tight">Habits Scorecard</h1>
        <InfoTip tip="scorecard" />
      </div>
      <p className="mb-4 mt-1 text-sm font-semibold text-muted">
        List your normal day, from waking up to going to bed. Mark each thing <b className="text-sage-deep dark:text-sage">+ good</b>, <b>= neutral</b> or <b className="text-rose">− bad</b>.
      </p>

      {shown.length > 0 && (
        <Card className="mb-4">
          <div className="mb-1 font-black">{firstTime ? '👋 Tap what you do on a normal day' : '💡 More ideas'}</div>
          <p className="mb-3 text-xs font-semibold text-muted">Tap to add it. A new idea pops up each time.</p>
          <div className="flex flex-wrap gap-2">
            {shown.map((s) => (
              <button key={s.text} onClick={() => add(s.text, s.rating)}
                className="bouncy animate-rise rounded-full border-2 border-line bg-card px-3.5 py-2 text-sm font-bold">
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: RATING_DOT[s.rating] }} />
                {s.text} <span className="text-muted">+</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type your own…" onKeyDown={(e) => { if (e.key === 'Enter') { add(text); setText('') } }} />
        <Button onClick={() => { add(text); setText('') }}>Add</Button>
      </div>

      {items.length > 1 && <p className="mb-2 text-xs font-semibold text-muted">Drag ⠿ to reorder. Tap a name to edit or replace it.</p>}
      <ol ref={listRef} className="space-y-2">
        {items.map((item, n) => {
          const linked = item.habit_id ? progress.byId.get(item.habit_id) : undefined
          const dragging = drag?.from === n
          return (
            <li key={item.id}
              className={`rounded-3xl border border-line bg-card p-3 shadow-sm ${item.id === justAdded ? 'animate-rise' : ''} ${dragging ? 'relative z-10 scale-[1.02] shadow-xl' : ''}`}
              style={{ transform: `translateY(${shiftFor(n)}px)${dragging ? ' scale(1.02)' : ''}`, transition: dragging ? 'none' : 'transform 0.2s ease' }}>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label="Drag to reorder"
                  className="cursor-grab touch-none px-1 text-lg leading-none text-muted"
                  onPointerDown={(e) => startDrag(e, n)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                >⠿</button>
                <button onClick={() => openEdit(item)} className="min-w-0 flex-1 text-left font-bold">{item.routine}</button>
                {RATINGS.map((r) => (
                  <button key={r.value} onClick={() => saveScorecardItem({ ...item, rating: r.value })}
                    className={`bouncy h-9 w-9 rounded-xl font-black ${item.rating === r.value ? r.on : 'bg-soft text-muted'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 pl-7">
                {linked ? (
                  <Link to={`/habits/${linked.habit.id}`} className="text-xs font-extrabold text-sage-deep dark:text-sage">
                    ✓ Tracking · {linked.habit.type === 'break' ? `🌿 ${linked.stats.current} days clean` : `🔥 ${linked.stats.current} day streak`} ›
                  </Link>
                ) : (
                  <button onClick={() => { setTracking(item); setTrackName(item.routine); setDays(0) }} className="bouncy rounded-full bg-soft px-3 py-1 text-xs font-extrabold text-muted">
                    {item.rating === '-' ? '✂️ Track to break it' : '📈 Track this habit'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {items.length > 0 && (
        <Card className="mt-5 text-sm">
          <p className="mb-1 font-black">{count('+')} good · {count('=')} neutral · {count('-')} bad</p>
          <p className="font-semibold text-muted">Next step: track one “−” to break it, or add a new habit right after one of your “+” routines.</p>
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="✏️ Edit">
        <div className="space-y-4">
          <Field label="What you do"><input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus /></Field>
          <Field label="Is it good for you?">
            <Segmented value={editRating} onChange={setEditRating} options={[{ value: '+', label: '+ Good' }, { value: '=', label: '= Neutral' }, { value: '-', label: '− Bad' }]} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 !py-2 text-sm" disabled={editIndex <= 0} onClick={async () => { await reorder(editIndex, editIndex - 1); setEditing(null) }}>▲ Move up</Button>
            <Button variant="secondary" className="flex-1 !py-2 text-sm" disabled={editIndex === items.length - 1} onClick={async () => { await reorder(editIndex, editIndex + 1); setEditing(null) }}>▼ Move down</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => { const it = editing!; setEditing(null); confirm.ask('Remove this?', `“${it.routine}” will be removed from your scorecard.`, () => deleteScorecardItem(it)) }}>Delete</Button>
            <Button className="flex-1" disabled={!editText.trim()} onClick={saveEdit}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!tracking} onClose={() => setTracking(null)} title={isBad ? '✂️ Break this habit' : '📈 Track this habit'}>
        <div className="space-y-4">
          <Field label="Habit name"><input value={trackName} onChange={(e) => setTrackName(e.target.value)} /></Field>
          <Field label={isBad ? 'Days since you last did it' : 'Days in a row you have already done it'} hint="Your progress so far. It counts toward your streak.">
            <div className="flex flex-wrap items-center gap-2">
              <Stepper value={days} min={0} max={365} onChange={setDays} />
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)} className={`bouncy rounded-full px-3 py-1.5 text-xs font-extrabold ${days === d ? 'bg-sage text-white' : 'bg-soft text-muted'}`}>{d}</button>
              ))}
            </div>
          </Field>
          <p className="text-xs font-semibold text-muted">You can add more details later with ✏️ Edit.</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setTracking(null)}>Cancel</Button>
            <Button className="flex-1" disabled={!trackName.trim()} onClick={track}>Start tracking</Button>
          </div>
        </div>
      </Modal>
      {confirm.element}
    </div>
  )
}
