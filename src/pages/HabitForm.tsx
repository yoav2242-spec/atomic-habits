import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Field, Segmented, Stepper } from '../components/ui'
import { db } from '../lib/db'
import { WEEKDAY_SHORT } from '../lib/dates'
import { useHabits, useIdentities } from '../lib/hooks'
import { createIdentity, HABIT_COLORS, newHabit, saveHabit, saveIdentity } from '../lib/repo'
import type { Habit, Schedule } from '../lib/types'

const EMOJIS = ['✨', '📖', '🏃', '💪', '🧘', '💧', '🥗', '😴', '✍️', '🎸', '🧠', '🌱', '🦷', '🚶', '🧹', '💊', '☀️', '🙏', '📵', '🚭', '🍬', '🍺', '📺', '💸']
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

const STEPS = {
  build: [
    { title: 'The habit', law: '' },
    { title: 'Who do you want to become?', law: 'Identity' },
    { title: 'Make it obvious', law: 'Law 1' },
    { title: 'Make it attractive', law: 'Law 2' },
    { title: 'Make it easy', law: 'Law 3' },
    { title: 'Make it satisfying', law: 'Law 4' },
  ],
  break: [
    { title: 'The habit to break', law: '' },
    { title: 'Who do you want to become?', law: 'Identity' },
    { title: 'Make it invisible', law: 'Law 1, flipped' },
    { title: 'Make it unattractive', law: 'Law 2, flipped' },
    { title: 'Make it difficult', law: 'Law 3, flipped' },
    { title: 'Make it unsatisfying', law: 'Law 4, flipped' },
  ],
}

function Tip({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{children}</p>
}

function Sentence({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-stone-200 p-3 text-[15px] font-medium dark:border-stone-800">“{children}”</p>
}

export default function HabitForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const habits = useHabits()
  const identities = useIdentities()
  const existing = useLiveQuery(() => (id ? db.habits.get(id) : undefined), [id])
  const [draft, setDraft] = useState<Habit | null>(id ? null : newHabit(Date.now()))
  const [step, setStep] = useState(0)
  const [newIdentity, setNewIdentity] = useState('')

  useEffect(() => {
    if (id && existing && !draft) setDraft(existing)
  }, [id, existing, draft])

  if (!draft || !habits || !identities) return null
  const h = draft
  const set = (patch: Partial<Habit>) => setDraft({ ...h, ...patch })
  const steps = STEPS[h.type]
  const isLast = step === steps.length - 1
  const name = h.name.trim() || 'my habit'
  const others = habits.filter((o) => o.id !== h.id && o.type === 'build' && !o.archived)
  const anchor = h.stack_after_habit_id ? habits.find((o) => o.id === h.stack_after_habit_id)?.name.toLowerCase() : h.stack_after_text.trim()

  const save = async () => {
    await saveHabit({ ...h, name: h.name.trim() })
    navigate(id ? `/habits/${h.id}` : '/', { replace: true })
  }

  const addIdentity = async () => {
    const text = newIdentity.trim()
    if (!text) return
    const identity = createIdentity(text)
    await saveIdentity(identity)
    set({ identity_id: identity.id })
    setNewIdentity('')
  }

  const setSchedule = (kind: Schedule['kind']) =>
    set({ schedule: kind === 'daily' ? { kind } : kind === 'weekdays' ? { kind, days: [1, 2, 3, 4, 5] } : { kind, times: 3 } })

  const pages: ReactNode[] =
    h.type === 'build'
      ? [
          // 0 — basics
          <>
            <Segmented value={h.type} onChange={(type) => set({ type })} options={[{ value: 'build', label: 'Build a good habit' }, { value: 'break', label: 'Break a bad habit' }]} />
            <Field label="What's the habit?" hint="Be specific: “Read 10 pages”, not “Read more”.">
              <input value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Read 10 pages" autoFocus />
            </Field>
            <EmojiAndColor h={h} set={set} />
          </>,
          // 1 — identity
          <IdentityStep h={h} set={set} identities={identities} newIdentity={newIdentity} setNewIdentity={setNewIdentity} addIdentity={addIdentity}>
            <Tip>The goal isn't to read a book, it's to <b>become a reader</b>. Each time you do this habit, the app counts it as a vote for that person.</Tip>
          </IdentityStep>,
          // 2 — obvious
          <>
            <Tip>Decide exactly when and where. People who make a specific plan are far more likely to follow through.</Tip>
            <Field label="Which days?">
              <Segmented value={h.schedule.kind} onChange={setSchedule} options={[{ value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Some days' }, { value: 'weekly', label: 'X a week' }]} />
            </Field>
            {h.schedule.kind === 'weekdays' && (
              <div className="flex gap-1.5">
                {MON_FIRST.map((d) => {
                  const days = (h.schedule as { days: number[] }).days
                  const on = days.includes(d)
                  return (
                    <button key={d} type="button" onClick={() => set({ schedule: { kind: 'weekdays', days: on ? days.filter((x) => x !== d) : [...days, d] } })}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium ${on ? 'bg-amber-500 text-stone-950' : 'bg-stone-200 dark:bg-stone-800'}`}>
                      {WEEKDAY_SHORT[d].slice(0, 2)}
                    </button>
                  )
                })}
              </div>
            )}
            {h.schedule.kind === 'weekly' && (
              <Field label="How many times a week?">
                <Stepper value={h.schedule.times} min={1} max={7} onChange={(times) => set({ schedule: { kind: 'weekly', times } })} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="What time?"><input type="time" value={h.cue_time ?? ''} onChange={(e) => set({ cue_time: e.target.value || null })} /></Field>
              <Field label="Where?"><input value={h.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. bedroom" /></Field>
            </div>
            <Field label="Habit stacking: right after I…" hint="Link it to something you already do every day.">
              <input value={h.stack_after_text} disabled={!!h.stack_after_habit_id} onChange={(e) => set({ stack_after_text: e.target.value })} placeholder="e.g. pour my morning coffee" />
            </Field>
            {others.length > 0 && (
              <select value={h.stack_after_habit_id ?? ''} onChange={(e) => set({ stack_after_habit_id: e.target.value || null })}>
                <option value="">…or pick one of your habits</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.emoji} {o.name}</option>)}
              </select>
            )}
            {(h.cue_time || h.location) && <Sentence>I will {name.toLowerCase()}{h.cue_time && ` at ${h.cue_time}`}{h.location && ` in ${h.location}`}.</Sentence>}
            {anchor && <Sentence>After I {anchor}, I will {name.toLowerCase()}.</Sentence>}
          </>,
          // 3 — attractive
          <>
            <Tip>We're drawn to things we enjoy. Remind yourself why this matters, and pair the habit with something you love.</Tip>
            <Field label="Why does this matter to you?">
              <textarea rows={3} value={h.why} onChange={(e) => set({ why: e.target.value })} placeholder="e.g. I want to feel calm and focused" />
            </Field>
            <Field label="Pair it with something you enjoy" hint="Only while doing the habit do you get this treat.">
              <input value={h.temptation_bundle} onChange={(e) => set({ temptation_bundle: e.target.value })} placeholder="e.g. listen to my favorite podcast" />
            </Field>
          </>,
          // 4 — easy
          <>
            <Tip>Make it so easy you can't say no. On hard days, doing the tiny version still counts and keeps your streak.</Tip>
            <Field label="The 2-minute version" hint="A version that takes 2 minutes or less.">
              <input value={h.two_min_version} onChange={(e) => set({ two_min_version: e.target.value })} placeholder="e.g. read one page" />
            </Field>
            <Field label="How many times a day?" hint="Leave at 1 for most habits. Use more for things like glasses of water.">
              <Stepper value={h.target_count} min={1} max={20} onChange={(target_count) => set({ target_count })} />
            </Field>
          </>,
          // 5 — satisfying
          <>
            <Tip>We repeat what feels good. Every check-off is a small win, and your streak grows. If you miss a day, just don't miss twice.</Tip>
            <Summary h={h} identity={identities.find((i) => i.id === h.identity_id)?.name} anchor={anchor} />
            <Field label="Habit contract (optional)" hint="A promise to someone, with a small cost if you break it.">
              <textarea rows={2} value={h.contract} onChange={(e) => set({ contract: e.target.value })} placeholder="e.g. If I skip a week, I buy my sister lunch." />
            </Field>
          </>,
        ]
      : [
          <>
            <Segmented value={h.type} onChange={(type) => set({ type })} options={[{ value: 'build', label: 'Build a good habit' }, { value: 'break', label: 'Break a bad habit' }]} />
            <Field label="What habit do you want to stop?">
              <input value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Scrolling in bed" autoFocus />
            </Field>
            <EmojiAndColor h={h} set={set} />
          </>,
          <IdentityStep h={h} set={set} identities={identities} newIdentity={newIdentity} setNewIdentity={setNewIdentity} addIdentity={addIdentity}>
            <Tip>Not “I'm trying to quit”, but “I'm <b>not a smoker</b>.” Every clean day counts as a vote for that person.</Tip>
          </IdentityStep>,
          <>
            <Tip>Bad habits start with a cue. Spot it, then get it out of sight.</Tip>
            <Field label="What usually sets it off?"><input value={h.cue_trigger} onChange={(e) => set({ cue_trigger: e.target.value })} placeholder="e.g. phone on the nightstand" /></Field>
            <Field label="How will you hide that trigger?"><input value={h.hide_plan} onChange={(e) => set({ hide_plan: e.target.value })} placeholder="e.g. charge my phone in the kitchen" /></Field>
          </>,
          <>
            <Tip>Look at what it really costs you. The clearer the downside, the less tempting it feels.</Tip>
            <Field label="What does this habit cost you?">
              <textarea rows={3} value={h.why} onChange={(e) => set({ why: e.target.value })} placeholder="e.g. I sleep badly and feel tired all day" />
            </Field>
          </>,
          <>
            <Tip>Add steps between you and the habit. The harder it is to start, the less you'll do it.</Tip>
            <Field label="How will you make it harder?">
              <textarea rows={3} value={h.friction_plan} onChange={(e) => set({ friction_plan: e.target.value })} placeholder="e.g. log out of social apps every night" />
            </Field>
          </>,
          <>
            <Tip>Make slipping hurt a little. A promise to someone you respect works well.</Tip>
            <Field label="Habit contract (optional)">
              <textarea rows={2} value={h.contract} onChange={(e) => set({ contract: e.target.value })} placeholder="e.g. Each slip, I put $5 in a jar for my friend." />
            </Field>
            <Summary h={h} identity={identities.find((i) => i.id === h.identity_id)?.name} anchor={undefined} />
          </>,
        ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))} className="text-sm text-stone-500">‹ {step === 0 ? 'Cancel' : 'Back'}</button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <button key={i} onClick={() => (id || i < step) && setStep(i)} aria-label={`Step ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-amber-500' : i < step ? 'w-2 bg-amber-500/60' : 'w-2 bg-stone-300 dark:bg-stone-700'}`} />
          ))}
        </div>
      </div>
      {steps[step].law && <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{steps[step].law}</p>}
      <h1 className="mb-5 text-2xl font-bold tracking-tight">{steps[step].title}</h1>
      <div className="space-y-4">{pages[step]}</div>
      <div className="mt-8 flex gap-2">
        {id && !isLast && <Button variant="secondary" className="flex-1" onClick={save} disabled={!h.name.trim()}>Save</Button>}
        <Button className="flex-1" disabled={!h.name.trim()} onClick={() => (isLast ? save() : setStep(step + 1))}>
          {isLast ? (id ? 'Save changes' : 'Create habit') : 'Next'}
        </Button>
      </div>
      {!isLast && step > 0 && <p className="mt-3 text-center text-xs text-stone-500">Everything here is optional. Skip what you like.</p>}
    </div>
  )
}

function EmojiAndColor({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  return (
    <>
      <Field label="Icon">
        <div className="grid grid-cols-8 gap-1.5">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => set({ emoji: e })}
              className={`aspect-square rounded-lg text-xl ${h.emoji === e ? 'bg-amber-500/25 ring-2 ring-amber-500' : 'bg-stone-100 dark:bg-stone-800'}`}>
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <div className="flex gap-2">
          {HABIT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c}
              className={`h-8 w-8 rounded-full ${h.color === c ? 'ring-2 ring-stone-900 ring-offset-2 dark:ring-white dark:ring-offset-stone-950' : ''}`}
              style={{ background: c }} />
          ))}
        </div>
      </Field>
    </>
  )
}

function IdentityStep(p: {
  h: Habit; set: (p: Partial<Habit>) => void; identities: { id: string; name: string }[]
  newIdentity: string; setNewIdentity: (s: string) => void; addIdentity: () => void; children: ReactNode
}) {
  return (
    <>
      {p.children}
      {p.identities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {p.identities.map((i) => (
            <button key={i.id} type="button" onClick={() => p.set({ identity_id: p.h.identity_id === i.id ? null : i.id })}
              className={`rounded-full px-4 py-2 text-sm font-medium ${p.h.identity_id === i.id ? 'bg-amber-500 text-stone-950' : 'bg-stone-200 dark:bg-stone-800'}`}>
              I am {i.name}
            </button>
          ))}
        </div>
      )}
      <Field label="Add a new identity: “I am…”">
        <div className="flex gap-2">
          <input value={p.newIdentity} onChange={(e) => p.setNewIdentity(e.target.value)} placeholder="e.g. a reader" onKeyDown={(e) => e.key === 'Enter' && p.addIdentity()} />
          <Button type="button" variant="secondary" onClick={p.addIdentity}>Add</Button>
        </div>
      </Field>
    </>
  )
}

function Summary({ h, identity, anchor }: { h: Habit; identity?: string; anchor?: string }) {
  const rows = [
    identity && ['Identity', `I am ${identity}`],
    h.type === 'build' && (h.cue_time || h.location) && ['Plan', [h.cue_time && `at ${h.cue_time}`, h.location && `in ${h.location}`].filter(Boolean).join(', ')],
    anchor && ['Stacked', `after I ${anchor}`],
    h.cue_trigger && ['Trigger', h.cue_trigger],
    h.hide_plan && ['Hide it', h.hide_plan],
    h.temptation_bundle && ['Reward', h.temptation_bundle],
    h.two_min_version && ['2-min version', h.two_min_version],
    h.friction_plan && ['Make it hard', h.friction_plan],
  ].filter(Boolean) as [string, string][]
  return (
    <div className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
      <div className="mb-2 flex items-center gap-2 text-lg font-semibold"><span>{h.emoji}</span>{h.name || 'Your habit'}</div>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 text-stone-500">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}
