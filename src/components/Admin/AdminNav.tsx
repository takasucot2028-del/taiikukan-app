import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store'

const NAV_ITEMS = [
  { label: 'ダッシュボード', path: '/admin/dashboard', icon: '🏠' },
  { label: '予約申請管理',   path: '/admin/reservations', icon: '📋' },
  { label: '月間予定表',     path: '/admin/schedule',    icon: '📅' },
  { label: '設定管理',       path: '/admin/settings',    icon: '⚙️' },
  { label: '通知管理',       path: '/admin/notifications', icon: '🔔' },
  { label: '変更履歴',       path: '/admin/logs',        icon: '📝' },
]

interface Props {
  title: string
}

export function AdminNav({ title }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAdminAuthenticated } = useAppStore()

  const handleLogout = () => {
    setAdminAuthenticated(false)
    navigate('/admin')
  }

  return (
    <>
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="text-xl">‹</button>
          <h1 className="font-bold">{title}</h1>
        </div>
        <button onClick={handleLogout} className="text-xs bg-blue-700 px-2 py-1 rounded">ログアウト</button>
      </header>
      <nav className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                location.pathname === item.path
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
