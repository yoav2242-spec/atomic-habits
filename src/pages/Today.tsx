import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Celebration, type CelebrationInfo } from '../components/Celebration'
import { Garden } from '../components/Garden'
import { HabitCard } from '../components/HabitCard'
import { markFlag, QuestList, useQuests } from '../components/Quests'
import { SurpriseBox } from '../components/SurpriseBox'
import { LevelUpModal } from '../components/LevelUpModal'
import { Pebbles } from '../components/Pebbles'
import { Button, buttonClass, Card, InfoTip, Modal, spring, useToast, XPBar } from '../components/ui'
import { tipOfTheDay } from '../lib/dailyTips'
import { db, getMeta } from '../lib/db'
import { computeRecords } from '../lib/records'
import { addDays, diffDays, formatDay, weekday, weekStart } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
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
  const prefs = usePrefs()
  const [offset, setOffset] = useState(0)
  const lastBackup = useLiveQuery(() => getMeta('last_backup'), [], 'loading')
  const toast = useToast()
  const [noteFor, setNoteFor] = useState<Habit | null>(null)
  const [noteText, setNoteText] = useState('')
  const [slipFor, setSlipFor] = useState<Habit | null>(null)
  const [levelUpFor, setLevelUpFor] = useState<Habit | null>(null)
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null)
  const [sheet, setSheetState] = useState<string | null>(null)
  const setSheet = (k: string | null) => {
    if (k === 'tip' && progress) markFlag(progress.today, 'read_tip')
    setSheetState(k)
  }
  const quests = useQuests(progress)
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
      return setCelebration({ kind: 'record', title: `${records.perfectRun.current} perfect days in a row!`, body: 'Every single habit, day after day.' })
    }
    if (records && records.mostInADay.value >= 3 && records.mostInADay.value > before.mostInADay) {
      return setCelebration({ kind: 'record', title: `${records.mostInADay.value} habits in one day!`, body: 'Your most ever in a single day.' })
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
  const title = offset === 0 ? `${greeting()}${prefs.name ? `, ${prefs.name}` : ''}!` : offset === 1 ? 'Yesterday' : formatDay(date, { weekday: 'long' })
  const backupDue = all.length > 0 && lastBackup !== 'loading' && (!lastBackup || diffDays(lastBackup.slice(0, 10), today) >= 14)
  const tip = tipOfTheDay(diffDays('2000-01-01', today))
  const boxReady = build.length > 0 && doneCount === build.length && !progress.rewards.some((r) => r.id === `box_${today}`)
  const extras = [
    { key: 'garden', label: 'Garden', color: 'var(--color-sage)', badge: '' },
    { key: 'quests', label: 'Quests', color: 'var(--color-butter)', badge: quests && quests.done < quests.list.length ? `${quests.done}/${quests.list.length}` : '' },
    { key: 'box', label: 'Daily bonus', color: 'var(--color-sage)', badge: boxReady ? '!' : '' },
    { key: 'tip', label: 'Tip of the day', color: 'var(--color-sky)', badge: '' },
  ] as const
  const focusId = focus && focus.until >= today ? focus.habit_id : null
  // The one line under the count: what to do next, in words.
  const left = build.filter(({ habit }) => !(isDone(habit, checkinOn(habit)) || weekGoalMet(habit)))
  const nextUp = left.find(({ habit }) => habit.cue_time)?.habit ?? left[0]?.habit
  const nextLine = build.length === 0 ? 'Nothing scheduled today. Enjoy the rest.'
    : !nextUp ? (boxReady ? 'Everything done. Your daily bonus is ready.' : 'Everything done. See you tomorrow.')
    : `Next: ${nextUp.name}${nextUp.cue_time ? ` at ${nextUp.cue_time}` : ''}${left.length > 1 ? ` · then ${left.length - 1} more` : ''}`
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
        <div className="mb-2 ml-1 text-[14px] font-black text-level">This week's focus</div>
        {element}
      </div>
    )
  }
  // The focus habit goes first.
  const buildOrdered = focusId ? [...build.filter((b) => b.habit.id === focusId), ...build.filter((b) => b.habit.id !== focusId)] : build

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[16px] font-bold text-muted">{formatDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-0.5 text-[30px] font-black leading-[1.05] tracking-[-0.02em]">{title}</h1>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <motion.button whileTap={{ scaleX: 1.15, scaleY: 0.85 }} transition={spring} onClick={() => setOffset((o) => o + 1)} className="clay-sm flex h-11 w-11 items-center justify-center rounded-full" aria-label="Previous day"><span className="-mt-0.5 text-[28px] font-black leading-none">‹</span></motion.button>
          <motion.button whileTap={{ scaleX: 1.15, scaleY: 0.85 }} transition={spring} onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="clay-sm flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30" aria-label="Next day"><span className="-mt-0.5 text-[28px] font-black leading-none">›</span></motion.button>
        </div>
      </header>

      {all.length === 0 ? (
        <Card className="animate-rise !p-6 text-center">
          <div className="flex justify-center">
            <Pebbles items={[{ id: 'a', color: 'var(--color-sage)', done: true }, { id: 'b', color: 'var(--color-butter)', done: false }, { id: 'c', color: 'var(--color-sky)', done: false }]} />
          </div>
          <h2 className="mb-2 mt-5 text-2xl font-black tracking-[-0.01em]">Plant your first habit</h2>
          <p className="mb-6 font-semibold text-muted">Start tiny, so small it feels too easy. Pick a ready-made habit or make your own.</p>
          <Link to="/habits/new" className={buttonClass('primary', 'w-full')}>Choose a habit</Link>
          <Link to="/scorecard" className="mt-4 block min-h-11 py-2 text-sm font-bold text-muted underline">
            Or first, list what you already do each day
          </Link>
        </Card>
      ) : (
        <>
          {offset === 0 ? (
            <Card className="mb-4 !p-5">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-baseline gap-1.5" aria-label={`${doneCount} of ${build.length} done`}>
                  <motion.span key={doneCount} initial={{ scale: 0.6, y: 6 }} animate={{ scale: 1, y: 0 }} transition={spring} className="inline-block text-[44px] font-black leading-none tracking-[-0.03em] tabular-nums">{doneCount}</motion.span>
                  <span className="text-xl font-extrabold text-muted">of {build.length} done</span>
                </div>
                {progress.todayPoints > 0 && <motion.span key={progress.todayPoints} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="pb-1 text-[16px] font-black text-sage-deep tabular-nums">
                  +{progress.todayPoints} today
                </motion.span>}
              </div>
              <p className="mt-1.5 text-[16px] font-semibold leading-snug text-muted">{nextLine}</p>
              <div className="-ml-1.5 mt-3">
                <Pebbles items={buildOrdered.map(({ habit }) => ({ id: habit.id, color: habit.color, done: isDone(habit, checkinOn(habit)) || weekGoalMet(habit), label: habit.name }))}
                  onPick={(id) => document.getElementById(`habit-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
              </div>
              <div className="mt-3 flex min-h-11 items-center gap-3">
                <Link to="/stats" className="flex min-h-11 flex-1 items-center gap-3">
                  <span className="shrink-0 text-[14px] font-black text-level">Level {progress.level.level}</span>
                  <span className="flex-1"><XPBar into={progress.level.into} need={progress.level.need} /></span>
                  <span className="shrink-0 text-[14px] font-bold text-muted tabular-nums">{progress.level.need - progress.level.into} to go</span>
                </Link>
                <InfoTip tip="points" />
              </div>
            </Card>
          ) : (
            <div className="tray mb-5 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold">
              Filling in {offset === 1 ? 'yesterday' : formatDay(date)}. Tap to fix anything you forgot.
            </div>
          )}

          {offset === 0 && (
            <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {extras.map((x) => {
                const hot = x.key === 'box' && boxReady
                return (
                  <motion.button key={x.key} whileTap={{ scaleX: 1.08, scaleY: 0.9 }} transition={spring} onClick={() => setSheet(x.key)}
                    style={hot ? { background: x.color } : undefined}
                    className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full px-5 py-2 text-[17px] font-extrabold ${hot ? 'puffy text-on-pastel' : 'clay-sm'}`}>
                                        {x.label}
                    {x.badge && x.badge !== '!' && <span className="tray rounded-full px-1.5 text-[14px] font-black text-muted tabular-nums">{x.badge}</span>}
                  </motion.button>
                )
              })}
            </div>
          )}

          {offset === 0 && (reviewDue || recapDue) && (
            <div className="mb-5 space-y-2.5">
              {reviewDue && (
                <Link to="/review" className="bouncy flex min-h-14 items-center gap-3 rounded-[22px] bg-[color-mix(in_srgb,var(--color-sky)_50%,var(--card))] px-4 py-3">
                                    <span className="flex-1"><span className="block font-black">Your weekly review is ready</span><span className="text-[14px] font-bold opacity-80">2 minutes · pick next week's focus · +25</span></span>
                  <span className="text-[26px] font-black leading-none">›</span>
                </Link>
              )}
              {recapDue && (
                <Link to={`/recap/${lastMonth}`} className="bouncy flex min-h-14 items-center gap-3 rounded-[22px] bg-[color-mix(in_srgb,var(--color-peach)_50%,var(--card))] px-4 py-3">
                                    <span className="flex-1"><span className="block font-black">Your {formatDay(`${lastMonth}-01`, { month: 'long' })} recap is here</span><span className="text-[14px] font-bold opacity-80">See everything you did last month</span></span>
                  <span className="text-[26px] font-black leading-none">›</span>
                </Link>
              )}
            </div>
          )}

          <div className="space-y-4">
            {buildOrdered.map(({ habit, depth }) => card(habit, depth))}
            {build.length === 0 && <p className="py-4 text-center font-semibold text-muted">Nothing scheduled for this day. Enjoy the rest.</p>}
          </div>

          {breaking.length > 0 && (
            <>
              <h2 className="label mb-3 ml-1 mt-8">Breaking free</h2>
              <div className="space-y-4">{breaking.map((h) => card(h))}</div>
            </>
          )}

          <Link to="/habits/new" className="bouncy mt-6 flex min-h-14 items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-muted/30 font-extrabold text-muted">
            + Add a habit
          </Link>

          {backupDue && (
            <Link to="/settings" className="tray mt-4 flex min-h-12 items-center gap-2.5 rounded-2xl p-3.5 text-sm font-bold">
              Your habits live only on this phone. Tap to save a backup copy.
            </Link>
          )}
        </>
      )}

      <Modal open={sheet === 'garden'} onClose={() => setSheet(null)} title="Your garden">
        <p className="mb-4 text-sm font-semibold text-muted">Each habit is a plant. It grows every time you practice, and droops (but never dies) when you miss.</p>
        <Garden habits={progress.habits.filter((p) => !p.habit.archived)} today={today} />
      </Modal>
      <Modal open={sheet === 'quests'} onClose={() => setSheet(null)} title="Daily quests">
        <p className="mb-4 text-[16px] font-semibold text-muted">Extra points for small challenges. New ones every day.</p>
        {quests && <QuestList status={quests} />}
      </Modal>
      <Modal open={sheet === 'box'} onClose={() => setSheet(null)} title="Daily bonus">
        <SurpriseBox progress={progress} ready={build.length > 0 && doneCount === build.length} />
      </Modal>
      <Modal open={sheet === 'tip'} onClose={() => setSheet(null)} title="Tip of the day">
        <p className="mb-6 text-lg font-bold leading-snug">{tip.tip}</p>
        <Link to="/tips" className={buttonClass('secondary', 'w-full')}>See all tips</Link>
      </Modal>

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`Note · ${noteFor?.name ?? ''}`}>
        <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="How did it go? What helped or got in the way?" autoFocus />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setNoteFor(null)}>Cancel</Button>
          <Button className="flex-1" onClick={async () => { await setNote(noteFor!, date, noteText.trim()); setNoteFor(null) }}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!slipFor} onClose={() => setSlipFor(null)} title="That's okay">
        <p className="mb-3 font-semibold text-muted">
          One slip doesn't undo your progress. What matters is not slipping twice in a row. What set it off this time?
        </p>
        <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. I was bored after dinner" />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setSlipFor(null)}>Cancel</Button>
          <Button className="flex-1" onClick={async () => { await logSlip(slipFor!, date, noteText.trim()); setSlipFor(null); toast('Logged. Tomorrow is a fresh start.') }}>
            Log it
          </Button>
        </div>
      </Modal>

      <LevelUpModal habit={levelUpFor} direction={1} suggested onClose={() => setLevelUpFor(null)} />
      <Celebration info={celebration} onClose={() => setCelebration(null)} />
    </div>
  )
}
