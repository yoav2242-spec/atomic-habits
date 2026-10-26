import { Snowflake } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClockAlarm } from '../components/ClockAlarm'
import { DayEditor } from '../components/DayEditor'
import { streakLabel } from '../components/HabitCard'
import { Heatmap } from '../components/Heatmap'
import { LevelUpModal } from '../components/LevelUpModal'
import { BackButton, Button, buttonClass, Card, InfoTip, useConfirm } from '../components/ui'
import { isAmount } from '../lib/amounts'
import { formatDay } from '../lib/dates'
import { useProgress } from '../lib/progress'
import { deleteHabit, setArchived } from '../lib/repo'
import { byDate, isDone, MILESTONES, startDate, votes } from '../lib/streaks'
import { scheduleLabel } from './Habits'

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

export default function HabitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const progress = useProgress()
  const confirm = useConfirm()
  const [editDay, setEditDay] = useState<string | null>(null)
  const [levelDir, setLevelDir] = useState<1 | -1 | null>(null)

  const p = progress?.byId.get(id!)
  if (!progress || !p) return null
  const { habit: h, checkins, stats: s } = p
  const today = progress.today
  const map = byDate(checkins)
  const start = startDate(h, checkins)
  const identity = progress.identities.find((i) => i.id === h.identity_id)?.name
  const notes = checkins.filter((c) => c.note).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const anchor = h.stack_after_habit_id ? progress.byId.get(h.stack_after_habit_id)?.habit.name.toLowerCase() : h.stack_after_text

  const cell = (d: string) => {
    const c = map.get(d)
    if (h.type === 'break') {
      if (c?.kind === 'slip') return { color: 'var(--color-rose)', title: 'slipped' }
      return d < start ? null : { color: `${h.color}aa`, title: 'clean' }
    }
    if (isDone(h, c)) return c!.kind === 'two_min' ? { color: `${h.color}88`, title: '2-minute version', icon: '½' } : { color: h.color, title: 'done' }
    if (s.frozen.has(d)) return { color: 'color-mix(in srgb, var(--color-sky) 45%, transparent)', title: 'saved by a freeze', icon: <Snowflake size={11} strokeWidth={2.6} aria-hidden /> }
    if (c && c.count > 0) return { color: `${h.color}44`, title: `${c.count}/${h.target_count}` }
    return null
  }

  const plan = [
    h.type === 'build' && (h.cue_time || h.location) && `I will ${h.name.toLowerCase()}${h.cue_time ? ` at ${h.cue_time}` : ''}${h.location ? ` in ${h.location}` : ''}.`,
    h.type === 'build' && anchor && `After I ${anchor}, I will ${h.name.toLowerCase()}.`,
    h.cue_trigger && `Trigger: ${h.cue_trigger}`,
    h.hide_plan && `Hide it: ${h.hide_plan}`,
    h.why && (h.type === 'break' ? `What it costs me: ${h.why}` : `Why: ${h.why}`),
    h.type === 'build' && h.temptation_bundle && `Treat: ${h.temptation_bundle}`,
    h.type === 'build' && h.two_min_version && `2-minute version: ${h.two_min_version}`,
    h.friction_plan && `Make it hard: ${h.friction_plan}`,
    h.contract && `Contract: ${h.contract}`,
  ].filter(Boolean) as string[]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <BackButton />
        <Link to={`/habits/${h.id}/edit`} className={buttonClass('secondary', '!min-h-11 !px-4 !py-2 text-sm')}>Edit</Link>
      </div>

      <div className="mb-5 flex items-center gap-3.5">
        <span className="puffy flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-4xl" style={{ background: `color-mix(in srgb, ${h.color} 55%, var(--card))` }}>{h.emoji}</span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-black leading-[1.1] tracking-[-0.02em]">{h.name}</h1>
          <p className="mt-1 text-[16px] font-bold text-muted">{scheduleLabel(h)}{identity && ` · I am ${identity}`}{h.archived && ' · paused'}</p>
        </div>
      </div>

      <Card className="mb-4 !p-0">
        <dl className="grid grid-cols-4 py-4 text-center">
          {[
            [h.type === 'break' ? 'Clean' : 'Streak', streakLabel(s).replace(' days', 'd').replace(' day', 'd').replace(' weeks', 'w').replace(' week', 'w')],
            ['Best', String(s.best)],
            ['Freezes', String(s.freezes)],
            ['Points', p.points.toLocaleString()],
          ].map(([k, v], i) => (
            <div key={k} className={i ? 'border-l-2 border-[var(--line)]' : ''}>
              <dd className={`text-[22px] font-black leading-tight tabular-nums ${i === 0 && s.current > 0 ? 'text-[var(--flame)]' : ''}`}>{v}</dd>
              <dt className="text-[14px] font-bold text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      </Card>

      {h.type === 'build' && !isAmount(h) && <ClockAlarm h={h} />}

      <Card className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[18px] font-black">Calendar</h2>
          <span className="text-[14px] font-bold text-muted">30 days: {pct(p.rate30)} · {votes(h, checkins, today)} votes</span>
        </div>
        <p className="mb-3 text-[14px] font-semibold text-muted">Tap any day to change it or fill in a day you missed.</p>
        <Heatmap today={today} weeks={16} cell={cell} onPick={setEditDay} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] font-bold text-muted">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: h.type === 'break' ? `${h.color}aa` : h.color }} />{h.type === 'break' ? 'clean' : 'done'}</span>
          {h.type === 'build' && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: `${h.color}88` }} />2-min</span>}
          {h.type === 'build' && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: 'color-mix(in srgb, var(--color-sky) 45%, transparent)' }} />freeze used</span>}
          {h.type === 'break' && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose align-middle" />slip</span>}
        </div>
      </Card>

      {h.type === 'build' && (
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <h2 className="text-[18px] font-black">Difficulty: level {h.level ?? 1}</h2>
            <InfoTip tip="level_up" />
          </div>
          {(h.level_history ?? []).length > 0 && (
            <ul className="mb-3 space-y-1 text-sm font-semibold">
              {[...h.level_history].reverse().slice(0, 5).map((l, i) => (
                <li key={i} className="flex justify-between"><span>Lv {l.level}: {l.name}{l.target_count > 1 ? ` ×${l.target_count}` : ''}</span><span className="text-muted">{formatDay(l.date, { month: 'short', day: 'numeric' })}</span></li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button variant="lavender" className="flex-1 !py-2.5 text-sm" onClick={() => setLevelDir(1)}>Harder</Button>
            <Button variant="secondary" className="flex-1 !py-2.5 text-sm" onClick={() => setLevelDir(-1)}>Easier</Button>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-1.5"><h2 className="text-[18px] font-black">Badges</h2><InfoTip tip="badges" /></div>
        <div className="grid grid-cols-5 gap-2">
          {MILESTONES.map((m) => {
            const got = p.badges.includes(m)
            return (
              <div key={m} className={`flex aspect-square flex-col items-center justify-center rounded-full text-center ${got ? 'puffy text-on-pastel' : 'clay-in text-muted'}`} style={got ? { background: h.color } : undefined}
                aria-label={`${m}-${s.unit} badge${got ? ', earned' : ''}`}>
                <span className="text-[18px] font-black leading-none tabular-nums">{m}</span>
                <span className="text-[12px] font-black">{s.unit === 'week' ? 'weeks' : 'days'}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {plan.length > 0 && (
        <Card className="mb-4 space-y-1.5 text-[16px] font-semibold leading-snug">
          <h2 className="mb-1 text-[18px] font-black">Your plan</h2>
          {plan.map((x) => <p key={x}>{x}</p>)}
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[18px] font-black">Notes</h2>
          <ul className="space-y-2 text-sm font-semibold">
            {notes.map((n) => (
              <li key={n.id}><button onClick={() => setEditDay(n.date)} className="text-left"><span className="text-muted">{formatDay(n.date, { month: 'short', day: 'numeric' })}:</span> {n.note}</button></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setArchived(h, !h.archived)}>{h.archived ? <>Resume</> : <>Pause</>}</Button>
        <Button variant="danger" className="flex-1"
          onClick={() => confirm.ask('Delete this habit?', 'Its history will be removed too. If you just need a break, use Pause instead.', async () => { await deleteHabit(h); navigate('/habits', { replace: true }) })}>
          Delete
        </Button>
      </div>

      <DayEditor habit={h} date={editDay} checkin={editDay ? map.get(editDay) : undefined} onClose={() => setEditDay(null)} />
      {levelDir && <LevelUpModal habit={h} direction={levelDir} onClose={() => setLevelDir(null)} />}
      {confirm.element}
    </div>
  )
}
