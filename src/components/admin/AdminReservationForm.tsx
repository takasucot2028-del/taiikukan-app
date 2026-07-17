import { useState } from 'react'
import { gasApi } from '../../lib/gasApi'
import { RESERVATION_TIME_SLOTS, RESERVATION_FACILITY_GROUPS } from '../../lib/reservationOptions'
import { isAfterDeadline, formatDeadline } from '../../lib/deadline'
import type { Club, Facility, Reservation, ReservationStatus, TimeSlot } from '../../types'

const STATUS_OPTIONS: ReservationStatus[] = ['申請中', '確定', '却下']

interface Props {
  clubs: Club[]
  /** 指定時は編集モード、未指定なら新規追加モード */
  entry?: Reservation | null
  defaultDate: string
  onSaved: () => void
  onCancel: () => void
}

export function AdminReservationForm({ clubs, entry, defaultDate, onSaved, onCancel }: Props) {
  const isEdit = !!entry
  const [clubName, setClubName] = useState(entry?.clubName ?? clubs[0]?.name ?? '')
  const [date, setDate] = useState(entry?.date ?? defaultDate)
  const [timeSlot, setTimeSlot] = useState<TimeSlot>(entry?.timeSlot ?? '8:00〜11:00')
  const [facility, setFacility] = useState<string>(entry?.facility ?? '第1体育館（全面）')
  const [content, setContent] = useState(entry?.content ?? '')
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [status, setStatus] = useState<ReservationStatus>(entry?.status ?? '確定')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const late = isAfterDeadline(date)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubName) { setError('クラブを選択してください'); return }
    if (!content.trim()) { setError('占有内容を入力してください'); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit && entry) {
        await gasApi.updateReservation(entry.id, { date, timeSlot, facility, content, comment, status })
      } else {
        const { id } = await gasApi.addReservation({ clubName, date, timeSlot, facility, content, comment })
        // GAS の addReservation は occupancy を必ず「申請中」で作るため、別ステータス指定時は追従更新する
        if (status !== '申請中') await gasApi.updateStatus(id, status)
      }
      onSaved()
    } catch (err) {
      console.error('[AdminReservationForm] 保存エラー:', err)
      setError(isEdit ? '更新に失敗しました。' : '追加に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">申請クラブ</label>
        {isEdit ? (
          <>
            <input value={clubName} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600" />
            <p className="text-xs text-gray-400 mt-1">クラブ名は変更できません。別クラブの場合はこの申請を却下し、新規追加してください。</p>
          </>
        ) : (
          <select
            value={clubName}
            onChange={(e) => setClubName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {clubs.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
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
        {late && (
          <p className="text-amber-600 text-xs mt-1">
            ⚠️ 申請締切（{formatDeadline(date)}）を過ぎた日程です。事務局対応として登録します。
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
          {RESERVATION_TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">占有施設</label>
        <select
          value={facility}
          onChange={(e) => setFacility(e.target.value as Facility)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {RESERVATION_FACILITY_GROUPS.map((group) => (
            <optgroup key={group.label} label={`── ${group.label} ──`}>
              {group.options.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          占有内容 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="例：〇〇杯バスケットボール大会"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">コメント（任意）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="例：電話で申請を受け付け"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReservationStatus)}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 rounded-lg py-2.5 font-medium">
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
        >
          {saving ? '保存中...' : isEdit ? '更新する' : '追加する'}
        </button>
      </div>
    </form>
  )
}
