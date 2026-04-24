import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useReservations, useConfig } from '../hooks/useReservations'
import { MonthCalendar } from '../components/Calendar/MonthCalendar'
import { ListView } from '../components/Calendar/ListView'

type Tab = 'calendar' | 'list'

export function Home() {
  const navigate = useNavigate()
  const { selectedClub, setSelectedClub, currentYear, currentMonth, setCurrentMonth } = useAppStore()
  const { config, error: configError, loading: configLoading } = useConfig()
  const { reservations, refetch } = useReservations()
  const [tab, setTab] = useState<Tab>('calendar')
  const [filterMine, setFilterMine] = useState(false)

  const handleChangeClub = () => {
    // Zustand状態クリア + localStorage両方クリアして確実にリセット
    setSelectedClub('')
    try {
      const raw = localStorage.getItem('taiikukan-app-storage')
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { selectedClub?: string } }
        if (parsed.state) {
          parsed.state.selectedClub = ''
          localStorage.setItem('taiikukan-app-storage', JSON.stringify(parsed))
        }
      }
    } catch { /* ignore */ }
    navigate('/club-select', { replace: true })
  }

  const filterClub = filterMine ? selectedClub : ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold">体育館予約管理</h1>
          <p className="text-xs text-blue-200">{selectedClub}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/my-reservations')}
            className="text-xs bg-blue-600 px-2 py-1 rounded"
          >
            自分の予約
          </button>
          <button
            onClick={handleChangeClub}
            className="text-xs bg-blue-500 px-2 py-1 rounded border border-blue-300"
          >
            クラブ変更
          </button>
        </div>
      </header>

      {/* GASエラー表示（カレンダーはブロックしない） */}
      {configError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <p className="text-red-700 text-xs font-medium">⚠️ 設定データ取得エラー（F12のConsoleで詳細確認）</p>
          <p className="text-red-600 text-xs mt-0.5 break-all">{configError}</p>
        </div>
      )}
      {configLoading && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5">
          <p className="text-blue-600 text-xs">設定データを読み込み中...</p>
        </div>
      )}

      {/* タブ */}
      <div className="flex bg-white border-b">
        <button
          onClick={() => setTab('calendar')}
          className={`flex-1 py-2.5 text-sm font-medium ${tab === 'calendar' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
        >
          カレンダー
        </button>
        <button
          onClick={() => setTab('list')}
          className={`flex-1 py-2.5 text-sm font-medium ${tab === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'}`}
        >
          リスト
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white px-4 py-2 flex items-center gap-2 border-b">
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filterMine}
            onChange={(e) => setFilterMine(e.target.checked)}
            className="rounded"
          />
          自分のクラブのみ表示
        </label>
        {config && (
          <span className="ml-auto text-xs text-gray-400">
            クラブ{config.clubs.length}件 / 祝日{config.holidays.length}件
          </span>
        )}
      </div>

      {/* コンテンツ */}
      <main className="flex-1 p-3 max-w-lg md:max-w-5xl mx-auto w-full">
        {tab === 'calendar' ? (
          <MonthCalendar
            year={currentYear}
            month={currentMonth}
            reservations={reservations}
            config={config}
            filterClub={filterClub}
            onMonthChange={setCurrentMonth}
            onRefresh={refetch}
          />
        ) : (
          <ListView reservations={reservations} filterClub={filterClub} />
        )}
      </main>
    </div>
  )
}
