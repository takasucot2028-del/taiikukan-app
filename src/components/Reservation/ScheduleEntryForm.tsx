import { useState } from 'react'
import { gasApi } from '../../lib/gasApi'
import { useAppStore } from '../../store'
import type { Reservation } from '../../types'

const DEFAULT_TIME_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

const FACILITY_GROUPS = [
  { label: '第1体育館', options: ['第1体育館（全面）', '第1体育館 半面A', '第1体育館 半面B', '第1体育館 ステージ'] },
  { label: '第2体育館', options: ['第2体育館（全面）'] },
  { label: '総合体育館', options: ['総合体育館（全面）', '総合体育館 半面A', '総合体育館 半面B'] },
]
const ALL_FACILITIES = FACILITY_GROUPS.flatMap((g) => g.options)

interface Props {
  date: string
  entry?: Reservation
  availableTimeSlots?: string[]
  lockedSlot?: { timeSlot: string; facility: string }
  onSuccess: () => void
  onCancel: () => void
  onSaved?: () => void
}

export function ScheduleEntryForm({ date, entry, availableTimeSlots, lockedSlot, onSuccess, onCancel, onSaved }: Props) {
  const { selectedClub, reservations: allReservations, setReservations, setBgSyncing, setSyncError } = useAppStore()
  const slots = availableTimeSlots ?? DEFAULT_TIME_SLOTS

  const [timeSlot, setTimeSlot] = useState(lockedSlot?.timeSlot ?? entry?.timeSlot ?? slots[0])
  const [facility, setFacility] = useState(lockedSlot?.facility ?? entry?.facility ?? ALL_FACILITIES[0])
  const [content, setContent] = useState(entry?.content ?? '')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) { setError('活動内容を入力してください'); return }
    setError('')

    if (entry) {
      // 編集：楽観的更新してすぐにフォームを閉じる
      const prev = allReservations
      setReservations(allReservations.map(r =>
        r.id === entry.id ? { ...r, timeSlot: timeSlot as Reservation['timeSlot'], facility, content } : r
      ))
      onSuccess()
      setBgSyncing(true)
      try {
        await gasApi.updateReservation(entry.id, { timeSlot, facility, content })
        onSaved?.()
      } catch {
        setReservations(prev)
        setSyncError('更新に失敗しました。')
      } finally {
        setBgSyncing(false)
      }
    } else {
      // 新規追加：仮エントリをストアに追加してすぐに閉じる
      const tempId = 'temp_' + Date.now()
      const tempEntry: Reservation = {
        id: tempId,
        clubName: selectedClub,
        date,
        timeSlot: timeSlot as Reservation['timeSlot'],
        facility,
        content,
        comment: '',
        status: '確定',
        adminMemo: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entryType: 'schedule',
      }
      setReservations([...allReservations, tempEntry])
      onSuccess()
      setBgSyncing(true)
      try {
        const result = await gasApi.addScheduleEntry({ clubName: selectedClub, date, timeSlot, facility, content })
        // 仮IDを正式IDに置換（アンマウント後もストアから直接操作）
        const cur = useAppStore.getState().reservations
        useAppStore.getState().setReservations(cur.map(r => r.id === tempId ? { ...r, id: result.id } : r))
        onSaved?.()
      } catch {
        const cur = useAppStore.getState().reservations
        useAppStore.getState().setReservations(cur.filter(r => r.id !== tempId))
        setSyncError('追加に失敗しました。')
      } finally {
        setBgSyncing(false)
      }
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
        {lockedSlot ? (
          <input value={timeSlot} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600" />
        ) : (
          <select
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {slots.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">使用施設</label>
        {lockedSlot ? (
          <input value={facility} disabled className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-600" />
        ) : (
          <select
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {FACILITY_GROUPS.map((group) => (
              <optgroup key={group.label} label={`── ${group.label} ──`}>
                {group.options.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
            ))}
          </select>
        )}
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
          className="flex-1 bg-green-600 text-white rounded-lg py-3 font-medium"
        >
          {entry ? '更新する' : '追加する'}
        </button>
      </div>
    </form>
  )
}
