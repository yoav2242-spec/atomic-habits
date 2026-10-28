import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonClass, Card, Chevron, PageHeader, Segmented, Toggle, useConfirm, useToast } from '../components/ui'
import { clockAlarmUrl, isAndroid } from '../lib/alarm'
import { db, getMeta } from '../lib/db'
import { formatDay, todayKey } from '../lib/dates'
import { useHabits } from '../lib/hooks'
import { isInstalled, useInstallPrompt } from '../lib/install'
import { setPrefs, usePrefs } from '../lib/prefs'
import { disableNotifications, enableNotifications, notificationsOn, notificationsSupported, remindersReady } from '../lib/reminders'
import { exportBackup, importBackup, saveHabit, startOver } from '../lib/repo'
import { THEMES } from '../lib/rewards'
import { useGoogleStatus } from '../lib/gcal'
import { GoogleCalendarCard } from '../components/GoogleCalendarCard'
import { unlockWorkspace } from '../lib/workspace'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="label mb-2.5 ml-1">{title}</h2>
      <Card className="space-y-4 !p-5 text-sm font-semibold">{children}</Card>
    </section>
  )
}

/** One setting: icon, name, short explanation, and its control on the right (or below). */
function Row({ title, hint, children, stacked }: { title: string; hint?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={stacked ? 'space-y-3' : 'flex items-center gap-3'}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="min-w-0">
          <span className="block text-[16px] font-extrabold">{title}</span>
          {hint && <span className="block text-[14px] font-semibold text-muted">{hint}</span>}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const install = useInstallPrompt()
  const habits = useHabits()
  const prefs = usePrefs()
  const google = useGoogleStatus()
  const themeId = useLiveQuery(() => getMeta('theme'), [], 'sage')
  const lastBackup = useLiveQuery(() => getMeta('last_backup'))
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [notifOn, setNotifOn] = useState(false)
  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [taps, setTaps] = useState(0)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
    notificationsOn().then(setNotifOn)
  }, [])
  useEffect(() => setName(prefs.name), [prefs.name])
  // Save the name a moment after typing stops.
  useEffect(() => {
    if (name.trim() === prefs.name) return
    const t = setTimeout(() => setPrefs({ name: name.trim() }), 600)
    return () => clearTimeout(t)
  }, [name]) // eslint-disable-line react-hooks/exhaustive-deps

  const backup = async () => {
    const json = await exportBackup()
    const fileName = `atomic-backup-${todayKey()}.json`
    const file = new File([json], fileName, { type: 'application/json' })
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
    a.download = fileName
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

  const toggleNotifications = async (on: boolean) => {
    if (!on) {
      await disableNotifications()
      setNotifOn(false)
      return toast('Notifications off')
    }
    const result = await enableNotifications()
    setNotifOn(result === 'ok')
    toast({
      ok: 'Notifications on. Turn on "Remind me" for each habit.',
      denied: 'Notifications are blocked. Allow them in your phone settings for this app.',
      unsupported: "This browser can't show notifications. Install the app first.",
      'not-ready': 'Notifications are almost ready.',
      error: "Couldn't turn on notifications. Try again in a moment.",
    }[result])
  }

  const timed = (habits ?? []).filter((h) => !h.archived && h.type === 'build' && h.cue_time).sort((a, b) => a.cue_time!.localeCompare(b.cue_time!))
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <div>
      <PageHeader title="Settings" />

      <Section title="You">
        <Row title="Your name" stacked>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setPrefs({ name: name.trim() })} placeholder="Your first name" maxLength={30} />
        </Row>
      </Section>

      <Section title="Look and feel">
        <Row title="Light or dark" stacked>
          <Segmented value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Row>
        <Link to="/rewards" className="block">
          <Row title="Color theme" hint={theme.name}>
            <span className="puffy h-8 w-8 rounded-full" style={{ background: theme.accent }} />
            <Chevron className="text-muted" />
          </Row>
        </Link>
        <Row title="Animations" stacked>
          <Segmented value={prefs.motion} calm={prefs.motion === 'calm'} onChange={(motion) => setPrefs({ motion })} options={[{ value: 'full', label: 'Bouncy' }, { value: 'calm', label: 'Calm' }]} />
        </Row>
        <Row title="Confetti">
          <Toggle label="Confetti" on={prefs.confetti} onChange={(confetti) => setPrefs({ confetti })} />
        </Row>
        <Row title="Vibration">
          <Toggle label="Vibration" on={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
        </Row>
      </Section>

      <Section title="Reminders">
        {/* Notifications need the optional online reminder helper; without it, Clock alarms are the reminders. */}
        {remindersReady && (<>
        <Row title="Notifications"
          hint={!notificationsSupported() ? 'Install the app to use notifications' : !remindersReady ? 'Almost ready: being set up' : notifOn ? 'On. Choose which habits remind you.' : 'A reminder at each habit’s time'}>
          <Toggle label="Notifications" on={notifOn} onChange={toggleNotifications} />
        </Row>
        {notifOn && (
          <p className="tray rounded-2xl p-3.5 text-[14px] font-semibold text-muted">
            Turn on "Remind me" in a habit's Edit page.
          </p>
        )}
        </>)}
        <GoogleCalendarCard />
        <Row title="Alarms and calendar" stacked>
          {timed.length === 0 ? (
            <p className="text-[14px] font-semibold text-muted">Give a habit a time to add an alarm.</p>
          ) : (
            <ul className="space-y-2">
              {timed.map((h) => (
                <li key={h.id} className="tray space-y-2.5 rounded-[20px] p-3">
                  <div className="flex items-center gap-3 px-0.5">
                    <span className="min-w-0 flex-1 truncate font-bold">{h.emoji} {h.name}</span>
                    <span className="font-black tabular-nums">{h.cue_time}</span>
                  </div>
                  <div className="flex gap-2">
                    {isAndroid() && <a href={clockAlarmUrl(h)!} className={buttonClass('secondary', 'flex-1 !min-h-11 gap-1.5 !px-3 !py-1.5 text-sm')}>Alarm</a>}
                    {google?.on && (
                      <button onClick={() => saveHabit({ ...h, calendar: !h.calendar })} aria-pressed={h.calendar}
                        className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-extrabold ${h.calendar ? 'puffy bg-sky text-on-pastel' : 'clay-sm text-muted'}`}>
                        {h.calendar ? 'In calendar' : 'Not in calendar'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Row>
      </Section>

      <Section title="Your data">
        <Row title="Saved on this phone only" hint={`Last backup: ${lastBackup ? formatDay(lastBackup.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'}${persisted ? ' · protected from cleanup' : ''}`} stacked>
          <div className="flex gap-2">
            <Button onClick={backup} className="flex-1 gap-2">Back up</Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} className="flex-1 gap-2">Restore</Button>
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
        </Row>
        <Row title="Start over" hint="Deletes all habits, points and levels">
          <Button variant="danger" className="!min-h-11 !px-4 !py-1.5 text-sm"
            onClick={() => confirm.ask('Start over?', 'All your habits, history, points and levels will be deleted, and you go back to level 1. Your settings stay. This cannot be undone.', async () => { await startOver(); navigate('/', { replace: true }); toast('Fresh start') })}>
            Start over
          </Button>
        </Row>
      </Section>

      {!isInstalled() && (
        <Section title="Put it on your home screen">
          {install ? (
            <>
              <p>Add Atomic to your home screen so it opens like a normal app.</p>
              <Button onClick={install} className="w-full">Install app</Button>
            </>
          ) : (
            <p>In Chrome, tap the <b>⋮</b> menu (top right), then <b>Add to Home screen</b> or <b>Install app</b>.</p>
          )}
        </Section>
      )}

      <Section title="Help">
        <Button variant="secondary" className="w-full" onClick={() => db.meta.delete('onboarded')}>Show the welcome tour again</Button>
        <Button variant="secondary" className="w-full" onClick={() => navigate('/tips')}>Read all the tips</Button>
      </Section>

      {/* Tapping the version 7 times opens the private test workspace on this device. */}
      <button
        className="w-full py-3 text-center text-[14px] font-bold text-muted"
        onClick={() => {
          const n = taps + 1
          setTaps(n)
          if (n >= 7) {
            unlockWorkspace()
            navigate('/workspace')
          }
        }}
      >
        Atomic v5 · updated {new Date(__APP_BUILT__).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{taps >= 3 && taps < 7 ? ` · ${7 - taps}` : ''}
      </button>
      {confirm.element}
    </div>
  )
}
