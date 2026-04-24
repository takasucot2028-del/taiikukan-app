import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isValid } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAppStore } from '../../store'
import { useReservations, useConfig } from '../../hooks/useReservations'
import { gasApi } from '../../lib/gasApi'
import { AdminNav } from '../../components/admin/AdminNav'
import type { Reservation, ReservationStatus } from '../../types'

const STATUS_OPTIONS: ReservationStatus[] = ['申請中', '確定', '却下']

const STATUS_CLASS: Record<string, string> = {
  '確定': 'bg-blue-100 text-blue-800',
  '申請中': 'bg-yellow-100 text-yellow-800',
  '却下': 'bg-gray-100 text-gray-500',
}

function safeDateFormat(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    if (!isValid(d)) return dateStr
    return format(d, 'M月d日（EEE）', { locale: ja })
  } catch {
    return dateStr
  }
}

function isConflict(r: Reservation, all: Reservation[]) {
  if (!r.facility || !r.timeSlot) return false
  return all.some(
    (other) =>
      other.id !== r.id &&
      other.entryType === 'reservation' &&
      other.date === r.date &&
      other.facility === r.facility &&
      (other.timeSlot === r.timeSlot || other.timeSlot === '終日' || r.timeSlot === '終日') &&
      other.status !== '却下'
  )
}

export function AdminReservations() {
  const navigate = useNavigate()
  const configResult = useConfig()
  const config = configResult?.config
  const { currentYear, currentMonth } = useAppStore()
  const { reservations: allReservations, refetch } = useReservations()

  // 占有申請のみ表示（schedule/deleted_slot/confirmed_monthは除外）
  const reservations = useMemo(() => {
    const filtered = (allReservations ?? []).filter((r) => r.entryType === 'reservation')
    console.log('[AdminReservations] 全データ件数:', allReservations?.length, '/ 占有申請件数:', filtered.length)
    return filtered
  }, [allReservations])

  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClub, setFilterClub] = useState<string>('all')
  const [adminMemoTarget, setAdminMemoTarget] = useState<Reservation | null>(null)
  const [memoText, setMemoText] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterClub !== 'all' && r.clubName !== filterClub) return false
      return true
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [reservations, filterStatus, filterClub])

  const handleStatus = async (id: string, status: ReservationStatus) => {
    setSaving(true)
    try {
      await gasApi.updateStatus(id, status)
      refetch()
    } catch (e) {
      console.error('[AdminReservations] ステータス更新エラー:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleMemoSave = async () => {
    if (!adminMemoTarget) return
    setSaving(true)
    try {
      await gasApi.updateStatus(adminMemoTarget.id, adminMemoTarget.status, memoText)
      setAdminMemoTarget(null)
      refetch()
    } catch (e) {
      console.error('[AdminReservations] メモ保存エラー:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="予約申請管理" />

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
          {(config?.clubs ?? []).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400 self-center">
          {currentYear}年{currentMonth}月 / {filtered.length}件
        </span>
      </div>

      <main className="p-3 max-w-2xl mx-auto space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white border rounded-xl p-8 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-gray-600 font-medium">現在申請はありません</p>
            <p className="text-sm text-gray-400 mt-1">
              {filterStatus !== 'all' || filterClub !== 'all'
                ? 'フィルター条件に一致する申請がありません'
                : `${currentYear}年${currentMonth}月の占有予約申請が届くとここに表示されます`}
            </p>
          </div>
        )}

        {filtered.map((r) => {
          let conflict = false
          try { conflict = isConflict(r, reservations) } catch { /* ignore */ }

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
                  <p className="font-semibold text-gray-800">{safeDateFormat(r.date)}</p>
                  <p className="text-sm text-gray-600">{r.clubName}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {r.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-0.5">{r.facility} | {r.timeSlot}</p>
              <p className="text-sm text-gray-600 mb-1">{r.content}</p>
              {r.comment && <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">コメント：{r.comment}</p>}
              {r.adminMemo && <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded mt-1">管理者メモ：{r.adminMemo}</p>}

              <div className="flex gap-2 mt-3 flex-wrap">
                {r.status !== '確定' && (
                  <button onClick={() => handleStatus(r.id, '確定')} disabled={saving}
                    className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 disabled:opacity-50">確定</button>
                )}
                {r.status !== '却下' && (
                  <button onClick={() => handleStatus(r.id, '却下')} disabled={saving}
                    className="text-xs bg-red-500 text-white rounded px-3 py-1.5 disabled:opacity-50">却下</button>
                )}
                {r.status !== '申請中' && (
                  <button onClick={() => handleStatus(r.id, '申請中')} disabled={saving}
                    className="text-xs border border-gray-400 text-gray-600 rounded px-3 py-1.5 disabled:opacity-50">申請中に戻す</button>
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
            <h3 className="font-bold mb-1">管理者メモ</h3>
            <p className="text-xs text-gray-500 mb-2">{safeDateFormat(adminMemoTarget.date)} / {adminMemoTarget.clubName}</p>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-3">
              <button onClick={() => setAdminMemoTarget(null)} className="flex-1 border rounded py-2">キャンセル</button>
              <button onClick={handleMemoSave} disabled={saving}
                className="flex-1 bg-blue-600 text-white rounded py-2 disabled:opacity-50">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
