import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useReservations, useConfig } from '../hooks/useReservations'
import { MonthCalendar } from '../components/Calendar/MonthCalendar'
import { ListView } from '../components/Calendar/ListView'
import { isPushSupported, getPushPermissionState, requestPushPermission } from '../lib/pushNotification'

type Tab = 'calendar' | 'list'

const PUSH_DISMISSED_KEY = 'push-prompt-dismissed-session'

function PushPrompt({ clubName, onClose }: { clubName: string; onClose: () => void }) {
  const [requesting, setRequesting] = useState(false)

  const handleAllow = async () => {
    setRequesting(true)
    const ok = await requestPushPermission(clubName)
    if (ok) localStorage.setItem('push-subscribed', '1')
    sessionStorage.setItem(PUSH_DISMISSED_KEY, '1')
    setRequesting(false)
    onClose()
  }

  const handleLater = () => {
    sessionStorage.setItem(PUSH_DISMISSED_KEY, '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 shadow-xl">
        <p className="font-semibold text-gray-800 mb-1">予定更新の通知を受け取りますか？</p>
        <p className="text-sm text-gray-500 mb-4">
          管理者が予定表を確定したときやリマインドを通知します。
        </p>
        <div className="flex gap-3">
          <button onClick={handleLater}
            className="flex-1 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-600">
            後で
          </button>
          <button onClick={handleAllow} disabled={requesting}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
            {requesting ? '設定中...' : '許可する'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Home() {
  const navigate = useNavigate()
  const { selectedClub, setSelectedClub, currentYear, currentMonth, setCurrentMonth } = useAppStore()
  const { config, error: configError, loading: configLoading } = useConfig()
  const { reservations, refetch } = useReservations()
  const [tab, setTab] = useState<Tab>('calendar')
  const [filterMine, setFilterMine] = useState(false)
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  // プッシュ通知ダイアログ表示判定
  useEffect(() => {
    const supported = isPushSupported()
    const state = supported ? getPushPermissionState() : 'unsupported'
    const alreadySubscribed = !!localStorage.getItem('push-subscribed')
    const dismissedThisSession = !!sessionStorage.getItem(PUSH_DISMISSED_KEY)

    console.log('[Push] Notification permission:', state)
    console.log('[Push] ServiceWorker supported:', 'serviceWorker' in navigator)

    if (supported && state === 'default' && !alreadySubscribed && !dismissedThisSession) {
      // 少し遅らせて表示（UX改善）
      const timer = setTimeout(() => setShowPushPrompt(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleChangeClub = () => {
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
      {showPushPrompt && (
        <PushPrompt clubName={selectedClub} onClose={() => setShowPushPrompt(false)} />
      )}

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

      {/* 月間予定表 確定バッジ */}
      {reservations.some((r) => r.entryType === 'confirmed_month' && r.date.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)) && (
        <div className="bg-blue-600 text-white px-4 py-1.5 text-xs text-center font-medium">
          ✓ {currentMonth}月の予定表は確定済みです
        </div>
      )}

      {/* GASエラー表示 */}
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
