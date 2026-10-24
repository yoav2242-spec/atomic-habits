import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Celebration, type CelebrationInfo } from '../components/Celebration'
import { Garden } from '../components/Garden'
import { HabitCard } from '../components/HabitCard'
import { markFlag, Quests } from '../components/Quests'
import { SurpriseBox } from '../components/SurpriseBox'
import { LevelUpModal } from '../components/LevelUpModal'
import { Button, buttonClass, Card, InfoTip, Modal, ProgressRing, useToast, XPBar } from '../components/ui'
import { tipOfTheDay } from '../lib/dailyTips'
import { db, getMeta } from '../lib/db'
import { computeRecords } from '../lib/records'
import { addDays, diffDays, formatDay, weekday, weekStart } from '../lib/dates'
import { useProgress } from '../lib/progress'
import { logSlip, setNote, undoSlip } from '../lib/repo'
import { isDone, isScheduled } from '../lib/streaks'
import type { Habit } from '../lib/types'
import { clockNow } from '../lib/workspace'

/** Orders habits so each one stacked "after" another sits right below it. */
function orderByStacks(list: Habit[]): { habit: Habit; depth: number }[] {
  const ids = new Set(list.map((h) => h.id))
  const byTime = (a: Habit, b: Habit) => (a.cue_time ?? '99').localeCompare(b.cue_time ?? '99') || a.sort_order - b.sort_order
  const out: { habit: Habit; depth: number }[] = []
  const seen = new Set<string>()
  const visit = (h: Habit, depth: number) => {
    if (seen.has(h.id)) return
    seen.add(h.id)
    out.push({ habit: h, depth })
    list.filter((c) => c.stack_after_habit_id === h.id).sort(byTime).forEach((c) => visit(c, depth + 1))
  }
  list.filter((h) => !h.stack_after_habit_id || !ids.has(h.stack_after_habit_id)).sort(byTime).forEach((h) => visit(h, 0))
  list.forEach((h) => visit(h, 0)) // anything left in a loop of stacks
  return out
}

function greeting() {
  const h = clockNow().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const progress = useProgress()
  const [offset, setOffset] = useState(0)
  const lastBackup = useLiveQuery(() => getMeta('last_backup'), [], 'loading')
  const toast = useToast()
  const [noteFor, setNoteFor] = useState<Habit | null>(null)
  const [noteText, setNoteText] = useState('')
  const [slipFor, setSlipFor] = useState<Habit | null>(null)
  const [levelUpFor, setLevelUpFor] = useState<Habit | null>(null)
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null)
  // After a tap, compare progress before/after to spot a new badge, level, or a finished day.
  const armed = useRef<{ level: number; badges: Map<string, number>; done: number; perfectBest: number; mostInADay: number } | null>(null)
  const records = useMemo(() => (progress ? computeRecords(progress) : null), [progress])
  const focus = useLiveQuery(async () => { const f = await getMeta('focus'); return f ? (JSON.parse(f) as { habit_id: string; until: string }) : null })
  const recapSeen = useLiveQuery(async () => (await db.meta.where('key').startsWith('recap_seen:').toArray()).map((m) => m.key.slice(11)), [], [] as string[])

  const today = progress?.today ?? ''
  const date = today ? addDays(today, -offset) : ''
  const all = progress?.habits.map((p) => p.habit) ?? []
  const visible = all.filter((h) => !h.archived && (h.type === 'break' || isScheduled(h, date)))
  const checkinOn = (h: Habit) => progress?.checkinsByHabit.get(h.id)?.find((c) => c.date === date)
  const build = orderByStacks(visible.filter((h) => h.type === 'build'))
  const breaking = visible.filter((h) => h.type === 'break')
  // A weekly habit that already hit its goal this week counts as done.
  const weekGoalMet = (h: Habit) => h.schedule.kind === 'weekly' && offset === 0 && (progress?.byId.get(h.id)?.stats.weekDone ?? 0) >= h.schedule.times
  const doneCount = build.filter(({ habit }) => isDone(habit, checkinOn(habit)) || weekGoalMet(habit)).length

  useEffect(() => {
    const before = armed.current
    if (!progress || !before) return
    armed.current = null
    if (progress.level.level > before.level) return setCelebration({ kind: 'level', level: progress.level.level })
    for (const p of progress.habits) {
      if (p.badges.length > (before.badges.get(p.habit.id) ?? 0)) {
        return setCelebration({ kind: 'badge', days: p.badges.at(-1)!, unit: p.stats.unit, habitName: p.habit.name, emoji: p.habit.emoji })
      }
    }
    if (records && records.perfectRun.current >= 2 && records.perfectRun.current > before.perfectBest) {
      return setCelebration({ kind: 'record', title: `${records.perfectRun.current} perfect days in a row!`, body: 'A new personal record. Every single habit, day after day.' })
    }
    if (records && records.mostInADay.value >= 3 && records.mostInADay.value > before.mostInADay) {
      return setCelebration({ kind: 'record', title: `${records.mostInADay.value} habits in one day!`, body: 'Your most ever in a single day. A new personal record!' })
    }
    if (offset === 0 && build.length > 0 && doneCount === build.length && before.done < build.length) {
      setCelebration({ kind: 'day', points: progress.todayPoints, streakHabits: progress.habits.filter((p) => p.stats.current > 0 && p.habit.type === 'build').length })
    }
  }, [progress]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!progress) return null

  const arm = () => {
    if (armed.current) return // keep the earliest snapshot during quick taps
    armed.current = {
      level: progress.level.level,
      badges: new Map(progress.habits.map((p) => [p.habit.id, p.badges.length])),
      done: doneCount,
      perfectBest: records?.perfectRun.best ?? 0,
      mostInADay: records?.mostInADay.value ?? 0,
    }
  }

  const identityName = (h: Habit) => progress.identities.find((i) => i.id === h.identity_id)?.name
  const title = offset === 0 ? `${greeting()}!` : offset === 1 ? 'Yesterday' : formatDay(date, { weekday: 'long' })
  const backupDue = all.length > 0 && lastBackup !== 'loading' && (!lastBackup || diffDays(lastBackup.slice(0, 10), today) >= 14)
  const share = build.length ? doneCount / build.length : 0
  const tip = tipOfTheDay(diffDays('2000-01-01', today))
  const focusId = focus && focus.until >= today ? focus.habit_id : null
  const reviewDue = weekday(today) === 0 && !progress.rewards.some((r) => r.id === `review_${weekStart(today)}`)
  const lastMonth = addDays(`${today.slice(0, 8)}01`, -1).slice(0, 7)
  const recapDue = Number(today.slice(8)) <= 7 && !recapSeen.includes(lastMonth) && progress.habits.some((p) => p.checkins.some((c) => c.date.startsWith(lastMonth)))

  const card = (habit: Habit, depth = 0) => {
    const p = progress.byId.get(habit.id)!
    const anchor = habit.stack_after_habit_id ? progress.byId.get(habit.stack_after_habit_id)?.habit.name.toLowerCase() : habit.stack_after_text
    const element = (
      <HabitCard
        key={habit.id}
        habit={habit}
        date={date}
        today={today}
        checkin={checkinOn(habit)}
        stats={p.stats}
        identityName={identityName(habit)}
        stackLabel={depth > 0 ? undefined : anchor || undefined}
        depth={depth}
        levelUp={p.levelUp}
        onNote={() => { setNoteFor(habit); setNoteText(checkinOn(habit)?.note ?? '') }}
        onSlip={() => { setSlipFor(habit); setNoteText('') }}
        onUndoSlip={() => undoSlip(habit, date)}
        onLevelUp={() => setLevelUpFor(habit)}
        onBeforeChange={arm}
        onDone={(message, undo) => toast(message, { label: 'Undo', onClick: undo })}
      />
    )
    if (habit.id !== focusId) return element
    return (
      <div key={habit.id}>
        <div className="mb-1.5 ml-2 text-xs font-black uppercase tracking-wider text-lavender">🎯 This week's focus</div>
        {element}
      </div>
    )
  }
  // The focus habit goes first.
  const buildOrdered = focusId ? [...build.filter((b) => b.habit.id === focusId), ...build.filter((b) => b.habit.id !== focusId)] : build

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-black leading-tight tracking-tight">{title}</h1>
          <p className="text-sm font-bold text-muted">{formatDay(date)}</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setOffset((o) => o + 1)} className="bouncy h-10 w-10 rounded-full bg-card text-lg font-black shadow-sm" aria-label="Previous day">‹</button>
          <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="bouncy h-10 w-10 rounded-full bg-card text-lg font-black shadow-sm disabled:opacity-30" aria-label="Next day">›</button>
        </div>
      </header>

      {all.length === 0 ? (
        <Card className="animate-rise text-center">
          <div className="mb-2 text-6xl">🌱</div>
          <h2 className="mb-2 text-2xl font-black">Let's plant your first habit</h2>
          <p className="mb-5 font-semibold text-muted">Start tiny, so small it feels too easy. Pick a ready-made habit or make your own.</p>
          <Link to="/habits/new" className={buttonClass('primary', 'w-full')}>Choose a habit</Link>
          <Link to="/scorecard" className="mt-4 block text-sm font-bold text-sage-deep underline dark:text-sage">
            Or first, list what you already do each day
          </Link>
        </Card>
      ) : (
        <>
          {offset === 0 ? (
            <Card className="mb-5 flex items-center gap-4 !p-5">
              <ProgressRing value={share} size={108} stroke={12}>
                <span className="text-2xl font-black">{doneCount}/{build.length}</span>
                <span className="text-[11px] font-extrabold text-muted">{share === 1 ? 'all done!' : 'done'}</span>
              </ProgressRing>
              <Link to="/stats" className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-lavender px-2.5 py-0.5 text-xs font-black text-white">Level {progress.level.level}</span>
                  <InfoTip tip="points" />
                </div>
                <div className="mt-2"><XPBar into={progress.level.into} need={progress.level.need} /></div>
                <div className="mt-1 text-xs font-bold text-muted">{progress.level.need - progress.level.into} points to level {progress.level.level + 1}</div>
                <div className="mt-2 text-lg font-black text-sage-deep dark:text-sage">+{progress.todayPoints} today</div>
              </Link>
            </Card>
          ) : (
            <p className="mb-4 rounded-2xl bg-soft px-4 py-3 text-sm font-bold">
              ✏️ Filling in {offset === 1 ? 'yesterday' : formatDay(date)}. Tap to fix anything you forgot.
            </p>
          )}

          {offset === 0 && reviewDue && (
            <Link to="/review" className="bouncy mb-4 flex items-center gap-3 rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, var(--color-sky), var(--color-lavender))', boxShadow: '0 4px 0 0 var(--color-lavender-deep)' }}>
              <span className="text-3xl">📅</span>
              <span className="flex-1"><span className="block font-black">Your weekly review is ready</span><span className="text-xs font-bold text-white/85">2 minutes · pick next week's focus · +25 points</span></span>
              <span className="text-2xl">›</span>
            </Link>
          )}
          {offset === 0 && recapDue && (
            <Link to={`/recap/${lastMonth}`} className="bouncy mb-4 flex items-center gap-3 rounded-3xl p-4 text-white" style={{ background: 'linear-gradient(135deg, var(--color-peach), var(--color-rose))', boxShadow: '0 4px 0 0 #b86c82' }}>
              <span className="text-3xl">🗓️</span>
              <span className="flex-1"><span className="block font-black">Your {formatDay(`${lastMonth}-01`, { month: 'long' })} recap is here!</span><span className="text-xs font-bold text-white/85">See everything you did last month</span></span>
              <span className="text-2xl">›</span>
            </Link>
          )}

          {offset === 0 && <Garden habits={progress.habits.filter((p) => !p.habit.archived)} today={today} />}

          <div className="space-y-3">
            {buildOrdered.map(({ habit, depth }) => card(habit, depth))}
            {build.length === 0 && <p className="font-semibold text-muted">Nothing scheduled for this day. Enjoy the rest! 🌤️</p>}
          </div>

          {breaking.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 text-sm font-black uppercase tracking-wider text-muted">Breaking free</h2>
              <div className="space-y-3">{breaking.map((h) => card(h))}</div>
            </>
          )}

          {offset === 0 && (
            <div className="mt-6">
              <SurpriseBox progress={progress} ready={build.length > 0 && doneCount === build.length} />
              <Quests progress={progress} />
            </div>
          )}

          {offset === 0 && (
            <Link to="/tips" onClick={() => markFlag(today, 'read_tip')} className="bouncy block rounded-3xl p-4" style={{ background: 'color-mix(in srgb, var(--color-butter) 20%, var(--card))' }}>
              <div className="mb-1 flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted">
                <span>💡 Tip of the day</span><span>All tips ›</span>
              </div>
              <p className="font-bold leading-snug">{tip.icon} {tip.tip}</p>
            </Link>
          )}

          <Link to="/habits/new" className="bouncy mt-5 flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line py-4 font-extrabold text-muted">
            + Add a habit
          </Link>

          {backupDue && (
            <Link to="/settings" className="mt-4 block rounded-2xl bg-butter/15 p-3 text-sm font-bold">
              💾 Your habits live only on this phone. Tap to save a backup copy.
            </Link>
          )}
        </>
      )}

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`📝 ${noteFor?.name ?? ''}`}>
        <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="How did it go? What helped or got in the way?" autoFocus />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setNoteFor(null)}>Cancel</Button>
          <Button className="flex-1" onClick={async () => { await setNote(noteFor!, date, noteText.trim()); setNoteFor(null) }}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!slipFor} onClose={() => setSlipFor(null)} title="That's okay 💛">
        <p className="mb-3 font-semibold text-muted">
          One slip doesn't undo your progress. What matters is not slipping twice in a row. What set it off this time?
        </p>
        <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. I was bored after dinner" />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setSlipFor(null)}>Cancel</Button>
          <Button className="flex-1" onClick={async () => { await logSlip(slipFor!, date, noteText.trim()); setSlipFor(null); toast('Logged. Tomorrow is a fresh start 🌱') }}>
            Log it
          </Button>
        </div>
      </Modal>

      <LevelUpModal habit={levelUpFor} direction={1} suggested onClose={() => setLevelUpFor(null)} />
      <Celebration info={celebration} onClose={() => setCelebration(null)} />
    </div>
  )
}
