import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../components/ui'
import { useScorecard } from '../lib/hooks'
import { deleteScorecardItem, newId, saveScorecardItem } from '../lib/repo'
import type { ScorecardItem } from '../lib/types'

const RATINGS: { value: ScorecardItem['rating']; label: string; on: string }[] = [
  { value: '+', label: '+', on: 'bg-emerald-500 text-white' },
  { value: '=', label: '=', on: 'bg-stone-500 text-white' },
  { value: '-', label: '−', on: 'bg-red-500 text-white' },
]

export default function Scorecard() {
  const items = useScorecard()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  if (!items) return null

  const add = async () => {
    if (!text.trim()) return
    await saveScorecardItem({ id: newId(), routine: text.trim(), rating: '=', sort_order: Date.now(), updated_at: '', deleted: false })
    setText('')
  }
  const count = (r: ScorecardItem['rating']) => items.filter((i) => i.rating === r).length

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm text-stone-500">‹ Back</button>
      <h1 className="text-3xl font-bold tracking-tight">Habits Scorecard</h1>
      <Card className="my-5 space-y-2 text-sm text-stone-600 dark:text-stone-300">
        <p>Many habits run on autopilot. The first step to changing them is noticing them.</p>
        <p>Write down what you do on a normal day, from waking up to going to bed. Then mark each one:</p>
        <p><b className="text-emerald-600">+</b> helps you become who you want to be · <b>=</b> neutral · <b className="text-red-600">−</b> works against you</p>
      </Card>

      <div className="mb-4 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Wake up, check phone" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add}>Add</Button>
      </div>

      <ol className="space-y-2">
        {items.map((item, n) => (
          <li key={item.id} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 pl-3 dark:border-stone-800 dark:bg-stone-900">
            <span className="w-5 text-xs text-stone-400">{n + 1}</span>
            <span className="min-w-0 flex-1">{item.routine}</span>
            {RATINGS.map((r) => (
              <button key={r.value} onClick={() => saveScorecardItem({ ...item, rating: r.value })}
                className={`h-9 w-9 rounded-lg font-bold ${item.rating === r.value ? r.on : 'bg-stone-100 text-stone-400 dark:bg-stone-800'}`}>
                {r.label}
              </button>
            ))}
            <button onClick={() => deleteScorecardItem(item)} className="px-2 text-stone-400" aria-label="Remove">×</button>
          </li>
        ))}
      </ol>

      {items.length > 0 && (
        <Card className="mt-5 text-sm">
          <p className="mb-1 font-medium">{count('+')} good · {count('=')} neutral · {count('-')} bad</p>
          <p className="text-stone-600 dark:text-stone-300">
            Next: pick one “−” and add it as a habit to break, or stack a new habit right after one of your “+” routines.
          </p>
        </Card>
      )}
    </div>
  )
}
