import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { formatDay, todayKey } from '../lib/dates'
import { dayOffset, inSandbox, workspaceUnlocked } from '../lib/workspace'
import { Onboarding } from './Onboarding'

const icons = {
  today: <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  habits: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  stats: <path d="M6 20V13M12 20V5M18 20v-9" />,
  identity: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0" />,
  settings: <path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M15 4v4M9 10v4M17 16v4" />,
}

const tabs: { to: string; label: string; icon: keyof typeof icons }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/habits', label: 'Habits', icon: 'habits' },
  { to: '/stats', label: 'Progress', icon: 'stats' },
  { to: '/identity', label: 'Me', icon: 'identity' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function Layout() {
  const { pathname } = useLocation()
  const showTools = workspaceUnlocked() && pathname !== '/workspace'
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {inSandbox && (
        <Link to="/workspace" className="mb-3 flex items-center justify-center gap-1.5 rounded-full bg-butter/25 px-3 py-1.5 text-xs font-extrabold">
          🧪 Test copy · today is {formatDay(todayKey(), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          {dayOffset ? ` (+${dayOffset}d)` : ''}
        </Link>
      )}
      <Outlet />
      <Onboarding />
      {showTools && (
        <Link to="/workspace" aria-label="Test workspace"
          className="bouncy fixed bottom-28 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-xl shadow-lg">
          🛠
        </Link>
      )}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md rounded-3xl border border-line bg-card/90 px-1 shadow-[0_8px_30px_-10px_rgba(50,50,80,0.35)] backdrop-blur">
        <div className="flex">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `bouncy flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-extrabold ${isActive ? 'text-sage-deep dark:text-sage' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${isActive ? 'bg-sage/20' : ''}`}>
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      {icons[t.icon]}
                    </svg>
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
