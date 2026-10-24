import { useLiveQuery } from 'dexie-react-hooks'
import { AlarmClock, Bell, BellOff, ChevronRight, Download, HardDriveDownload, Palette, Sparkles, Trash2, Upload, User, Vibrate } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonClass, Card, PageHeader, Segmented, Toggle, useConfirm, useToast } from '../components/ui'
import { clockAlarmUrl, isAndroid } from '../lib/alarm'
import { db, getMeta } from '../lib/db'
import { formatDay, todayKey } from '../lib/dates'
import { useHabits } from '../lib/hooks'
import { isInstalled, useInstallPrompt } from '../lib/install'
import { setPrefs, usePrefs } from '../lib/prefs'
import { disableNotifications, enableNotifications, notificationsOn, notificationsSupported, remindersReady } from '../lib/reminders'
import { exportBackup, importBackup } from '../lib/repo'
import { THEMES } from '../lib/rewards'
import { unlockWorkspace } from '../lib/workspace'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2.5 ml-1 text-[13px] font-extrabold uppercase tracking-wider text-muted">{title}</h2>
      <Card className="space-y-4 !p-5 text-sm font-semibold">{children}</Card>
    </section>
  )
}

/** One setting: icon, name, short explanation, and its control on the right (or below). */
function Row({ icon, title, hint, children, stacked }: { icon: ReactNode; title: string; hint?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={stacked ? 'space-y-3' : 'flex items-center gap-3'}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="clay-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold">{title}</span>
          {hint && <span className="block text-xs font-semibold text-muted">{hint}</span>}
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
        <Row icon={<User size={19} />} title="Your name" hint="Used in your greeting on Today" stacked>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setPrefs({ name: name.trim() })} placeholder="Your first name" maxLength={30} />
        </Row>
      </Section>

      <Section title="Look and feel">
        <Row icon={<Sparkles size={19} />} title="Light or dark" stacked>
          <Segmented value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[{ value: 'auto', label: 'Like my phone' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Row>
        <Link to="/rewards" className="block">
          <Row icon={<Palette size={19} />} title="Color theme" hint={`${theme.name} · unlock more by leveling up`}>
            <span className="puffy h-8 w-8 rounded-full" style={{ background: theme.accent }} />
            <ChevronRight size={18} className="text-muted" />
          </Row>
        </Link>
        <Row icon={<Sparkles size={19} />} title="Animations" hint="Calm turns off bouncing and confetti" stacked>
          <Segmented value={prefs.motion} onChange={(motion) => setPrefs({ motion })} options={[{ value: 'full', label: 'Bouncy' }, { value: 'calm', label: 'Calm' }]} />
        </Row>
        <Row icon={<Sparkles size={19} />} title="Confetti" hint="When you finish a habit or your day">
          <Toggle label="Confetti" on={prefs.confetti} onChange={(confetti) => setPrefs({ confetti })} />
        </Row>
        <Row icon={<Vibrate size={19} />} title="Vibration" hint="A little buzz when you tap">
          <Toggle label="Vibration" on={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
        </Row>
      </Section>

      <Section title="Reminders">
        {/* Notifications need the optional online reminder helper; without it, Clock alarms are the reminders. */}
        {remindersReady && (<>
        <Row icon={notifOn ? <Bell size={19} /> : <BellOff size={19} />} title="Notifications"
          hint={!notificationsSupported() ? 'Install the app to use notifications' : !remindersReady ? 'Almost ready: being set up' : notifOn ? 'On. Choose which habits remind you.' : 'A reminder at each habit’s time'}>
          <Toggle label="Notifications" on={notifOn} onChange={toggleNotifications} />
        </Row>
        {notifOn && (
          <p className="clay-in rounded-2xl p-3.5 text-xs font-semibold text-muted">
            Open a habit's ✏️ edit, go to "Make it obvious", and turn on "Remind me". You can give each habit its own vibration. Only
            reminder times leave your phone, never habit names or progress.
          </p>
        )}
        </>)}
        <Row icon={<AlarmClock size={19} />} title="Clock app alarms" hint="Pick your own sound for each habit" stacked>
          {timed.length === 0 ? (
            <p className="text-xs font-semibold text-muted">Give a habit a time (in its ✏️ edit, "Make it obvious") to add an alarm for it.</p>
          ) : (
            <ul className="space-y-2">
              {timed.map((h) => (
                <li key={h.id} className="clay-in flex items-center gap-3 rounded-2xl p-2.5 pl-3.5">
                  <span className="min-w-0 flex-1 truncate font-bold">{h.emoji} {h.name}</span>
                  <span className="font-black tabular-nums">{h.cue_time}</span>
                  {isAndroid() && <a href={clockAlarmUrl(h)!} className={buttonClass('secondary', '!min-h-10 !px-3 !py-1.5 text-xs')}>Add alarm</a>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs font-semibold text-muted">
            {isAndroid() ? '"Add alarm" opens your Clock app with the time and name filled in. Choose the sound and days there, then save.' : 'Open your Clock app and add an alarm at each time, named after the habit.'}
          </p>
        </Row>
      </Section>

      <Section title="Your data">
        <Row icon={<HardDriveDownload size={19} />} title="Saved on this phone only" hint={`Last backup: ${lastBackup ? formatDay(lastBackup.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'}${persisted ? ' · protected from cleanup' : ''}`} stacked>
          <div className="flex gap-2">
            <Button onClick={backup} className="flex-1 gap-2"><Download size={17} /> Save backup</Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()} className="flex-1 gap-2"><Upload size={17} /> Restore</Button>
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
        </Row>
        <Row icon={<Trash2 size={19} />} title="Delete everything" hint="Start fresh. Save a backup first.">
          <Button variant="danger" className="!min-h-10 !px-3 !py-1.5 text-xs"
            onClick={() => confirm.ask('Delete everything?', 'All habits, history, points and settings on this phone will be erased. This cannot be undone.', async () => { await db.delete(); location.hash = '#/'; location.reload() })}>
            Delete
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
        <div className="space-y-1.5 pt-1 text-[13px]">
          <p><b>1. Make it obvious.</b> Pick a time and place, and stack it after something you already do.</p>
          <p><b>2. Make it attractive.</b> Pair it with something you enjoy.</p>
          <p><b>3. Make it easy.</b> Start with a 2-minute version.</p>
          <p><b>4. Make it satisfying.</b> Track it, and never miss twice.</p>
          <p className="text-muted">Ideas from <i>Atomic Habits</i> by James Clear.</p>
        </div>
      </Section>

      {/* Tapping the version 7 times opens the private test workspace on this device. */}
      <button
        className="w-full py-3 text-center text-xs font-bold text-muted"
        onClick={() => {
          const n = taps + 1
          setTaps(n)
          if (n >= 7) {
            unlockWorkspace()
            navigate('/workspace')
          }
        }}
      >
        Atomic v4{taps >= 3 && taps < 7 ? ` · ${7 - taps}` : ''}
      </button>
      {confirm.element}
    </div>
  )
}
