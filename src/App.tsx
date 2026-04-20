import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import { ClubSelect } from './pages/ClubSelect'
import { Home } from './pages/Home'
import { MyReservations } from './pages/MyReservations'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminReservations } from './pages/admin/AdminReservations'
import { AdminSettings } from './pages/admin/AdminSettings'

/** ルートアクセス時：クラブ選択済みなら /home、未選択なら /club-select */
function RootRedirect() {
  const { selectedClub } = useAppStore()
  return <Navigate to={selectedClub ? '/home' : '/club-select'} replace />
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
      <Routes>
        <Route path="/"             element={<RootRedirect />} />
        <Route path="/club-select"  element={<ClubSelect />} />
        <Route path="/home"         element={<RequireClub><Home /></RequireClub>} />
        <Route path="/my-reservations" element={<RequireClub><MyReservations /></RequireClub>} />

        <Route path="/admin"              element={<AdminLogin />} />
        <Route path="/admin/dashboard"    element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/reservations" element={<RequireAdmin><AdminReservations /></RequireAdmin>} />
        <Route path="/admin/settings"     element={<RequireAdmin><AdminSettings /></RequireAdmin>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
