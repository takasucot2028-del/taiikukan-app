import { useState } from 'react'
import { gasApi } from '../../lib/gasApi'
import { useAppStore } from '../../store'
import type { Reservation } from '../../types'

const TIME_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

const FACILITIES = ['第1体育館', '第2体育館', '総合体育館', '第1・第2体育館', '全施設']

interface Props {
  date: string
  entry?: Reservation
  onSuccess: () => void
  onCancel: () => void
}

export function ScheduleEntryForm({ date, entry, onSuccess, onCancel }: Props) {
  const { selectedClub } = useAppStore()
  const [timeSlot, setTimeSlot] = useState(entry?.timeSlot ?? '8:00〜11:00')
  const [facility, setFacility] = useState(entry?.facility ?? '第1体育館')
  const [content, setContent] = useState(entry?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) { setError('活動内容を入力してください'); return }
    setSubmitting(true)
    setError('')
    try {
      if (entry) {
        await gasApi.updateReservation(entry.id, { timeSlot, facility, content })
      } else {
        await gasApi.addScheduleEntry({ clubName: selectedClub, date, timeSlot, facility, content })
      }
      onSuccess()
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">クラブ名</label>
        <input value={selectedClub} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">時間帯</label>
        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">使用施設</label>
        <select
          value={facility}
          onChange={(e) => setFacility(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {FACILITIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">活動内容 <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例：バスケットボール練習"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-lg py-3 font-medium"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-green-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {submitting ? '送信中...' : entry ? '更新する' : '追加する'}
        </button>
      </div>
    </form>
  )
}
