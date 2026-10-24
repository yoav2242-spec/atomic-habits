import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Modal, PageHeader, useConfirm } from '../components/ui'
import { useCheckinsByHabit, useHabits, useIdentities, useToday } from '../lib/hooks'
import { createIdentity, deleteIdentity, saveIdentity } from '../lib/repo'
import { votes } from '../lib/streaks'
import type { Identity as IdentityRow } from '../lib/types'

export default function Identity() {
  const today = useToday()
  const identities = useIdentities()
  const habits = useHabits()
  const all = useCheckinsByHabit()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<IdentityRow | null>(null)
  const [editName, setEditName] = useState('')
  const confirm = useConfirm()
  if (!identities || !habits || !all) return null

  const add = async () => {
    if (!name.trim()) return
    await saveIdentity(createIdentity(name.trim()))
    setName('')
  }

  return (
    <div>
      <PageHeader title="Identity" subtitle="Who you're becoming, one vote at a time." />
      <Card className="mb-5 text-sm text-stone-600 dark:text-stone-300">
        Lasting change comes from changing who you believe you are. Every time you do a habit, you cast a vote for that kind of
        person. You don't need every vote, just most of them.
      </Card>

      <div className="space-y-3">
        {identities.map((i) => {
          const linked = habits.filter((h) => h.identity_id === i.id)
          const total = linked.reduce((n, h) => n + votes(h, all.get(h.id) ?? [], today), 0)
          return (
            <Card key={i.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">I am {i.name}</div>
                  <div className="text-sm text-stone-500">{linked.length ? linked.map((h) => `${h.emoji} ${h.name}`).join(' · ') : 'No habits linked yet'}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{total}</div>
                  <div className="text-xs text-stone-500">votes</div>
                </div>
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <button className="text-stone-500 underline" onClick={() => { setEditing(i); setEditName(i.name) }}>Rename</button>
                <button className="text-red-600 underline" onClick={() => confirm.ask('Remove this identity?', 'Your habits stay; they just won\'t be linked to it.', () => deleteIdentity(i))}>Remove</button>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-medium">Add an identity: “I am…”</label>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. a healthy person" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Button onClick={add}>Add</Button>
        </div>
      </div>

      <Link to="/scorecard" className="mt-8 block">
        <Card className="flex items-center justify-between">
          <div>
            <div className="font-semibold">📋 Habits Scorecard</div>
            <div className="text-sm text-stone-500">List what you do each day and see which habits help you.</div>
          </div>
          <span className="text-stone-400">›</span>
        </Card>
      </Link>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Rename identity">
        <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={async () => { if (editName.trim()) await saveIdentity({ ...editing!, name: editName.trim() }); setEditing(null) }}>Save</Button>
        </div>
      </Modal>
      {confirm.element}
    </div>
  )
}
