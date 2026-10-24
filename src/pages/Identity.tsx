import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, InfoTip, Modal, PageHeader, useConfirm, XPBar } from '../components/ui'
import { useProgress } from '../lib/progress'
import { createIdentity, deleteIdentity, saveIdentity } from '../lib/repo'
import { levelFor, votes } from '../lib/streaks'
import type { Identity as IdentityRow } from '../lib/types'

const COLORS = ['#a497d6', '#7fb69b', '#7eaed4', '#ee9f80', '#e3bd5f', '#e091a8']

export default function Identity() {
  const progress = useProgress()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<IdentityRow | null>(null)
  const [editName, setEditName] = useState('')
  const confirm = useConfirm()
  if (!progress) return null

  const add = async () => {
    if (!name.trim()) return
    await saveIdentity(createIdentity(name.trim()))
    setName('')
  }

  return (
    <div>
      <PageHeader title="Who I'm becoming" subtitle="Every habit is a vote for who you want to be." />
      <Card className="mb-5 text-sm font-semibold text-muted">
        Real change comes from changing who you believe you are. Each time you do a habit, you cast a vote for that person.
        Every identity has its own level, so you can watch it grow. <InfoTip tip="identity" className="align-middle" />
      </Card>

      <div className="space-y-3">
        {progress.identities.map((i, n) => {
          const linked = progress.habits.filter((p) => p.habit.identity_id === i.id)
          const pts = linked.reduce((sum, p) => sum + p.points, 0)
          const total = linked.reduce((sum, p) => sum + votes(p.habit, p.checkins, progress.today), 0)
          const lvl = levelFor(pts)
          const color = COLORS[n % COLORS.length]
          return (
            <Card key={i.id} className="animate-rise">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xl font-black">I am {i.name}</div>
                  <div className="text-sm font-semibold text-muted">{linked.length ? linked.map((p) => `${p.habit.emoji} ${p.habit.name}`).join(' · ') : 'No habits linked yet'}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-3xl font-black" style={{ color }}>{total}</div>
                  <div className="text-xs font-bold text-muted">votes</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-black text-white" style={{ background: color }}>Lv {lvl.level}</span>
                <div className="flex-1"><XPBar into={lvl.into} need={lvl.need} color={color} /></div>
              </div>
              <div className="mt-3 flex gap-4 text-sm font-bold">
                <button className="text-muted underline" onClick={() => { setEditing(i); setEditName(i.name) }}>Rename</button>
                <button className="text-rose underline" onClick={() => confirm.ask('Remove this identity?', "Your habits stay. They just won't be linked to it.", () => deleteIdentity(i))}>Remove</button>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-sm font-bold">Add an identity: “I am…”</div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. a healthy person" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button onClick={add}>Add</Button>
        </div>
      </div>

      <Link to="/scorecard" className="bouncy mt-8 block">
        <Card className="flex items-center justify-between">
          <div>
            <div className="font-black">📋 Habits Scorecard</div>
            <div className="text-sm font-semibold text-muted">List what you do each day, and track it with your progress so far.</div>
          </div>
          <span className="text-2xl text-muted">›</span>
        </Card>
      </Link>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Rename identity">
        <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
          <Button className="flex-1" onClick={async () => { if (editName.trim()) await saveIdentity({ ...editing!, name: editName.trim() }); setEditing(null) }}>Save</Button>
        </div>
      </Modal>
      {confirm.element}
    </div>
  )
}
