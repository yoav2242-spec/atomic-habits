import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Field, Segmented, Stepper } from '../components/ui'
import { bigCelebration } from '../lib/celebrate'
import { db } from '../lib/db'
import { WEEKDAY_SHORT } from '../lib/dates'
import { useHabits, useIdentities } from '../lib/hooks'
import { addPastProgress, createIdentity, HABIT_COLORS, newHabit, saveHabit, saveIdentity } from '../lib/repo'
import { habitFromTemplate, TEMPLATES } from '../lib/templates'
import { CONTAINERS, goalBreakdown, isAmount, UNITS } from '../lib/amounts'
import type { Habit, Schedule } from '../lib/types'

const EMOJIS = ['✨', '📖', '🏃', '💪', '🧘', '💧', '🥗', '😴', '✍️', '🎸', '🧠', '🌱', '🦷', '🚶', '🧹', '💊', '☀️', '🙏', '🤸', '🗣️', '📵', '🍪', '📺', '💸']
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0]

const STEPS = {
  build: [
    { title: 'The habit', law: '' },
    { title: 'Who do you want to become?', law: 'Identity' },
    { title: 'Make it obvious', law: 'Law 1 · When & where' },
    { title: 'Make it attractive', law: 'Law 2 · Want to do it' },
    { title: 'Make it easy', law: 'Law 3 · Start tiny' },
    { title: 'Make it satisfying', law: 'Law 4 · Feel the win' },
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
  return <p className="rounded-2xl bg-sage/12 p-3.5 text-sm font-semibold leading-relaxed">💡 {children}</p>
}

function Sentence({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-sage/50 p-3.5 text-[15px] font-bold">“{children}”</p>
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
  const [step, setStep] = useState(id || search.has('own') ? 0 : -1)
  const [newIdentity, setNewIdentity] = useState('')
  const [pastDays, setPastDays] = useState(0)

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
    const saved = { ...h, name: h.name.trim(), target_count: Math.max(1, h.target_count || 1), step: Math.max(1, h.step || 1) }
    await saveHabit(saved)
    if (!id) {
      await addPastProgress(saved, pastDays)
      bigCelebration()
    }
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

  if (step === -1) {
    return (
      <div>
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-bold text-muted">‹ Cancel</button>
        <h1 className="text-3xl font-black tracking-tight">Add a habit</h1>
        <p className="mb-5 font-semibold text-muted">Tap a ready-made habit. Every step is already filled in, and you can change anything as you go. Or make your own.</p>
        <button onClick={() => setStep(0)} className="bouncy mb-4 flex w-full items-center gap-3 rounded-3xl bg-sage p-4 text-left text-white shadow-[0_4px_0_0_var(--color-sage-deep)]">
          <span className="text-3xl">✏️</span>
          <span>
            <span className="block text-lg font-black">Make my own</span>
            <span className="text-sm font-semibold text-white/85">We'll guide you step by step</span>
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          {TEMPLATES.map((t) => (
            <button key={t.habit.name} onClick={async () => { setDraft(await habitFromTemplate(t, Date.now())); setStep(0) }}
              className="bouncy rounded-3xl border border-line bg-card p-3.5 text-left shadow-sm">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl text-2xl" style={{ background: `${t.habit.color}33` }}>{t.habit.emoji}</div>
              <div className="text-sm font-extrabold leading-tight">{t.habit.name}</div>
              <div className="text-xs font-semibold text-muted">{t.habit.type === 'break' ? 'Break a bad habit' : `I am ${t.identity}`}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const typeSwitch = (
    <Segmented value={h.type} onChange={(type) => set({ type })} options={[{ value: 'build', label: '🌱 Build a habit' }, { value: 'break', label: '✂️ Break a habit' }]} />
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
                      className={`bouncy flex-1 rounded-xl py-2.5 text-sm font-extrabold ${on ? 'bg-sage text-white' : 'bg-soft text-muted'}`}>
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
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => (step === 0 ? (id ? navigate(-1) : setStep(-1)) : setStep(step - 1))} className="text-sm font-bold text-muted">‹ {step === 0 && id ? 'Cancel' : 'Back'}</button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`}
              className={`h-2.5 rounded-full transition-all ${i === step ? 'w-7 bg-sage' : i < step ? 'w-2.5 bg-sage/60' : 'w-2.5 bg-line'}`} />
          ))}
        </div>
      </div>
      {steps[step].law && <p className="text-xs font-black uppercase tracking-wider text-sage-deep dark:text-sage">{steps[step].law}</p>}
      <h1 className="mb-5 text-[26px] font-black tracking-tight">{id && step === 0 ? 'Edit habit' : steps[step].title}</h1>
      <div key={step} className="animate-rise space-y-4">{pages[step]}</div>
      <div className="mt-8 flex gap-2">
        {id && !isLast && <Button variant="secondary" className="flex-1" onClick={save} disabled={!h.name.trim()}>Save</Button>}
        <Button className="flex-1 text-lg" disabled={!h.name.trim()} onClick={() => (isLast ? save() : setStep(step + 1))}>
          {isLast ? (id ? 'Save changes' : 'Create habit 🎉') : 'Next'}
        </Button>
      </div>
      {!isLast && step > 0 && <p className="mt-3 text-center text-xs font-semibold text-muted">Everything here is optional. Skip what you like.</p>}
      {id && <p className="mt-3 text-center text-xs font-semibold text-muted">Tap the dots at the top to jump to any part.</p>}
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
              className={`bouncy aspect-square rounded-xl text-xl ${h.emoji === e ? 'ring-2 ring-sage' : 'bg-soft'}`}
              style={h.emoji === e ? { background: `${h.color}33` } : undefined}>
              {e}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <div className="flex gap-2">
          {HABIT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c}
              className={`bouncy h-9 w-9 rounded-full ${h.color === c ? 'scale-110 ring-[3px] ring-ink/70 ring-offset-2 ring-offset-bg' : ''}`}
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
              className={`bouncy rounded-full px-4 py-2 text-sm font-extrabold ${p.h.identity_id === i.id ? 'bg-lavender text-white' : 'bg-soft text-muted'}`}>
              I am {i.name}
            </button>
          ))}
        </div>
      )}
      <Field label="Add a new identity: “I am…”" tip="identity">
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
    h.why && [h.type === 'break' ? 'Cost' : 'Why', h.why],
    h.temptation_bundle && ['Treat', h.temptation_bundle],
    h.two_min_version && ['2-min version', h.two_min_version],
    h.friction_plan && ['Make it hard', h.friction_plan],
  ].filter(Boolean) as [string, string][]
  return (
    <div className="rounded-3xl p-4" style={{ background: `${h.color}22` }}>
      <div className="mb-2 flex items-center gap-2 text-lg font-black"><span className="text-2xl">{h.emoji}</span>{h.name || 'Your habit'}</div>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 font-bold text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-2 text-xs font-semibold text-muted">Want to change something? Tap the dots at the top.</p>
    </div>
  )
}

/** How much counts as done: once, a number of times, or an amount like 2,400 ml in 800 ml bottles. */
function DailyGoal({ h, set }: { h: Habit; set: (p: Partial<Habit>) => void }) {
  const mode = isAmount(h) ? 'amount' : h.target_count > 1 ? 'times' : 'once'
  const setMode = (m: string) =>
    set(m === 'once' ? { target_count: 1, unit: '', step: 1, step_label: '' }
      : m === 'times' ? { target_count: Math.max(2, isAmount(h) ? 3 : h.target_count), unit: '', step: 1, step_label: '' }
      : { target_count: 2000, unit: 'ml', step: 500, step_label: 'bottle' })
  const presets = CONTAINERS[h.unit] ?? []
  return (
    <Field label="What counts as done each day?">
      <div className="space-y-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'once', label: 'Just do it' }, { value: 'times', label: 'Times a day' }, { value: 'amount', label: 'An amount' }]} />
        {mode === 'times' && <Stepper value={h.target_count} min={2} max={30} onChange={(target_count) => set({ target_count })} />}
        {mode === 'amount' && (
          <div className="space-y-3 rounded-2xl bg-soft p-3">
            <div>
              <div className="mb-1 text-xs font-bold text-muted">Daily goal</div>
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" min={1} value={h.target_count || ''} onChange={(e) => set({ target_count: Math.max(0, Number(e.target.value)) })} className="!w-1/2" />
                <select value={UNITS.includes(h.unit) ? h.unit : 'other'} onChange={(e) => set({ unit: e.target.value === 'other' ? 'times' : e.target.value })} className="!w-1/2">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value="other">other…</option>
                </select>
              </div>
              {!UNITS.includes(h.unit) && (
                <input className="mt-2" value={h.unit} onChange={(e) => set({ unit: e.target.value || 'times' })} placeholder="Your unit, e.g. push-ups" />
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-bold text-muted">One tap of + adds</div>
              <div className="flex gap-2">
                <input type="number" inputMode="decimal" min={1} value={h.step || ''} onChange={(e) => set({ step: Math.max(0, Number(e.target.value)) })} className="!w-1/2" />
                <input value={h.step_label} onChange={(e) => set({ step_label: e.target.value })} placeholder="name, e.g. bottle" className="!w-1/2" />
              </div>
              {presets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets.map((c) => (
                    <button key={`${c.label}${c.size}`} type="button" onClick={() => set({ step: c.size, step_label: c.label })}
                      className={`bouncy rounded-full px-3 py-1 text-xs font-extrabold ${h.step === c.size && h.step_label === c.label ? 'bg-sage text-white' : 'bg-card text-muted'}`}>
                      {c.label} {c.size} {h.unit}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {h.target_count > 0 && h.step > 0 && <p className="text-sm font-bold">= {goalBreakdown(h)} a day</p>}
          </div>
        )}
      </div>
    </Field>
  )
}
