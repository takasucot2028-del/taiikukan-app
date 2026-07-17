import { useState } from 'react'
import { format } from 'date-fns'
import { gasApi } from '../../lib/gasApi'
import { useAppStore } from '../../store'
import { RESERVATION_TIME_SLOTS as TIME_SLOTS, RESERVATION_FACILITY_GROUPS as FACILITY_GROUPS } from '../../lib/reservationOptions'
import { isAfterDeadline, formatDeadline } from '../../lib/deadline'
import type { TimeSlot, Facility } from '../../types'

interface Props {
  initialDate?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ReservationForm({ initialDate, onSuccess, onCancel }: Props) {
  const { selectedClub, currentYear, currentMonth } = useAppStore()
  const [date, setDate] = useState(initialDate ?? format(new Date(currentYear, currentMonth - 1, 1), 'yyyy-MM-dd'))
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('8:00〜11:00')
  const [facility, setFacility] = useState<Facility>('第1体育館（全面）')
  const [content, setContent] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) { setError('占有内容を入力してください'); return }
    setSubmitting(true)
    setError('')
    try {
      await gasApi.addReservation({ clubName: selectedClub, date, timeSlot, facility, content, comment })
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
        <label className="block text-sm font-medium text-gray-700 mb-1">申請クラブ</label>
        <input value={selectedClub} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isAfterDeadline(date) && (
          <p className="text-amber-600 text-xs mt-1">
            ⚠️ 申請締切（{formatDeadline(date)}）を過ぎています。送信はできますが、事務局にご連絡ください。
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">時間帯</label>
        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value as TimeSlot)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">占有施設</label>
        <select
          value={facility}
          onChange={(e) => setFacility(e.target.value as Facility)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {FACILITY_GROUPS.map((group) => (
            <optgroup key={group.label} label={`── ${group.label} ──`}>
              {group.options.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">占有内容 <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例：〇〇杯バスケットボール大会"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">管理者へのコメント（任意）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
        >
          {submitting ? '送信中...' : '申請する'}
        </button>
      </div>
    </form>
  )
}
