import { useState } from 'react'
import { format } from 'date-fns'
import { gasApi } from '../../lib/gasApi'
import { useAppStore } from '../../store'
import type { TimeSlot, Facility } from '../../types'

const TIME_SLOTS: TimeSlot[] = [
  '8:00〜11:00',
  '11:00〜14:00',
  '14:00〜17:00',
  '16:00〜18:00',
  '終日',
]

const FACILITY_GROUPS: { label: string; options: Facility[] }[] = [
  {
    label: '第1体育館',
    options: ['第1体育館（全面）', '第1体育館 半面A', '第1体育館 半面B', '第1体育館 ステージ'],
  },
  {
    label: '第2体育館',
    options: ['第2体育館（全面）'],
  },
  {
    label: '総合体育館',
    options: ['総合体育館（全面）', '総合体育館 半面A', '総合体育館 半面B'],
  },
]

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

  const isLateDeadline = () => {
    const d = new Date(date)
    const nextMonth = new Date()
    nextMonth.setDate(20)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return d > nextMonth
  }

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
        {isLateDeadline() && (
          <p className="text-amber-600 text-xs mt-1">⚠️ 翌月20日を過ぎた日程の申請です。管理者に確認してください。</p>
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
