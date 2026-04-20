import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Modal } from '../common/Modal'
import { ReservationForm } from '../Reservation/ReservationForm'
import type { Reservation, SlotEntry } from '../../types'

const TIME_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00', '16:00〜18:00']

interface Props {
  date: string
  reservations: Reservation[]
  schedule: SlotEntry[]
  onClose: () => void
  onReservationAdded: () => void
}

export function DayDetailModal({ date, reservations, schedule, onClose, onReservationAdded }: Props) {
  const [showForm, setShowForm] = useState(false)
  const dateLabel = format(parseISO(date), 'M月d日（EEE）', { locale: ja })

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
        {TIME_SLOTS.map((slot) => {
          const slotReservations = reservations.filter(
            (r) => r.timeSlot === slot || r.timeSlot === '終日'
          )
          const slotSchedule = schedule.filter((s) => s.timeSlot === slot)

          return (
            <div key={slot} className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-600 mb-2">{slot}</p>

              {/* ローテーション・固定スケジュール */}
              {slotSchedule.map((s, i) => (
                <div key={i} className="text-sm bg-gray-50 text-gray-700 px-2 py-1 rounded mb-1">
                  {s.facility}：{s.clubName}
                </div>
              ))}

              {/* 占有予約申請 */}
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
