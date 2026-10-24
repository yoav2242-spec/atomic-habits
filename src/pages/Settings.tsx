import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Button, Card, PageHeader, useToast } from '../components/ui'
import { getMeta } from '../lib/db'
import { formatDay, todayKey } from '../lib/dates'
import { useHabits } from '../lib/hooks'
import { isInstalled, useInstallPrompt } from '../lib/install'
import { exportBackup, importBackup } from '../lib/repo'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
      <Card className="space-y-3 text-sm">{children}</Card>
    </section>
  )
}

export default function Settings() {
  const install = useInstallPrompt()
  const habits = useHabits()
  const lastBackup = useLiveQuery(() => getMeta('last_backup'))
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const backup = async () => {
    const json = await exportBackup()
    const name = `atomic-backup-${todayKey()}.json`
    const file = new File([json], name, { type: 'application/json' })
    // On a phone, offer the share sheet (Drive, Gmail, WhatsApp…); otherwise download.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Atomic backup' })
        return toast('Backup ready')
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Backup saved to Downloads')
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      const n = await importBackup(await file.text())
      toast(`Restored ${n} items`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read that file')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const timed = (habits ?? []).filter((h) => !h.archived && h.cue_time).sort((a, b) => a.cue_time!.localeCompare(b.cue_time!))

  return (
    <div>
      <PageHeader title="Settings" />

      <Section title="Put it on your home screen">
        {isInstalled() ? (
          <p>✅ Installed. Open Atomic from its icon on your home screen. It works without internet.</p>
        ) : install ? (
          <>
            <p>Add Atomic to your home screen so it opens like a normal app.</p>
            <Button onClick={install} className="w-full">Install app</Button>
          </>
        ) : (
          <p>In Chrome, tap the <b>⋮</b> menu (top right), then <b>Add to Home screen</b> or <b>Install app</b>.</p>
        )}
      </Section>

      <Section title="Your data">
        <p>
          Your habits are saved <b>only on this phone</b>. Nothing is sent anywhere.
          {persisted && ' The phone has agreed to keep this data safe and not clear it to save space.'}
        </p>
        <p>
          If you lose or reset your phone, the data is gone, so save a backup now and then. Send it to yourself by email or
          save it to Google Drive.
        </p>
        <p className="text-stone-500">Last backup: {lastBackup ? formatDay(lastBackup.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'}</p>
        <div className="flex gap-2">
          <Button onClick={backup} className="flex-1">Save backup</Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()} className="flex-1">Restore</Button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
      </Section>

      <Section title="Reminders">
        <p>
          The simplest reliable reminder is an alarm. Open your phone's <b>Clock</b> app, add an alarm at the habit's time, and
          name it with your plan, like “Read 10 pages in bedroom”.
        </p>
        {timed.length > 0 && (
          <ul className="space-y-1">
            {timed.map((h) => (
              <li key={h.id} className="flex justify-between">
                <span>{h.emoji} {h.name}{h.location && ` in ${h.location}`}</span>
                <span className="font-medium tabular-nums">{h.cue_time}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="The 4 laws, in short">
        <p><b>1. Make it obvious.</b> Pick a time and place, and stack it after something you already do.</p>
        <p><b>2. Make it attractive.</b> Pair it with something you enjoy.</p>
        <p><b>3. Make it easy.</b> Start with a 2-minute version.</p>
        <p><b>4. Make it satisfying.</b> Track it, and never miss twice.</p>
        <p className="text-stone-500">To break a bad habit, flip them: make it invisible, unattractive, difficult and unsatisfying.</p>
        <p className="text-stone-500">Ideas from <i>Atomic Habits</i> by James Clear.</p>
      </Section>
    </div>
  )
}
