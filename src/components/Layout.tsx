import { motion, MotionConfig } from 'motion/react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { formatDay, todayKey } from '../lib/dates'
import { usePrefs, useApplyPrefs } from '../lib/prefs'
import { useGoogleSync } from '../lib/gcal'
import { useReminderSync } from '../lib/reminders'
import { useThemeColors } from '../lib/rewards'
import { dayOffset, inSandbox, workspaceUnlocked } from '../lib/workspace'
import { Onboarding } from './Onboarding'
import { spring } from './ui'
import { WelcomeBack } from './WelcomeBack'

const tabs = [
  { to: '/', label: 'Today' },
  { to: '/habits', label: 'Habits' },
  { to: '/stats', label: 'Progress' },
  { to: '/identity', label: 'Me' },
  { to: '/settings', label: 'Settings' },
]

export function Layout() {
  useThemeColors()
  const prefs = usePrefs()
  useApplyPrefs(prefs)
  useReminderSync()
  useGoogleSync()
  const { pathname } = useLocation()
  // In the test copy the banner at the top already leads to the workspace.
  const showTools = workspaceUnlocked() && !inSandbox && pathname !== '/workspace'
  return (
    <MotionConfig reducedMotion={prefs.motion === 'calm' ? 'always' : 'user'}>
    <div className="relative mx-auto min-h-dvh max-w-md overflow-x-clip px-4 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {inSandbox && (
        <Link to="/workspace" className="tray mb-4 flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-bold text-muted">
          Test copy · today is {formatDay(todayKey(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          {dayOffset ? ` (+${dayOffset}d)` : ''}
        </Link>
      )}

      {/* Each screen springs in when you switch to it. */}
      <motion.div key={pathname} initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring}>
        <Outlet />
      </motion.div>

      <Onboarding />
      <WelcomeBack />

      {showTools && (
        <Link to="/workspace" aria-label="Test workspace"
          className="clay-sm bouncy fixed bottom-32 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-muted">
          <span className="text-[14px] font-black">Test</span>
        </Link>
      )}

      <nav className="clay fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-[28px] p-1">
        <div className="flex">
          {tabs.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} className="relative flex min-h-14 flex-1 items-center justify-center rounded-[22px]">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" transition={spring} className="puffy absolute inset-0 rounded-[22px] bg-sage" />}
                  <motion.span className={`relative text-[15px] font-black tracking-[-0.01em] ${isActive ? 'text-on-pastel' : 'text-muted'}`} animate={{ scale: isActive ? 1.04 : 1 }} transition={spring}>{label}</motion.span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
    </MotionConfig>
  )
}
