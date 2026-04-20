import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAppStore } from '../../store'
import { useReservations, useConfig } from '../../hooks/useReservations'
import { gasApi } from '../../lib/gasApi'
import type { Reservation, ReservationStatus } from '../../types'

const STATUS_OPTIONS: ReservationStatus[] = ['申請中', '確定', '却下']

const STATUS_CLASS: Record<string, string> = {
  '確定': 'bg-blue-100 text-blue-800',
  '申請中': 'bg-yellow-100 text-yellow-800',
  '却下': 'bg-gray-100 text-gray-500',
}

function isConflict(r: Reservation, all: Reservation[]) {
  return all.some(
    (other) =>
      other.id !== r.id &&
      other.date === r.date &&
      other.facility === r.facility &&
      (other.timeSlot === r.timeSlot || other.timeSlot === '終日' || r.timeSlot === '終日') &&
      other.status !== '却下'
  )
}

export function AdminReservations() {
  const navigate = useNavigate()
  const config = useConfig()
  const { currentYear, currentMonth } = useAppStore()
  const { reservations, refetch } = useReservations()

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClub, setFilterClub] = useState<string>('all')
  const [adminMemoTarget, setAdminMemoTarget] = useState<Reservation | null>(null)
  const [memoText, setMemoText] = useState('')

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterClub !== 'all' && r.clubName !== filterClub) return false
      return true
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [reservations, filterStatus, filterClub])

  const handleStatus = async (id: string, status: ReservationStatus) => {
    await gasApi.updateStatus(id, status)
    refetch()
  }

  const handleMemoSave = async () => {
    if (!adminMemoTarget) return
    await gasApi.updateStatus(adminMemoTarget.id, adminMemoTarget.status, memoText)
    setAdminMemoTarget(null)
    refetch()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/admin/dashboard')} className="text-xl">‹</button>
        <h1 className="font-bold">予約申請管理</h1>
        <span className="ml-auto text-sm">
          {currentYear}年{currentMonth}月
        </span>
      </header>

      {/* フィルター */}
      <div className="bg-white border-b px-4 py-3 flex gap-2 overflow-x-auto">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">全ステータス</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterClub}
          onChange={(e) => setFilterClub(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="all">全クラブ</option>
          {config?.clubs.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      <main className="p-3 max-w-2xl mx-auto space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12">申請がありません</p>
        )}

        {filtered.map((r) => {
          const conflict = isConflict(r, reservations)
          return (
            <div
              key={r.id}
              className={`bg-white border rounded-xl p-4 shadow-sm ${conflict ? 'border-red-400 bg-red-50' : ''}`}
            >
              {conflict && (
                <div className="text-xs text-red-600 font-bold mb-2">⚠️ 同日・同施設・同時間帯に競合あり</div>
              )}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {format(parseISO(r.date), 'M月d日（EEE）', { locale: ja })}
                  </p>
                  <p className="text-sm text-gray-600">{r.clubName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status] ?? ''}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-0.5">{r.facility} | {r.timeSlot}</p>
              <p className="text-sm text-gray-600 mb-1">{r.content}</p>
              {r.comment && <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">コメント：{r.comment}</p>}
              {r.adminMemo && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded mt-1">管理者メモ：{r.adminMemo}</p>}

              {/* ステータス変更ボタン */}
              <div className="flex gap-2 mt-3">
                {r.status !== '確定' && (
                  <button
                    onClick={() => handleStatus(r.id, '確定')}
                    className="text-xs bg-blue-600 text-white rounded px-3 py-1.5"
                  >
                    確定
                  </button>
                )}
                {r.status !== '却下' && (
                  <button
                    onClick={() => handleStatus(r.id, '却下')}
                    className="text-xs bg-red-500 text-white rounded px-3 py-1.5"
                  >
                    却下
                  </button>
                )}
                {r.status !== '申請中' && (
                  <button
                    onClick={() => handleStatus(r.id, '申請中')}
                    className="text-xs border border-gray-400 text-gray-600 rounded px-3 py-1.5"
                  >
                    申請中に戻す
                  </button>
                )}
                <button
                  onClick={() => { setAdminMemoTarget(r); setMemoText(r.adminMemo ?? '') }}
                  className="text-xs border border-gray-300 text-gray-600 rounded px-3 py-1.5 ml-auto"
                >
                  メモ編集
                </button>
              </div>
            </div>
          )
        })}
      </main>

      {/* メモ編集モーダル */}
      {adminMemoTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-4">
            <h3 className="font-bold mb-3">管理者メモ</h3>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => setAdminMemoTarget(null)} className="flex-1 border rounded py-2">キャンセル</button>
              <button onClick={handleMemoSave} className="flex-1 bg-blue-600 text-white rounded py-2">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
