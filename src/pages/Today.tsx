import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HabitCard } from '../components/HabitCard'
import { Button, buttonClass, Card, Modal, useToast } from '../components/ui'
import { getMeta } from '../lib/db'
import { addDays, diffDays, formatDay } from '../lib/dates'
import { useCheckinsByHabit, useHabits, useIdentities, useToday } from '../lib/hooks'
import { logSlip, setNote, undoSlip } from '../lib/repo'
import { habitStats, isDone, isScheduled } from '../lib/streaks'
import type { Habit } from '../lib/types'

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

export default function Today() {
  const today = useToday()
  const [offset, setOffset] = useState(0)
  const date = addDays(today, -offset)
  const habits = useHabits()
  const checkins = useCheckinsByHabit()
  const identities = useIdentities()
  const lastBackup = useLiveQuery(() => getMeta('last_backup'), [], 'loading')
  const toast = useToast()
  const [noteFor, setNoteFor] = useState<Habit | null>(null)
  const [noteText, setNoteText] = useState('')
  const [slipFor, setSlipFor] = useState<Habit | null>(null)

  const visible = useMemo(
    () => (habits ?? []).filter((h) => !h.archived && (h.type === 'break' || isScheduled(h, date))),
    [habits, date],
  )

  if (!habits || !checkins || !identities) return null

  const allHabits = new Map(habits.map((h) => [h.id, h]))
  const identityName = (h: Habit) => identities.find((i) => i.id === h.identity_id)?.name
  const checkinOn = (h: Habit) => checkins.get(h.id)?.find((c) => c.date === date)
  const stats = (h: Habit) => habitStats(h, checkins.get(h.id) ?? [], today)

  const build = orderByStacks(visible.filter((h) => h.type === 'build'))
  const breaking = visible.filter((h) => h.type === 'break')
  // A weekly habit that already hit its goal this week counts as done.
  const weekGoalMet = (h: Habit) => h.schedule.kind === 'weekly' && offset === 0 && stats(h).weekDone >= h.schedule.times
  const doneCount = build.filter(({ habit }) => isDone(habit, checkinOn(habit)) || weekGoalMet(habit)).length

  const title = offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : formatDay(date, { weekday: 'long' })
  const backupDue = habits.length > 0 && lastBackup !== 'loading' && (!lastBackup || diffDays(lastBackup.slice(0, 10), today) >= 14)

  const openNote = (h: Habit) => {
    setNoteFor(h)
    setNoteText(checkinOn(h)?.note ?? '')
  }

  const card = (habit: Habit, depth = 0) => {
    const anchor = habit.stack_after_habit_id ? allHabits.get(habit.stack_after_habit_id)?.name.toLowerCase() : habit.stack_after_text
    return (
      <HabitCard
        key={habit.id}
        habit={habit}
        date={date}
        today={today}
        checkin={checkinOn(habit)}
        stats={stats(habit)}
        identityName={identityName(habit)}
        stackLabel={depth > 0 ? undefined : anchor || undefined}
        depth={depth}
        onNote={() => openNote(habit)}
        onSlip={() => { setSlipFor(habit); setNoteText('') }}
        onUndoSlip={() => undoSlip(habit, date)}
        onCelebrate={toast}
      />
    )
  }

  return (
    <div>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{formatDay(date)}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOffset((o) => o + 1)} className="h-10 w-10 rounded-full bg-stone-200 text-lg dark:bg-stone-800" aria-label="Previous day">‹</button>
          <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="h-10 w-10 rounded-full bg-stone-200 text-lg disabled:opacity-30 dark:bg-stone-800" aria-label="Next day">›</button>
        </div>
      </header>

      {habits.length === 0 ? (
        <Card className="text-center">
          <div className="mb-2 text-5xl">⚛️</div>
          <h2 className="mb-2 text-xl font-semibold">Welcome to Atomic</h2>
          <p className="mb-5 text-stone-600 dark:text-stone-300">
            Big changes come from tiny habits done every day. Start with one small habit, so small it feels too easy.
          </p>
          <Link to="/habits/new" className={buttonClass('primary', 'w-full')}>Create your first habit</Link>
          <Link to="/scorecard" className="mt-3 block text-sm text-amber-700 underline dark:text-amber-400">
            Or first, write down your current habits (Scorecard)
          </Link>
        </Card>
      ) : (
        <>
          {build.length > 0 && (
            <div className="mb-5">
              <div className="mb-1.5 flex justify-between text-sm font-medium">
                <span>{doneCount} of {build.length} done</span>
                {doneCount === build.length && <span className="text-amber-600 dark:text-amber-400">All done 🎉</span>}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${(doneCount / build.length) * 100}%` }} />
              </div>
            </div>
          )}

          {offset > 0 && (
            <p className="mb-4 rounded-xl bg-stone-200/70 px-3 py-2 text-sm dark:bg-stone-800/70">
              You're looking at {title.toLowerCase() === 'yesterday' ? 'yesterday' : formatDay(date)}. You can fill in a day you forgot.
            </p>
          )}

          <div className="space-y-3">
            {build.map(({ habit, depth }) => card(habit, depth))}
            {build.length === 0 && <p className="text-stone-500">Nothing scheduled for this day. Enjoy the rest!</p>}
          </div>

          {breaking.length > 0 && (
            <>
              <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-stone-500">Breaking</h2>
              <div className="space-y-3">{breaking.map((h) => card(h))}</div>
            </>
          )}

          {backupDue && (
            <Link to="/settings" className="mt-6 block rounded-xl border border-dashed border-stone-300 p-3 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">
              💾 Your habits are saved only on this phone. Tap here to save a backup copy.
            </Link>
          )}
        </>
      )}

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={`Note · ${noteFor?.name ?? ''}`}>
        <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="How did it go? What helped or got in the way?" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Button>
          <Button onClick={async () => { await setNote(noteFor!, date, noteText.trim()); setNoteFor(null) }}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!slipFor} onClose={() => setSlipFor(null)} title="That's okay">
        <p className="mb-3 text-stone-600 dark:text-stone-300">
          One slip doesn't undo your progress. What matters is not slipping twice in a row. What set it off this time?
        </p>
        <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. I was bored after dinner" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setSlipFor(null)}>Cancel</Button>
          <Button onClick={async () => { await logSlip(slipFor!, date, noteText.trim()); setSlipFor(null); toast('Logged. Tomorrow is a fresh start.') }}>
            Log slip
          </Button>
        </div>
      </Modal>
    </div>
  )
}
