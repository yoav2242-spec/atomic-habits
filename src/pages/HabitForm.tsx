import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TimePicker } from '../components/TimePicker'
import { BackButton, Button, buttonClass, Field, Segmented, spring, Stepper, Toggle, useToast } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { db } from '../lib/db'
import { WEEKDAY_SHORT } from '../lib/dates'
import { useHabits, useIdentities } from '../lib/hooks'
import { addPastProgress, createIdentity, HABIT_COLORS, newHabit, saveHabit, saveIdentity } from '../lib/repo'
import { habitFromTemplate, TEMPLATES } from '../lib/templates'
import { CONTAINERS, goalBreakdown, isAmount, UNITS } from '../lib/amounts'
import { clockAlarmUrl, isAndroid } from '../lib/alarm'
import { connectGoogle, googleReady, syncGoogle, useGoogleStatus } from '../lib/gcal'
import { remindersReady, VIBRATIONS } from '../lib/reminders'
import type { Habit, Schedule } from '../lib/types'

const EMOJIS = ['✨', '📖', '🏃', '💪', '🧘', '💧', '🥗', '😴', '✍️', '🎸', '🧠', '🌱', '🦷', '🚶', '🧹', '💊', '☀️', '🙏', '🤸', '🗣️', '📵', '🍪', '📺', '💸']
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

const STEPS = {
  build: [
    { title: 'The habit', law: '' },
    { title: 'Who do you want to become?', law: 'Identity · who it makes you' },
    { title: 'Make it obvious', law: 'Law 1 of 4 · when and where' },
    { title: 'Make it attractive', law: 'Law 2 of 4 · want to do it' },
    { title: 'Make it easy', law: 'Law 3 of 4 · start tiny' },
    { title: 'Make it satisfying', law: 'Law 4 of 4 · feel the win' },
  ],
  break: [
    { title: 'The habit to break', law: '' },
    { title: 'Who do you want to become?', law: 'Identity · who it makes you' },
    { title: 'Make it invisible', law: 'Law 1, flipped' },
    { title: 'Make it unattractive', law: 'Law 2, flipped' },
    { title: 'Make it difficult', law: 'Law 3, flipped' },
    { title: 'Make it unsatisfying', law: 'Law 4, flipped' },
  ],
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2.5 rounded-[20px] bg-[color-mix(in_srgb,var(--color-sage)_20%,var(--card))] p-3.5 text-[16px] font-semibold leading-relaxed">
            <span>{children}</span>
    </p>
  )
}

function Sentence({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-sage p-4 text-[18px] font-extrabold leading-snug tracking-[-0.01em]">“{children}”</p>
}

export default function HabitForm() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const habits = useHabits()
  const identities = useIdentities()
  const existing = useLiveQuery(() => (id ? db.habits.get(id) : undefined), [id])
  const [draft, setDraft] = useState<Habit | null>(id ? null : newHabit(Date.now()))
  // -1: pick a starter habit. Skipped when editing, or when "make my own" was already chosen.
  // Ready-made habits picked in the welcome tour (?t=2,5): set each one up in turn, all four laws.
  const [queue, setQueue] = useState<number[]>(() => (search.get('t') ?? '').split(',').filter(Boolean).map(Number).filter((n) => TEMPLATES[n]))
  const [queueTotal] = useState(queue.length)
  const [step, setStep] = useState(search.has('step') ? Number(search.get('step')) || 0 : id || search.has('own') || queue.length ? 0 : -1)
  const [newIdentity, setNewIdentity] = useState('')
  const [pastDays, setPastDays] = useState(0)
  // "Also add to" on the last step: put the habit in Google Calendar and/or the Clock app.
  const [addAlarm, setAddAlarm] = useState(false)
  const toast = useToast()
  const google = useGoogleStatus()

  useEffect(() => {
    if (id && existing && !draft) setDraft(existing)
  }, [id, existing, draft])

  // The welcome tour's picks: fill the form with the first one waiting.
  const nextPick = queue[0]
  useEffect(() => {
    if (nextPick === undefined) return
    let live = true
    habitFromTemplate(TEMPLATES[nextPick], Date.now()).then((d) => live && setDraft(d))
    return () => { live = false }
  }, [nextPick])

  if (!draft || !habits || !identities) return null
  const h = draft
  const set = (patch: Partial<Habit>) => setDraft({ ...h, ...patch })
  const steps = STEPS[h.type]
  const isLast = step === steps.length - 1
  const name = h.name.trim() || 'my habit'
  const others = habits.filter((o) => o.id !== h.id && o.type === 'build' && !o.archived)
  const anchor = h.stack_after_habit_id ? habits.find((o) => o.id === h.stack_after_habit_id)?.name.toLowerCase() : h.stack_after_text.trim()

  const save = async () => {
    const saved = { ...h, name: h.name.trim(), target_count: Math.max(1, h.target_count || 1), step: Math.max(1, h.step || 1) }
    const offerReminders = isLast && saved.type === 'build' && !!saved.cue_time
    const alarm = offerReminders && addAlarm && !isAmount(saved) && isAndroid() ? clockAlarmUrl(saved) : null
    await saveHabit(saved)
    if (!id) {
      await addPastProgress(saved, pastDays)
      bigCelebration()
    }
    if (!id && queue.length > 1) {
      // More picks waiting: start the next one from its first step.
      setQueue(queue.slice(1))
      setStep(0)
      setPastDays(0)
      setAddAlarm(false)
      window.scrollTo(0, 0)
      toast(`${saved.name} added. Next: ${TEMPLATES[queue[1]].habit.name}`)
      return
    }
    navigate(id ? `/habits/${h.id}` : '/', { replace: true })
    if (google?.on) {
      // Keep the Habits calendar in step (also when the habit lost its time or was unticked).
      const state = await syncGoogle().catch(() => 'needs-tap' as const)
      if (state === 'needs-tap') toast('Google needs you to sign in again', { label: 'Update calendar', onClick: () => { syncGoogle(true).then(() => toast('Habits calendar updated')).catch(() => {}) } })
      else if (offerReminders && saved.calendar) toast('Added to your Habits calendar')
    }
    // The Clock app opens over Atomic; its back button comes straight back here.
    if (alarm) location.href = alarm
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

  if (step === -1) {
    return (
      <div>
        <BackButton label="Cancel" className="mb-2" />
        <h1 className="text-[30px] font-black leading-[1.05] tracking-[-0.02em]">Add a habit</h1>
        <p className="mb-5 mt-2 font-semibold leading-snug text-muted">Tap a ready-made habit. Every step is already filled in, and you can change anything as you go. Or make your own.</p>
        <button onClick={() => setStep(0)} className="btn-3d mb-5 flex w-full items-center gap-3.5 rounded-[24px] bg-sage p-4 text-left text-on-pastel">
                    <span>
            <span className="block text-lg font-black">Make my own</span>
            <span className="text-sm font-bold text-on-pastel/75">We'll guide you step by step</span>
          </span>
        </button>
        {(['build', 'break'] as const).map((kind) => (
          <section key={kind} className="mb-6">
            <h2 className="label mb-2.5 ml-1">{kind === 'build' ? 'Build a good habit' : 'Break a bad habit'}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((t, i) => ({ t, i })).filter(({ t }) => (t.habit.type ?? 'build') === kind).map(({ t }) => (
                <button key={t.habit.name} onClick={async () => { setDraft(await habitFromTemplate(t, Date.now())); setStep(0) }}
                  className="clay-sm bouncy rounded-[22px] p-3.5 text-left">
                  <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-[16px] text-2xl" style={{ background: `color-mix(in srgb, ${t.habit.color} 38%, var(--card))` }}>{t.habit.emoji}</div>
                  <div className="text-[16px] font-extrabold leading-tight">{t.habit.name}</div>
                  <div className="mt-0.5 text-[14px] font-semibold leading-snug text-muted">{kind === 'break' ? `To be ${t.identity}` : `I am ${t.identity}`}</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // Fields that only make sense for one kind of habit are cleared when switching.
  const switchType = (type: Habit['type']) =>
    set(type === 'break'
      ? { type, temptation_bundle: '', two_min_version: '', stack_after_text: '', stack_after_habit_id: null, target_count: 1, unit: '', step: 1, step_label: '' }
      : { type, cue_trigger: '', hide_plan: '', friction_plan: '' })

  const typeSwitch = (
    <Segmented value={h.type} onChange={switchType} options={[{ value: 'build', label: 'Build a habit' }, { value: 'break', label: 'Break a habit' }]} />
  )

  const pastProgress = !id && (
    <Field label={h.type === 'build' ? 'Already doing this?' : 'Already stopped?'} hint={h.type === 'build' ? 'How many days in a row so far? They count toward your streak.' : 'How many days since you last did it?'}>
      <Stepper value={pastDays} min={0} max={365} onChange={setPastDays} />
    </Field>
  )

  const pages: ReactNode[] =
    h.type === 'build'
      ? [
          <>
            {typeSwitch}
            <Field label="What's the habit?" hint="Be specific: “Read 10 pages”, not “Read more”.">
              <input value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Read 10 pages" autoFocus />
            </Field>
            <EmojiAndColor h={h} set={set} />
          </>,
          <IdentityStep h={h} set={set} identities={identities} newIdentity={newIdentity} setNewIdentity={setNewIdentity} addIdentity={addIdentity}>
            <Tip>The goal isn't to read a book, it's to <b>become a reader</b>. Each time you do this habit, it's a vote for that person.</Tip>
          </IdentityStep>,
          <>
            <Tip>Pick an exact time and place. A clear plan makes you much more likely to actually do it.</Tip>
            {isAmount(h) ? (
              <p className="tray rounded-2xl p-3.5 text-[16px] font-bold">
                This is an every-day amount. You set how much, and in how many {h.step_label || 'drinks'}s, in "Make it easy".
              </p>
            ) : (
              <>
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
                          className={`min-h-11 flex-1 rounded-full text-sm font-extrabold ${on ? 'puffy bg-sage text-on-pastel' : 'clay-sm text-muted'}`}>
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
              </>
            )}
            <Field label={isAmount(h) ? 'Remind me to start at (optional)' : 'What time?'}>
              <TimePicker value={h.cue_time} onChange={(cue_time) => set({ cue_time })} />
            </Field>
            <Field label="Where?"><input value={h.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. bedroom" /></Field>
            <ReminderSettings h={h} set={set} />
            <Field label="Right after I…" tip="stacking" hint="Link it to something you already do every day.">
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
          <>
            <Tip>We repeat what we enjoy. Remind yourself why it matters, and pair it with something you love.</Tip>
            <Field label="Why does this matter to you?">
              <textarea rows={3} value={h.why} onChange={(e) => set({ why: e.target.value })} placeholder="e.g. I want to feel calm and focused" />
            </Field>
            <Field label="Pair it with a treat" tip="bundle" hint="You only get the treat while doing the habit.">
              <input value={h.temptation_bundle} onChange={(e) => set({ temptation_bundle: e.target.value })} placeholder="e.g. listen to my favorite podcast" />
            </Field>
          </>,
          <>
            <Tip>Make it so easy you can't say no. On hard days, the tiny version still counts and keeps your streak.</Tip>
            <Field label="The 2-minute version" tip="two_min" hint="Something that takes 2 minutes or less.">
              <input value={h.two_min_version} onChange={(e) => set({ two_min_version: e.target.value })} placeholder="e.g. read one page" />
            </Field>
            <DailyGoal h={h} set={set} />
          </>,
          <>
            <Tip>Each check-off gives you points, confetti and a growing streak. If you miss a day, just don't miss twice.</Tip>
            <Summary h={h} identity={identities.find((i) => i.id === h.identity_id)?.name} anchor={anchor} />
            {pastProgress}
            <Field label="Habit contract (optional)" tip="contract">
              <textarea rows={2} value={h.contract} onChange={(e) => set({ contract: e.target.value })} placeholder="e.g. If I skip a week, I buy my sister lunch." />
            </Field>
          </>,
        ]
      : [
          <>
            {typeSwitch}
            <Field label="What habit do you want to stop?">
              <input value={h.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Scrolling in bed" autoFocus />
            </Field>
            {!id && (
              <div>
                <div className="mb-2 text-[14px] font-bold text-muted">Ideas: tap one to fill in every step</div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.filter((t) => t.habit.type === 'break').map((t) => (
                    <button key={t.habit.name} type="button" onClick={async () => setDraft(await habitFromTemplate(t, h.sort_order))}
                      className={`min-h-11 rounded-full px-4 text-[15px] font-extrabold ${h.name === t.habit.name ? 'puffy bg-sage text-on-pastel' : 'clay-sm'}`}>
                      {t.habit.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <EmojiAndColor h={h} set={set} />
          </>,
          <IdentityStep h={h} set={set} identities={identities} newIdentity={newIdentity} setNewIdentity={setNewIdentity} addIdentity={addIdentity}>
            <Tip>Not “I'm trying to quit”, but “I'm <b>not a smoker</b>.” Every clean day is a vote for that person.</Tip>
          </IdentityStep>,
          <>
            <Tip>Bad habits start with a trigger. Spot it, then get it out of sight.</Tip>
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
            <Tip>Put more steps between you and the habit. The harder it is to start, the less you'll do it.</Tip>
            <Field label="How will you make it harder?">
              <textarea rows={3} value={h.friction_plan} onChange={(e) => set({ friction_plan: e.target.value })} placeholder="e.g. log out of social apps every night" />
            </Field>
          </>,
          <>
            <Summary h={h} identity={identities.find((i) => i.id === h.identity_id)?.name} anchor={undefined} />
            {pastProgress}
            <Field label="Make slipping cost something (optional)" tip="contract">
              <textarea rows={2} value={h.contract} onChange={(e) => set({ contract: e.target.value })} placeholder="e.g. Each slip, I put $5 in a jar for my friend." />
            </Field>
          </>,
        ]

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <BackButton label={step === 0 && id ? 'Cancel' : 'Back'} onClick={() => (step === 0 ? (id ? navigate(-1) : setStep(-1)) : setStep(step - 1))} />
        <div className="-mr-1 flex">
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? 'step' : undefined}
              className="flex h-11 items-center justify-center px-[3px]">
              <motion.span layout transition={spring} className={`block h-3 rounded-full ${i === step ? 'puffy w-7 bg-sage' : i < step ? 'w-3 bg-sage/55' : 'clay-in w-3'}`} />
            </button>
          ))}
        </div>
      </div>
      {queueTotal > 1 && <p className="mb-1 text-[14px] font-bold text-muted">Habit {queueTotal - queue.length + 1} of {queueTotal}</p>}
      <h1 className="text-[28px] font-black leading-[1.1] tracking-[-0.02em]">{id && step === 0 ? 'Edit habit' : steps[step].title}</h1>
      {steps[step].law ? <p className="mb-5 mt-1 text-[16px] font-bold text-sage-deep">{steps[step].law}</p> : <div className="mb-5" />}
      <div key={step} className="animate-rise space-y-4">{pages[step]}</div>
      {isLast && h.type === 'build' && (
        <AlsoAdd h={h} set={set} alarm={addAlarm} setAlarm={setAddAlarm} pickTime={() => setStep(2)} />
      )}
      <div className="mt-8 flex gap-2">
        {id && !isLast && <Button variant="secondary" className="flex-1" onClick={save} disabled={!h.name.trim()}>Save</Button>}
        <Button className="flex-1 text-lg" disabled={!h.name.trim()} onClick={() => (isLast ? save() : setStep(step + 1))}>
          {isLast ? (id ? 'Save changes' : queue.length > 1 ? 'Create, then next habit' : 'Create habit') : 'Next'}
        </Button>
      </div>
      {!isLast && step > 0 && <p className="mt-3 text-center text-[14px] font-semibold text-muted">Everything here is optional. Skip what you like.</p>}
      {id && <p className="mt-3 text-center text-[14px] font-semibold text-muted">Tap the dots at the top to jump to any part.</p>}
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
              className={`bouncy aspect-square min-h-10 rounded-[14px] text-xl ${h.emoji === e ? 'puffy' : 'tray'}`}
              style={h.emoji === e ? { background: h.color } : undefined} aria-pressed={h.emoji === e}>
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <div className="grid grid-cols-8">
          {HABIT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={`Colour ${c}`} aria-pressed={h.color === c}
              className="bouncy flex h-11 items-center justify-center rounded-full">
              <span className={`puffy flex h-9 w-9 items-center justify-center rounded-full transition-transform ${h.color === c ? 'scale-110' : ''}`} style={{ background: c }}>
                {h.color === c && <span className="text-[18px] font-black text-on-pastel">✓</span>}
              </span>
            </button>
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
              className={`bouncy min-h-11 rounded-full px-4 py-2 text-sm font-extrabold ${p.h.identity_id === i.id ? 'puffy bg-lavender text-on-pastel' : 'clay-sm text-muted'}`}>
              I am {i.name}
            </button>
          ))}
        </div>
      )}
      <Field label="Add a new identity: “I am…”" tip="identity">
        <div className="flex gap-2">
          <input value={p.newIdentity} onChange={(e) => p.setNewIdentity(e.target.value)} placeholder={p.h.type === 'break' ? 'e.g. a non-smoker' : 'e.g. a reader'} onKeyDown={(e) => e.key === 'Enter' && p.addIdentity()} />
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
    h.type === 'build' && anchor && ['Stacked', `after I ${anchor}`],
    h.type === 'break' && h.cue_trigger && ['Trigger', h.cue_trigger],
    h.type === 'break' && h.hide_plan && ['Hide it', h.hide_plan],
    h.why && [h.type === 'break' ? 'Cost' : 'Why', h.why],
    h.type === 'build' && h.temptation_bundle && ['Treat', h.temptation_bundle],
    h.type === 'build' && h.two_min_version && ['2-min version', h.two_min_version],
    h.type === 'break' && h.friction_plan && ['Make it hard', h.friction_plan],
  ].filter(Boolean) as [string, string][]
  return (
    <div className="rounded-[24px] p-4" style={{ background: `color-mix(in srgb, ${h.color} 26%, var(--card))` }}>
      <div className="mb-3 flex items-center gap-2.5 text-lg font-black leading-tight"><span className="text-2xl">{h.emoji}</span>{h.name || 'Your habit'}</div>
      <dl className="space-y-1.5 text-[16px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-[6.5rem] shrink-0 font-bold opacity-70">{k}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-3 text-[14px] font-semibold opacity-70">Want to change something? Tap the dots at the top.</p>
    </div>
  )
}

/** How much counts as done: once, a number of times, or an amount like 2,400 ml in 800 ml bottles. */
function DailyGoal({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  const mode = isAmount(h) ? 'amount' : h.target_count > 1 ? 'times' : 'once'
  const setMode = (m: string) =>
    set(m === 'once' ? { target_count: 1, unit: '', step: 1, step_label: '' }
      : m === 'times' ? { target_count: Math.max(2, isAmount(h) ? 3 : h.target_count), unit: '', step: 1, step_label: '' }
      : { target_count: 2000, unit: 'ml', step: 500, step_label: 'bottle', calendar: false, schedule: { kind: 'daily' } })
  const presets = CONTAINERS[h.unit] ?? []
  // Keep the number of bottles the same when the bottle size changes.
  const servings = Math.max(1, Math.round(h.target_count / Math.max(1, h.step)))
  const setContainer = (size: number, label: string) => set({ step: size, step_label: label, target_count: servings * Math.max(1, size) })
  return (
    <Field label="What counts as done each day?">
      <div className="space-y-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'once', label: 'Just do it' }, { value: 'times', label: 'Times a day' }, { value: 'amount', label: 'An amount' }]} />
        {mode === 'times' && <Stepper value={h.target_count} min={2} max={30} onChange={(target_count) => set({ target_count })} />}
        {mode === 'amount' && (
          <div className="tray space-y-4 rounded-[20px] p-3.5">
            <div>
              <div className="mb-2 text-[14px] font-bold text-muted">What do you drink from?</div>
              {presets.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {presets.map((c) => (
                    <button key={`${c.label}${c.size}`} type="button" onClick={() => setContainer(c.size, c.label)}
                      className={`min-h-11 rounded-full px-3.5 text-[14px] font-extrabold ${h.step === c.size && h.step_label === c.label ? 'puffy bg-sage text-on-pastel' : 'clay-sm text-muted'}`}>
                      {c.label} · {c.size} {h.unit}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" min={1} value={h.step || ''} onChange={(e) => setContainer(Math.max(0, Number(e.target.value)), h.step_label)} className="!w-1/2" aria-label="Size of one" />
                <input value={h.step_label} onChange={(e) => set({ step_label: e.target.value })} placeholder="name, e.g. bottle" className="!w-1/2" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-extrabold">How many {h.step_label || 'times'}s a day?</span>
              <Stepper value={servings} min={1} max={40} onChange={(n) => set({ target_count: n * Math.max(1, h.step) })} />
            </div>
            <div>
              <div className="mb-2 text-[14px] font-bold text-muted">Or type the daily total</div>
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" min={1} value={h.target_count || ''} onChange={(e) => set({ target_count: Math.max(0, Number(e.target.value)) })} className="!w-1/2" aria-label="Daily total" />
                <select value={UNITS.includes(h.unit) ? h.unit : 'other'} onChange={(e) => set({ unit: e.target.value === 'other' ? 'times' : e.target.value })} className="!w-1/2">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value="other">other…</option>
                </select>
              </div>
              {!UNITS.includes(h.unit) && (
                <input className="mt-2" value={h.unit} onChange={(e) => set({ unit: e.target.value || 'times' })} placeholder="Your unit, e.g. push-ups" />
              )}
            </div>
            {h.target_count > 0 && h.step > 0 && <p className="text-sm font-bold">= {goalBreakdown(h)} a day</p>}
          </div>
        )}
      </div>
    </Field>
  )
}

/** "Remind me" with this habit's own vibration, plus a Clock-app alarm for a custom sound. */
function ReminderSettings({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  if (!h.cue_time) return null
  const alarm = clockAlarmUrl(h)
  return (
    <div className="tray space-y-4 rounded-[20px] p-3.5">
      {remindersReady && (<>
      <div className="flex items-center gap-3">
        <span className="flex-1">
          <span className="block text-sm font-extrabold">Remind me at {h.cue_time}</span>
          <span className="block text-[14px] font-semibold text-muted">A notification, only if it isn't done yet</span>
        </span>
        <Toggle label="Remind me" on={h.remind} onChange={(remind) => set({ remind })} />
      </div>
      {h.remind && (
        <div>
          <div className="mb-2 text-[14px] font-bold text-muted">Vibration for this habit (tap to feel it)</div>
          <div className="flex flex-wrap gap-1.5">
            {VIBRATIONS.map((v) => (
              <button key={v.value} type="button" onClick={() => { set({ vibrate: v.value }); navigator.vibrate?.(v.pattern) }}
                className={`min-h-11 rounded-full px-3.5 text-[14px] font-extrabold ${h.vibrate === v.value ? 'puffy bg-sage text-on-pastel' : 'clay-sm text-muted'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
      </>)}
      {h.type === 'build' && <CalendarChoice h={h} set={set} />}
      {isAndroid() && alarm && (
        <a href={alarm} className={buttonClass('secondary', 'w-full !min-h-11 gap-1.5 !px-3 text-sm')}>Add a Clock alarm (pick its sound)</a>
      )}
    </div>
  )
}

/** Last step: tick where else the habit should go, and it's added there when you press Create. */
function AlsoAdd({ h, set, alarm, setAlarm, pickTime }: {
  h: Habit; set: (p: Partial<Habit>) => void; alarm: boolean; setAlarm: (v: boolean) => void; pickTime: () => void
}) {
  if (!h.cue_time) {
    return (
      <div className="tray mt-6 flex items-center gap-3 rounded-[20px] p-3.5">
        <span className="flex-1 text-sm font-bold">Want a reminder? Pick a time first.</span>
        <Button variant="secondary" className="!min-h-11 !px-4 !py-1.5 text-sm" onClick={pickTime}>Pick a time</Button>
      </div>
    )
  }
  return (
    <div className="tray mt-6 space-y-4 rounded-[20px] p-3.5">
      <div className="text-[16px] font-extrabold">Reminders at {h.cue_time}</div>
      <CalendarChoice h={h} set={set} />
      {isAndroid() && !isAmount(h) && (
        <div className="flex items-center gap-3">
          <span className="flex flex-1 items-center gap-2 text-sm font-extrabold">Also set an alarm in my Clock app</span>
          <Toggle label="Clock alarm" on={alarm} onChange={setAlarm} />
        </div>
      )}
    </div>
  )
}

/**
 * "Add to my Habits calendar": off unless switched on. If Google Calendar isn't connected yet,
 * switching it on offers to connect right here.
 */
function CalendarChoice({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  const google = useGoogleStatus()
  const toast = useToast()
  const [connecting, setConnecting] = useState(false)
  if (!googleReady) return null
  const connect = async () => {
    setConnecting(true)
    try {
      await connectGoogle()
      toast('Google Calendar connected')
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't connect to Google")
    } finally {
      setConnecting(false)
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex-1">
          <span className="flex items-center gap-2 text-sm font-extrabold">Add to my Habits calendar</span>
          <span className="mt-0.5 block text-[14px] font-semibold text-muted">{h.calendar ? `Google Calendar will remind you at ${h.cue_time}` : 'Off: this habit stays out of your calendar'}</span>
        </span>
        <Toggle label="Add to my Habits calendar" on={h.calendar} onChange={(calendar) => set({ calendar })} />
      </div>
      {h.calendar && google && !google.on && (
        <Button variant="secondary" className="w-full !min-h-11 text-sm" disabled={connecting} onClick={connect}>
          {connecting ? 'Connecting…' : 'Connect Google Calendar first'}
        </Button>
      )}
    </div>
  )
}
