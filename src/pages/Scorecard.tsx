import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Field, InfoTip, Modal, Stepper, useToast } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { useScorecard } from '../lib/hooks'
import { useProgress } from '../lib/progress'
import { addPastProgress, deleteScorecardItem, newHabit, newId, saveHabit, saveScorecardItem } from '../lib/repo'
import type { ScorecardItem } from '../lib/types'

const RATINGS: { value: ScorecardItem['rating']; label: string; on: string }[] = [
  { value: '+', label: '+', on: 'bg-sage text-white' },
  { value: '=', label: '=', on: 'bg-muted text-white' },
  { value: '-', label: '−', on: 'bg-rose text-white' },
]

export default function Scorecard() {
  const items = useScorecard()
  const progress = useProgress()
  const navigate = useNavigate()
  const toast = useToast()
  const [text, setText] = useState('')
  const [tracking, setTracking] = useState<ScorecardItem | null>(null)
  const [name, setName] = useState('')
  const [days, setDays] = useState(0)
  if (!items || !progress) return null

  const add = async () => {
    if (!text.trim()) return
    await saveScorecardItem({ id: newId(), routine: text.trim(), rating: '=', sort_order: Date.now(), habit_id: null, updated_at: '', deleted: false })
    setText('')
  }
  const count = (r: ScorecardItem['rating']) => items.filter((i) => i.rating === r).length
  const isBad = tracking?.rating === '-'

  const startTracking = (item: ScorecardItem) => {
    setTracking(item)
    setName(item.routine)
    setDays(0)
  }

  const track = async () => {
    if (!tracking || !name.trim()) return
    const habit = { ...newHabit(Date.now()), name: name.trim(), type: isBad ? 'break' as const : 'build' as const, emoji: isBad ? '✂️' : '🌱', color: isBad ? '#ee9f80' : '#7fb69b' }
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
      <Card className="my-5 space-y-2 text-sm font-semibold text-muted">
        <p>Write down what you do on a normal day, from waking up to going to bed. Then mark each one:</p>
        <p><b className="text-sage-deep dark:text-sage">+ good</b> (helps you) · <b>= neutral</b> · <b className="text-rose">− bad</b> (works against you)</p>
        <p>Tap <b>Track</b> to turn any of them into a habit. You can enter how many days you've already been doing it.</p>
      </Card>

      <div className="mb-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Check phone in bed" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add}>Add</Button>
      </div>

      <ol className="space-y-2">
        {items.map((item, n) => {
          const linked = item.habit_id ? progress.byId.get(item.habit_id) : undefined
          return (
            <li key={item.id} className="animate-rise rounded-3xl border border-line bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs font-black text-muted">{n + 1}</span>
                <span className="min-w-0 flex-1 font-bold">{item.routine}</span>
                {RATINGS.map((r) => (
                  <button key={r.value} onClick={() => saveScorecardItem({ ...item, rating: r.value })}
                    className={`bouncy h-9 w-9 rounded-xl font-black ${item.rating === r.value ? r.on : 'bg-soft text-muted'}`}>
                    {r.label}
                  </button>
                ))}
                <button onClick={() => deleteScorecardItem(item)} className="px-1.5 text-lg text-muted" aria-label="Remove">×</button>
              </div>
              <div className="mt-2 pl-7">
                {linked && !linked.habit.deleted ? (
                  <Link to={`/habits/${linked.habit.id}`} className="text-xs font-extrabold text-sage-deep dark:text-sage">
                    ✓ Tracking · {linked.habit.type === 'break' ? `🌿 ${linked.stats.current} days clean` : `🔥 ${linked.stats.current} day streak`} ›
                  </Link>
                ) : (
                  <button onClick={() => startTracking(item)} className="bouncy rounded-full bg-soft px-3 py-1 text-xs font-extrabold text-muted">
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

      <Modal open={!!tracking} onClose={() => setTracking(null)} title={isBad ? '✂️ Break this habit' : '📈 Track this habit'}>
        <div className="space-y-4">
          <Field label="Habit name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
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
            <Button className="flex-1" disabled={!name.trim()} onClick={track}>Start tracking</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
