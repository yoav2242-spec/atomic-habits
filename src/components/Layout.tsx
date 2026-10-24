import { NavLink, Outlet } from 'react-router-dom'

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
  { to: '/identity', label: 'Identity', icon: 'identity' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function Layout() {
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500'
                }`
              }
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                {icons[t.icon]}
              </svg>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
