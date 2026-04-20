import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAppStore } from '../store'
import { useReservations } from '../hooks/useReservations'
import { gasApi } from '../lib/gasApi'
import { Modal } from '../components/common/Modal'
import { ReservationForm } from '../components/Reservation/ReservationForm'
import type { Reservation } from '../types'

const STATUS_CLASS: Record<string, string> = {
  '確定': 'bg-blue-100 text-blue-800',
  '申請中': 'bg-yellow-100 text-yellow-800',
  '却下': 'bg-gray-100 text-gray-500',
}

export function MyReservations() {
  const navigate = useNavigate()
  const { selectedClub } = useAppStore()
  const { reservations, refetch } = useReservations()
  const [editTarget, setEditTarget] = useState<Reservation | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)

  const mine = reservations.filter((r) => r.clubName === selectedClub)
  const sorted = [...mine].sort((a, b) => b.date.localeCompare(a.date))

  const handleCancel = async () => {
    if (!cancelTarget) return
    await gasApi.cancelReservation(cancelTarget.id)
    setCancelTarget(null)
    refetch()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-xl">‹</button>
        <div>
          <h1 className="font-bold">自分の予約一覧</h1>
          <p className="text-xs text-blue-200">{selectedClub}</p>
        </div>
      </header>

      <main className="flex-1 p-3 max-w-lg mx-auto w-full space-y-3">
        {sorted.length === 0 && (
          <p className="text-center text-gray-400 py-12">申請した予約はありません</p>
        )}

        {sorted.map((r) => (
          <div key={r.id} className="bg-white border rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <span className="font-semibold text-gray-800">
                {format(parseISO(r.date), 'yyyy年M月d日（EEE）', { locale: ja })}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status] ?? ''}`}>
                {r.status}
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-0.5">{r.facility} | {r.timeSlot}</p>
            <p className="text-sm text-gray-600 mb-2">{r.content}</p>
            {r.adminMemo && (
              <p className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded mb-2">管理者メモ：{r.adminMemo}</p>
            )}

            {r.status === '確定' ? (
              <p className="text-xs text-gray-400">確定済みの予約の変更は管理者にご連絡ください。</p>
            ) : r.status === '申請中' ? (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setEditTarget(r)}
                  className="flex-1 text-sm border border-blue-500 text-blue-600 rounded py-1.5"
                >
                  編集
                </button>
                <button
                  onClick={() => setCancelTarget(r)}
                  className="flex-1 text-sm border border-red-400 text-red-500 rounded py-1.5"
                >
                  取り消し
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </main>

      {editTarget && (
        <Modal title="予約を編集" onClose={() => setEditTarget(null)}>
          <ReservationForm
            initialDate={editTarget.date}
            onSuccess={() => { setEditTarget(null); refetch() }}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {cancelTarget && (
        <Modal title="予約の取り消し" onClose={() => setCancelTarget(null)}>
          <p className="text-sm text-gray-700 mb-4">
            以下の予約を取り消しますか？
            <br />
            <strong>{format(parseISO(cancelTarget.date), 'M月d日', { locale: ja })}</strong>
            　{cancelTarget.facility} | {cancelTarget.timeSlot}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setCancelTarget(null)} className="flex-1 border rounded py-2">戻る</button>
            <button onClick={handleCancel} className="flex-1 bg-red-500 text-white rounded py-2">取り消す</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
