import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import { useReservations } from '../../hooks/useReservations'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export function AdminDashboard() {
  const navigate = useNavigate()
  const { setAdminAuthenticated, currentYear, currentMonth } = useAppStore()
  const { reservations } = useReservations()

  const thisMonth = reservations.filter((r) => {
    const d = new Date(r.date)
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth
  })
  const pending = thisMonth.filter((r) => r.status === '申請中')

  const deadline = new Date(currentYear, currentMonth - 1 + 1, 20)
  const today = new Date()
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const handleLogout = () => {
    setAdminAuthenticated(false)
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-lg">管理者ダッシュボード</h1>
        <button onClick={handleLogout} className="text-xs bg-blue-700 px-2 py-1 rounded">ログアウト</button>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-4">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500 mb-1">今月の申請数</p>
            <p className="text-3xl font-bold text-gray-800">{thisMonth.length}</p>
            <p className="text-xs text-gray-400 mt-1">{format(new Date(currentYear, currentMonth - 1), 'M月分', { locale: ja })}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500 mb-1">未処理の申請</p>
            <p className="text-3xl font-bold text-yellow-500">{pending.length}</p>
            <p className="text-xs text-gray-400 mt-1">要対応</p>
          </div>
        </div>

        {daysLeft > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-800">
              翌月予定表の申請締め切りまで <strong>{daysLeft}日</strong>
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {format(deadline, 'M月d日（EEE）', { locale: ja })} 締め切り
            </p>
          </div>
        )}

        {/* クイックリンク */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">メニュー</h2>
          {[
            { label: '予約申請管理', badge: pending.length, path: '/admin/reservations', icon: '📋' },
            { label: '設定管理', badge: 0, path: '/admin/settings', icon: '⚙️' },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full bg-white border rounded-xl px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-gray-800 font-medium">
                <span>{item.icon}</span>
                {item.label}
              </span>
              <div className="flex items-center gap-2">
                {item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{item.badge}</span>
                )}
                <span className="text-gray-400">›</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
