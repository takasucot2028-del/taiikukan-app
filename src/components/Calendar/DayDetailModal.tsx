import { useState } from 'react'
import { format, parseISO, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Modal } from '../common/Modal'
import { ReservationForm } from '../Reservation/ReservationForm'
import { ScheduleEntryForm } from '../Reservation/ScheduleEntryForm'
import type { Reservation, SlotEntry, AppConfig } from '../../types'
import { getDayType } from '../../lib/scheduleLogic'
import { gasApi } from '../../lib/gasApi'
import { useAppStore } from '../../store'

const SLOT_ORDER = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00', '16:00〜18:00', '終日']

function sortSlots(slots: string[]): string[] {
  return [...slots].sort((a, b) => {
    const ia = SLOT_ORDER.indexOf(a)
    const ib = SLOT_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

function getRelevantTimeSlots(dateStr: string, config: AppConfig | null, schedule: SlotEntry[]): string[] {
  const fromSchedule = [...new Set(schedule.map((s) => s.timeSlot))]
  if (fromSchedule.length > 0) return sortSlots(fromSchedule)

  if (!config) {
    const dow = getDay(new Date(dateStr + 'T00:00:00'))
    if (dow === 0 || dow === 6) return ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']
    return ['16:00〜18:00']
  }

  const { type } = getDayType(dateStr, config)
  if (type === 'weekday' || type === 'schoolEvent') return ['16:00〜18:00']
  return ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']
}

interface Props {
  date: string
  reservations: Reservation[]
  schedule: SlotEntry[]
  config: AppConfig | null
  onClose: () => void
  onReservationAdded: () => void
}

export function DayDetailModal({ date, reservations, schedule, config, onClose, onReservationAdded }: Props) {
  const { selectedClub } = useAppStore()
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Reservation | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const dateLabel = format(parseISO(date), 'M月d日（EEE）', { locale: ja })

  const dayType = config ? getDayType(date, config).type : null
  const dow = getDay(new Date(date + 'T00:00:00'))
  const isNonWeekday = dayType
    ? (dayType === 'saturday' || dayType === 'sunday' || dayType === 'holiday' || dayType === 'longBreak')
    : (dow === 0 || dow === 6)

  const reservationEntries = reservations.filter((r) => r.entryType !== 'schedule')
  const scheduleEntries = reservations.filter((r) => r.entryType === 'schedule')

  const allSlots = getRelevantTimeSlots(date, config, schedule)
  const allReservationSlots = reservations.map((r) => r.timeSlot)
  const timeSlots = sortSlots([...new Set([...allSlots, ...allReservationSlots])])

  const handleDelete = async (entry: Reservation) => {
    if (!window.confirm(`「${entry.content}」を削除しますか？`)) return
    setDeleting(entry.id)
    try {
      await gasApi.deleteScheduleEntry(entry.id)
      onReservationAdded()
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setDeleting(null)
    }
  }

  if (showReservationForm) {
    return (
      <Modal title="占有予約申請" onClose={onClose}>
        <ReservationForm
          initialDate={date}
          onSuccess={() => { setShowReservationForm(false); onReservationAdded(); onClose() }}
          onCancel={() => setShowReservationForm(false)}
        />
      </Modal>
    )
  }

  if (showScheduleForm || editingEntry) {
    return (
      <Modal title={editingEntry ? '予定を編集' : '予定を追加'} onClose={onClose}>
        <ScheduleEntryForm
          date={date}
          entry={editingEntry ?? undefined}
          onSuccess={() => { setShowScheduleForm(false); setEditingEntry(null); onReservationAdded(); onClose() }}
          onCancel={() => { setShowScheduleForm(false); setEditingEntry(null) }}
        />
      </Modal>
    )
  }

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-3">
        {timeSlots.map((slot) => {
          const slotSchedule = schedule.filter((s) => s.timeSlot === slot)
          const slotReservationEntries = reservationEntries.filter(
            (r) => r.timeSlot === slot || r.timeSlot === '終日'
          )
          const slotScheduleEntries = scheduleEntries.filter(
            (r) => r.timeSlot === slot || r.timeSlot === '終日'
          )
          return (
            <div key={slot} className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-600 mb-2">{slot}</p>

              {slotSchedule.map((s, i) => (
                <div key={i} className="text-sm bg-gray-50 text-gray-700 px-2 py-1 rounded mb-1">
                  {s.facility}：{s.clubName}
                </div>
              ))}

              {slotScheduleEntries.map((r) => (
                <div key={r.id} className="text-sm bg-green-50 text-green-800 px-2 py-1 rounded mb-1 flex items-center justify-between gap-1">
                  <span className="min-w-0 break-words">{r.facility}：{r.clubName}（{r.content}）</span>
                  {r.clubName === selectedClub && (
                    <span className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditingEntry(r)}
                        className="text-xs bg-green-200 hover:bg-green-300 px-2 py-0.5 rounded"
                      >編集</button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deleting === r.id}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded disabled:opacity-50"
                      >{deleting === r.id ? '...' : '削除'}</button>
                    </span>
                  )}
                </div>
              ))}

              {slotReservationEntries.map((r) => (
                <div key={r.id} className={`text-sm px-2 py-1 rounded mb-1 font-medium ${
                  r.status === '確定'  ? 'bg-blue-100 text-blue-800' :
                  r.status === '却下'  ? 'bg-gray-100 text-gray-400 line-through' :
                                         'bg-yellow-100 text-yellow-800'
                }`}>
                  【占有】{r.clubName}：{r.facility}
                  <span className="ml-2 text-xs opacity-70">{r.status}</span>
                </div>
              ))}

              {slotSchedule.length === 0 && slotScheduleEntries.length === 0 && slotReservationEntries.length === 0 && (
                <p className="text-sm text-gray-400">予定なし</p>
              )}
            </div>
          )
        })}

        {isNonWeekday && (
          <button
            onClick={() => setShowScheduleForm(true)}
            className="w-full mt-2 bg-green-600 text-white rounded-lg py-3 font-medium"
          >
            ＋ 予定を追加する
          </button>
        )}

        <button
          onClick={() => setShowReservationForm(true)}
          className="w-full mt-2 bg-blue-600 text-white rounded-lg py-3 font-medium"
        >
          ＋ 占有予約を申請する
        </button>
      </div>
    </Modal>
  )
}
