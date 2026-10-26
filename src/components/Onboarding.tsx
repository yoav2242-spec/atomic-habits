import { CircleCheck, Flame, Snowflake, Sprout } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bigCelebration } from '../lib/celebrate'
import { db, setMeta } from '../lib/db'
import { saveHabit } from '../lib/repo'
import { habitFromTemplate, TEMPLATES } from '../lib/templates'
import { Button } from './ui'

const SLIDES = [
  { icon: Sprout, title: 'Tiny habits, big change', body: 'Get just 1% better each day and in a year you are about 37 times better. This app helps you build small habits that add up.' },
  { icon: CircleCheck, title: 'Tap, earn, level up', body: 'Each day, tap a habit when you do it. You earn points, your level goes up, and every tap is a vote for the person you want to become.' },
  { icon: Flame, title: 'Keep the streak alive', body: "Do a habit several days in a row to grow a streak and earn badges. Busy day? Do the 2-minute version. It still counts." },
  { icon: Snowflake, title: 'Streak freezes', body: "Every 7 days in a row earns a freeze that saves your streak if you miss a day. But freezes can't be used two days in a row. Never miss twice!" },
]

/** First-run tour: four short cards, then pick starter habits with one tap. */
export function Onboarding() {
  const onboarded = useLiveQuery(() => db.meta.get('onboarded').then((m) => !!m), [], true)
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const navigate = useNavigate()
  if (onboarded) return null

  const finish = async (create: boolean) => {
    if (create) {
      let order = Date.now()
      for (const i of picked) await saveHabit(await habitFromTemplate(TEMPLATES[i], order++))
      if (picked.size) bigCelebration()
    }
    await setMeta('onboarded', '1')
    navigate(create && picked.size ? '/' : '/habits/new?own=1')
  }

  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const last = step === SLIDES.length

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {[...SLIDES, null].map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-7 bg-sage' : i < step ? 'w-2 bg-sage/60' : 'w-2 bg-line'}`} />
            ))}
          </div>
          {!last && <button onClick={() => setStep(SLIDES.length)} className="text-sm font-bold text-muted">Skip</button>}
        </div>

        {!last ? (
          <div key={step} className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
            <div className="clay mb-8 flex h-36 w-36 items-center justify-center rounded-[2.5rem]">
              <span className="puffy animate-pop flex h-20 w-20 items-center justify-center rounded-full bg-sage text-on-pastel">
                {(() => { const Icon = SLIDES[step].icon; return <Icon size={40} strokeWidth={2.2} aria-hidden /> })()}
              </span>
            </div>
            <h1 className="mb-3 text-3xl font-black tracking-tight">{SLIDES[step].title}</h1>
            <p className="text-lg font-semibold leading-relaxed text-muted">{SLIDES[step].body}</p>
          </div>
        ) : (
          <div className="animate-rise flex-1 pt-6">
            <h1 className="mb-1 text-3xl font-black tracking-tight">Pick your first habits</h1>
            <p className="mb-5 font-semibold text-muted">Choose 1 to 3. Fewer is better to start. You can change everything later.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {TEMPLATES.map((t, i) => (
                <button key={t.habit.name} onClick={() => toggle(i)}
                  className={`bouncy rounded-3xl border-2 p-3 text-left ${picked.has(i) ? 'border-transparent text-on-pastel' : 'border-line bg-card'}`}
                  style={picked.has(i) ? { background: t.habit.color } : undefined}>
                  <div className="text-2xl">{t.habit.emoji}</div>
                  <div className="mt-1 text-sm font-extrabold leading-tight">{t.habit.name}</div>
                  <div className={`text-xs font-semibold ${picked.has(i) ? 'text-on-pastel/70' : 'text-muted'}`}>
                    {t.habit.type === 'break' ? 'Break a bad habit' : `I am ${t.identity}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          {!last ? (
            <Button className="w-full text-lg" onClick={() => setStep(step + 1)}>{step === 0 ? "Let's go!" : 'Next'}</Button>
          ) : (
            <>
              <Button className="w-full text-lg" disabled={picked.size === 0} onClick={() => finish(true)}>
                Start with {picked.size || ''} habit{picked.size === 1 ? '' : 's'}
              </Button>
              <button onClick={() => finish(false)} className="w-full py-2 text-sm font-bold text-muted">I'll make my own</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
