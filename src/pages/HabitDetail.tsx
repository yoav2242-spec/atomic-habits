import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { streakLabel } from '../components/HabitCard'
import { Heatmap } from '../components/Heatmap'
import { Button, buttonClass, Card, useConfirm } from '../components/ui'
import { db } from '../lib/db'
import { formatDay } from '../lib/dates'
import { useCheckinsByHabit, useIdentities, useToday } from '../lib/hooks'
import { deleteHabit, setArchived } from '../lib/repo'
import { byDate, completionRate, habitStats, isDone, isScheduled, startDate, votes } from '../lib/streaks'
import { scheduleLabel } from './Habits'

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

export default function HabitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const today = useToday()
  const habit = useLiveQuery(() => db.habits.get(id!), [id])
  const all = useCheckinsByHabit()
  const identities = useIdentities()
  const anchor = useLiveQuery(async () => (habit?.stack_after_habit_id ? db.habits.get(habit.stack_after_habit_id) : undefined), [habit])
  const confirm = useConfirm()

  if (!habit || !all || !identities) return null
  const h = habit
  const checkins = all.get(h.id) ?? []
  const s = habitStats(h, checkins, today)
  const map = byDate(checkins)
  const start = startDate(h, checkins)
  const identity = identities.find((i) => i.id === h.identity_id)?.name
  const notes = checkins.filter((c) => c.note).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const anchorText = anchor?.name.toLowerCase() || h.stack_after_text

  const cell = (d: string) => {
    if (d < start) return null
    const c = map.get(d)
    if (h.type === 'break') return c?.kind === 'slip' ? { color: '#ef4444', title: 'slipped' } : { color: `${h.color}aa`, title: 'clean' }
    if (isDone(h, c)) return c!.kind === 'two_min' ? { color: `${h.color}88`, title: '2-minute version' } : { color: h.color, title: 'done' }
    if (c && c.count > 0) return { color: `${h.color}44`, title: `${c.count}/${h.target_count}` }
    return isScheduled(h, d) && d < today ? { color: 'rgba(120,113,108,.25)', title: 'missed' } : null
  }

  const plan = [
    h.type === 'build' && (h.cue_time || h.location) && `I will ${h.name.toLowerCase()}${h.cue_time ? ` at ${h.cue_time}` : ''}${h.location ? ` in ${h.location}` : ''}.`,
    h.type === 'build' && anchorText && `After I ${anchorText}, I will ${h.name.toLowerCase()}.`,
    h.cue_trigger && `Trigger: ${h.cue_trigger}`,
    h.hide_plan && `Hide it: ${h.hide_plan}`,
    h.why && (h.type === 'break' ? `What it costs me: ${h.why}` : `Why: ${h.why}`),
    h.temptation_bundle && `Reward: ${h.temptation_bundle}`,
    h.two_min_version && `2-minute version: ${h.two_min_version}`,
    h.friction_plan && `Make it hard: ${h.friction_plan}`,
    h.contract && `Contract: ${h.contract}`,
  ].filter(Boolean) as string[]

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-stone-500">‹ Back</button>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full text-3xl" style={{ background: `${h.color}22` }}>{h.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{h.name}</h1>
          <p className="text-sm text-stone-500">{scheduleLabel(h)}{identity && ` · I am ${identity}`}{h.archived && ' · paused'}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          [h.type === 'break' ? 'Clean' : 'Streak', streakLabel(s)],
          ['Best', `${s.best} ${s.unit}${s.best === 1 ? '' : 's'}`],
          ['Votes', String(votes(h, checkins, today))],
        ].map(([k, v]) => (
          <Card key={k} className="!p-3 text-center">
            <div className="text-xl font-bold">{v}</div>
            <div className="text-xs text-stone-500">{k}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex justify-between text-sm">
          <span className="font-medium">Last 20 weeks</span>
          <span className="text-stone-500">7d {pct(completionRate(h, checkins, today, 7))} · 30d {pct(completionRate(h, checkins, today, 30))} · 90d {pct(completionRate(h, checkins, today, 90))}</span>
        </div>
        <Heatmap today={today} weeks={20} cell={cell} />
      </Card>

      {plan.length > 0 && (
        <Card className="mb-4 space-y-1.5 text-sm">
          <div className="mb-1 font-medium">Your plan</div>
          {plan.map((p) => <p key={p}>{p}</p>)}
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="mb-4">
          <div className="mb-2 text-sm font-medium">Notes</div>
          <ul className="space-y-2 text-sm">
            {notes.map((n) => (
              <li key={n.id}><span className="text-stone-500">{formatDay(n.date, { month: 'short', day: 'numeric' })}:</span> {n.note}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2">
        <Link to={`/habits/${h.id}/edit`} className={buttonClass('primary', 'flex-1')}>Edit</Link>
        <Button variant="secondary" className="flex-1" onClick={() => setArchived(h, !h.archived)}>{h.archived ? 'Resume' : 'Pause'}</Button>
        <Button variant="ghost" className="!text-red-500"
          onClick={() => confirm.ask('Delete this habit?', 'Its history will be removed too. If you just need a break, use Pause instead.', async () => { await deleteHabit(h); navigate('/habits', { replace: true }) })}>
          Delete
        </Button>
      </div>
      {confirm.element}
    </div>
  )
}
