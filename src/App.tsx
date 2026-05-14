import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import { SyncIndicator } from './components/common/SyncIndicator'
import { ClubSelect } from './pages/ClubSelect'
import { Home } from './pages/Home'
import { MyReservations } from './pages/MyReservations'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminReservations } from './pages/admin/AdminReservations'
import { AdminSettings } from './pages/admin/AdminSettings'
import { AdminSchedule } from './pages/admin/AdminSchedule'
import { AdminLogs } from './pages/admin/AdminLogs'
import { AdminNotifications } from './pages/admin/AdminNotifications'
import { PrintSchedule } from './pages/PrintSchedule'

function RootRedirect() {
  let selectedClub = ''

  // 新キー: taiikukan-app-storage（Zustand persist）
  try {
    const stored = localStorage.getItem('taiikukan-app-storage')
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { selectedClub?: string } }
      selectedClub = parsed?.state?.selectedClub ?? ''
    }
  } catch { /* ignore */ }

  // 旧キー: taiikukan-app（残留データがある場合の互換）
  if (!selectedClub) {
    try {
      const oldStored = localStorage.getItem('taiikukan-app')
      if (oldStored) {
        const parsed = JSON.parse(oldStored) as { state?: { selectedClub?: string }; selectedClub?: string }
        selectedClub = parsed?.state?.selectedClub ?? parsed?.selectedClub ?? ''
      }
    } catch { /* ignore */ }
  }

  console.log('[RootRedirect] selectedClub:', selectedClub)

  if (!selectedClub) return <Navigate to="/club-select" replace />
  return <Navigate to="/home" replace />
}

function RequireClub({ children }: { children: React.ReactNode }) {
  const { selectedClub } = useAppStore()
  if (!selectedClub) return <Navigate to="/club-select" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdminAuthenticated } = useAppStore()
  if (!isAdminAuthenticated) return <Navigate to="/admin" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <HashRouter>
      <SyncIndicator />
      <Routes>
        <Route path="/"             element={<RootRedirect />} />
        <Route path="/club-select"  element={<ClubSelect />} />
        <Route path="/home"         element={<RequireClub><Home /></RequireClub>} />
        <Route path="/my-reservations" element={<RequireClub><MyReservations /></RequireClub>} />

        <Route path="/admin"                 element={<AdminLogin />} />
        <Route path="/admin/dashboard"       element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/reservations"    element={<RequireAdmin><AdminReservations /></RequireAdmin>} />
        <Route path="/admin/settings"        element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="/admin/schedule"        element={<RequireAdmin><AdminSchedule /></RequireAdmin>} />
        <Route path="/admin/logs"            element={<RequireAdmin><AdminLogs /></RequireAdmin>} />
        <Route path="/admin/notifications"   element={<RequireAdmin><AdminNotifications /></RequireAdmin>} />

        <Route path="/print" element={<PrintSchedule />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
