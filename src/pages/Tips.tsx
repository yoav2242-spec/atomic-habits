import { useEffect } from 'react'
import { markFlag } from '../components/Quests'
import { todayKey } from '../lib/dates'
import { BackButton, Card } from '../components/ui'
import { TIP_GROUPS } from '../lib/dailyTips'

export default function Tips() {
  useEffect(() => {
    markFlag(todayKey(), 'read_tip')
  }, [])
  return (
    <div>
      <BackButton className="mb-2" />
      <h1 className="text-3xl font-black tracking-tight">Tips</h1>
      <p className="mb-5 font-semibold text-muted">Small ideas that make habits stick. A new one shows on your Today screen every day.</p>
      <div className="space-y-4">
        {TIP_GROUPS.map((g) => (
          <Card key={g.title} className="animate-rise">
            <div className="mb-3 text-lg font-black">{g.title}</div>
            <ul className="space-y-2.5">
              {g.tips.map((t) => (
                <li key={t} className="flex gap-2 text-sm font-semibold leading-relaxed">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sage" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}
