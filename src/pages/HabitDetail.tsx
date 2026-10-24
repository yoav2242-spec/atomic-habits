import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DayEditor } from '../components/DayEditor'
import { streakLabel } from '../components/HabitCard'
import { Heatmap } from '../components/Heatmap'
import { LevelUpModal } from '../components/LevelUpModal'
import { Button, buttonClass, Card, InfoTip, useConfirm } from '../components/ui'
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
    if (s.frozen.has(d)) return { color: 'color-mix(in srgb, var(--color-sky) 45%, transparent)', title: 'saved by a freeze', icon: '🧊' }
    if (c && c.count > 0) return { color: `${h.color}44`, title: `${c.count}/${h.target_count}` }
    return null
  }

  const plan = [
    h.type === 'build' && (h.cue_time || h.location) && `🕒 I will ${h.name.toLowerCase()}${h.cue_time ? ` at ${h.cue_time}` : ''}${h.location ? ` in ${h.location}` : ''}.`,
    h.type === 'build' && anchor && `🔗 After I ${anchor}, I will ${h.name.toLowerCase()}.`,
    h.cue_trigger && `⚡ Trigger: ${h.cue_trigger}`,
    h.hide_plan && `🙈 Hide it: ${h.hide_plan}`,
    h.why && (h.type === 'break' ? `💸 What it costs me: ${h.why}` : `💭 Why: ${h.why}`),
    h.temptation_bundle && `🎁 Treat: ${h.temptation_bundle}`,
    h.two_min_version && `⏱️ 2-minute version: ${h.two_min_version}`,
    h.friction_plan && `🧱 Make it hard: ${h.friction_plan}`,
    h.contract && `🤝 Contract: ${h.contract}`,
  ].filter(Boolean) as string[]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm font-bold text-muted">‹ Back</button>
        <Link to={`/habits/${h.id}/edit`} className={buttonClass('secondary', '!px-4 !py-2 text-sm')}>✏️ Edit habit</Link>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl text-4xl" style={{ background: `${h.color}33` }}>{h.emoji}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-black leading-tight tracking-tight">{h.name}</h1>
          <p className="text-sm font-bold text-muted">{scheduleLabel(h)}{identity && ` · I am ${identity}`}{h.archived && ' · paused'}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        {[
          [h.type === 'break' ? '🌿' : '🔥', h.type === 'break' ? 'Clean' : 'Streak', streakLabel(s).replace(' days', 'd').replace(' day', 'd').replace(' weeks', 'w').replace(' week', 'w')],
          ['🏆', 'Best', String(s.best)],
          ['🧊', 'Freezes', String(s.freezes)],
          ['⭐', 'Points', String(p.points)],
        ].map(([icon, k, v]) => (
          <Card key={k} className="!p-2.5 text-center">
            <div className="text-lg">{icon}</div>
            <div className="text-lg font-black">{v}</div>
            <div className="text-[11px] font-bold text-muted">{k}</div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-black">Calendar</span>
          <span className="text-xs font-bold text-muted">30 days: {pct(p.rate30)} · {votes(h, checkins, today)} votes</span>
        </div>
        <p className="mb-3 text-xs font-semibold text-muted">Tap any day to change it or fill in a day you missed.</p>
        <Heatmap today={today} weeks={16} cell={cell} onPick={setEditDay} />
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-muted">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: h.type === 'break' ? `${h.color}aa` : h.color }} />{h.type === 'break' ? 'clean' : 'done'}</span>
          {h.type === 'build' && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: `${h.color}88` }} />2-min</span>}
          {h.type === 'build' && <span>🧊 freeze used</span>}
          {h.type === 'break' && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose align-middle" />slip</span>}
        </div>
      </Card>

      {h.type === 'build' && (
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="font-black">Difficulty: level {h.level ?? 1}</span>
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
            <Button variant="lavender" className="flex-1 !py-2.5 text-sm" onClick={() => setLevelDir(1)}>📈 Make it harder</Button>
            <Button variant="secondary" className="flex-1 !py-2.5 text-sm" onClick={() => setLevelDir(-1)}>🌱 Make it easier</Button>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-1.5"><span className="font-black">Badges</span><InfoTip tip="badges" /></div>
        <div className="grid grid-cols-5 gap-2">
          {MILESTONES.map((m) => {
            const got = p.badges.includes(m)
            return (
              <div key={m} className={`flex aspect-square flex-col items-center justify-center rounded-2xl text-center ${got ? '' : 'bg-soft opacity-50'}`} style={got ? { background: `${h.color}33` } : undefined}>
                <span className={`text-xl ${got ? '' : 'grayscale'}`}>🏅</span>
                <span className="text-[10px] font-black">{m}{s.unit === 'week' ? 'w' : 'd'}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {plan.length > 0 && (
        <Card className="mb-4 space-y-1.5 text-sm font-semibold">
          <div className="mb-1 font-black">Your plan</div>
          {plan.map((x) => <p key={x}>{x}</p>)}
        </Card>
      )}

      {notes.length > 0 && (
        <Card className="mb-4">
          <div className="mb-2 font-black">Notes</div>
          <ul className="space-y-2 text-sm font-semibold">
            {notes.map((n) => (
              <li key={n.id}><button onClick={() => setEditDay(n.date)} className="text-left"><span className="text-muted">{formatDay(n.date, { month: 'short', day: 'numeric' })}:</span> {n.note}</button></li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setArchived(h, !h.archived)}>{h.archived ? '▶️ Resume' : '⏸️ Pause'}</Button>
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
