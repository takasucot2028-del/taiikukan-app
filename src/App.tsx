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
import { AdminApplicationForm } from './pages/admin/AdminApplicationForm'
import { PrintSchedule } from './pages/PrintSchedule'

function RootRedirect() {
  let selectedClub = ''
  try {
    const stored = localStorage.getItem('taiikukan-app-storage')
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { selectedClub?: string } }
      selectedClub = parsed?.state?.selectedClub ?? ''
    }
  } catch (e) {
    console.error('[RootRedirect] parse error:', e)
  }

  console.log('[RootRedirect] 実行されました selectedClub:', selectedClub)

  return selectedClub
    ? <Navigate to="/home" replace />
    : <Navigate to="/club-select" replace />
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
        <Route path="/"                element={<RootRedirect />} />
        <Route path="/club-select"     element={<ClubSelect />} />
        <Route path="/home"            element={<Home />} />
        <Route path="/my-reservations" element={<MyReservations />} />

        <Route path="/admin"                 element={<AdminLogin />} />
        <Route path="/admin/dashboard"       element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/reservations"    element={<RequireAdmin><AdminReservations /></RequireAdmin>} />
        <Route path="/admin/settings"        element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
        <Route path="/admin/schedule"        element={<RequireAdmin><AdminSchedule /></RequireAdmin>} />
        <Route path="/admin/logs"            element={<RequireAdmin><AdminLogs /></RequireAdmin>} />
        <Route path="/admin/notifications"    element={<RequireAdmin><AdminNotifications /></RequireAdmin>} />
        <Route path="/admin/application-form" element={<RequireAdmin><AdminApplicationForm /></RequireAdmin>} />

        <Route path="/print" element={<PrintSchedule />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
