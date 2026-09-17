import { useState } from 'react'
import { format } from 'date-fns'
import { gasApi, describeSaveError } from '../../lib/gasApi'
import { addPendingSubmission, hasPendingSubmission } from '../../lib/pendingSubmissions'
import { useAppStore } from '../../store'
import { RESERVATION_TIME_SLOTS as TIME_SLOTS, RESERVATION_FACILITY_GROUPS as FACILITY_GROUPS } from '../../lib/reservationOptions'
import { isAfterDeadline, formatDeadline } from '../../lib/deadline'
import { getConfirmedOccupancies, findOccupancy } from '../../lib/occupancy'
import type { TimeSlot, Facility } from '../../types'

interface Props {
  initialDate?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ReservationForm({ initialDate, onSuccess, onCancel }: Props) {
  const { selectedClub, currentYear, currentMonth, reservations: allReservations } = useAppStore()
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

    // 既に確定済みの占有が入っている枠は二重に申請できない（全面占有は半面も対象）
    const blocking = findOccupancy(timeSlot, facility, getConfirmedOccupancies(date, allReservations))
    if (blocking) {
      setError(`この枠は既に「${blocking.clubName}」の占有予約（${blocking.facility} / ${blocking.timeSlot}）が確定しています。事務局にご相談ください。`)
      return
    }
    // 同じ日時・施設の自クラブの申請が既にある（または送信済みで反映確認中）なら、二重申請にならないよう確認する
    const slot = { clubName: selectedClub, date, timeSlot, facility }
    const alreadyApplied = allReservations.some((r) =>
      r.entryType === 'reservation' && r.status !== '却下' &&
      r.clubName === slot.clubName && r.date === slot.date && r.timeSlot === slot.timeSlot && r.facility === slot.facility)
    if ((alreadyApplied || hasPendingSubmission(slot)) &&
      !window.confirm('同じ日時・施設の申請をすでに送信しています。もう一度送信すると二重申請になります。送信しますか？')) {
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const result = await gasApi.addReservation({ clubName: selectedClub, date, timeSlot, facility, content, comment })
      if (result.unconfirmed) {
        // GASでは受け付け済みだが結果を受け取れなかった。一覧に出るまで端末に記録して二重申請を防ぐ
        addPendingSubmission({ ...slot, content })
        useAppStore.getState().setSyncNotice('申請を受け付けました。通信が不安定なため、「自分の予約」への反映に時間がかかる場合があります。二重に申請しないでください。')
      }
      onSuccess()
    } catch (e) {
      setError(describeSaveError(e, '申請'))
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
