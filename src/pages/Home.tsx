import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useReservations, useConfig } from '../hooks/useReservations'
import { MonthCalendar } from '../components/Calendar/MonthCalendar'
import { ListView } from '../components/Calendar/ListView'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

type Tab = 'calendar' | 'list'

export function Home() {
  const navigate = useNavigate()
  const { selectedClub, setSelectedClub, currentYear, currentMonth, setCurrentMonth } = useAppStore()
  const config = useConfig()
  const { reservations, refetch } = useReservations()
  const [tab, setTab] = useState<Tab>('calendar')
  const [filterMine, setFilterMine] = useState(false)

  if (!config) return <LoadingSpinner />

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
            onClick={() => setSelectedClub('')}
            className="text-xs bg-blue-600 px-2 py-1 rounded"
          >
            クラブ変更
          </button>
        </div>
      </header>

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
      </div>

      {/* コンテンツ */}
      <main className="flex-1 p-3 max-w-lg mx-auto w-full">
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
