import { useState } from 'react'
import { format, parseISO, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Modal } from '../common/Modal'
import { ReservationForm } from '../Reservation/ReservationForm'
import type { Reservation, SlotEntry, AppConfig } from '../../types'
import { getDayType } from '../../lib/scheduleLogic'

/** 日タイプに応じた表示時間帯 */
function getRelevantTimeSlots(dateStr: string, config: AppConfig | null, schedule: SlotEntry[]): string[] {
  // スケジュールに存在する時間帯を優先
  const fromSchedule = [...new Set(schedule.map((s) => s.timeSlot))]
  if (fromSchedule.length > 0) return fromSchedule

  if (!config) {
    // config未取得時は曜日から判定
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
  const [showForm, setShowForm] = useState(false)
  const dateLabel = format(parseISO(date), 'M月d日（EEE）', { locale: ja })

  // 表示する時間帯を決定（スケジュール or 予約 or デフォルト）
  const reservationSlots = reservations.map((r) => r.timeSlot)
  const allSlots = getRelevantTimeSlots(date, config, schedule)
  const timeSlots = [...new Set([...allSlots, ...reservationSlots])]
    .sort((a, b) => a.localeCompare(b))

  if (showForm) {
    return (
      <Modal title="占有予約申請" onClose={onClose}>
        <ReservationForm
          initialDate={date}
          onSuccess={() => { setShowForm(false); onReservationAdded(); onClose() }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    )
  }

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-3">
        {timeSlots.map((slot) => {
          const slotSchedule = schedule.filter((s) => s.timeSlot === slot)
          const slotReservations = reservations.filter(
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

              {slotReservations.map((r) => (
                <div key={r.id} className={`text-sm px-2 py-1 rounded mb-1 font-medium ${
                  r.status === '確定'  ? 'bg-blue-100 text-blue-800' :
                  r.status === '却下'  ? 'bg-gray-100 text-gray-400 line-through' :
                                         'bg-yellow-100 text-yellow-800'
                }`}>
                  【占有】{r.clubName}：{r.facility}
                  <span className="ml-2 text-xs opacity-70">{r.status}</span>
                </div>
              ))}

              {slotSchedule.length === 0 && slotReservations.length === 0 && (
                <p className="text-sm text-gray-400">予定なし</p>
              )}
            </div>
          )
        })}

        <button
          onClick={() => setShowForm(true)}
          className="w-full mt-2 bg-blue-600 text-white rounded-lg py-3 font-medium"
        >
          ＋ 占有予約を申請する
        </button>
      </div>
    </Modal>
  )
}
