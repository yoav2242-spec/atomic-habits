import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/ui'
import HabitDetail from './pages/HabitDetail'
import HabitForm from './pages/HabitForm'
import Habits from './pages/Habits'
import Identity from './pages/Identity'
import Scorecard from './pages/Scorecard'
import Settings from './pages/Settings'
import Stats from './pages/Stats'
import Tips from './pages/Tips'
import Today from './pages/Today'
import Workspace from './pages/Workspace'

export default function App() {
  return (
    <ToastProvider>
      {/* Hash links (#/habits) work on any static host, including GitHub Pages. */}
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="habits" element={<Habits />} />
            <Route path="habits/new" element={<HabitForm />} />
            <Route path="habits/:id" element={<HabitDetail />} />
            <Route path="habits/:id/edit" element={<HabitForm />} />
            <Route path="stats" element={<Stats />} />
            <Route path="identity" element={<Identity />} />
            <Route path="scorecard" element={<Scorecard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="workspace" element={<Workspace />} />
            <Route path="tips" element={<Tips />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
