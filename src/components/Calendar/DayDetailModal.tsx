import { useState } from 'react'
import { format, parseISO, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Modal } from '../common/Modal'
import { ReservationForm } from '../Reservation/ReservationForm'
import { ScheduleEntryForm } from '../Reservation/ScheduleEntryForm'
import type { Reservation, SlotEntry, AppConfig } from '../../types'
import { getDayType } from '../../lib/scheduleLogic'
import { getClubColor } from '../../lib/clubColors'
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

function getDefaultTimeSlots(dateStr: string, config: AppConfig | null): string[] {
  if (!config) {
    const dow = getDay(new Date(dateStr + 'T00:00:00'))
    return (dow === 0 || dow === 6) ? ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00'] : ['16:00〜18:00']
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
  const [usingSlot, setUsingSlot] = useState<{ timeSlot: string; facility: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const dateLabel = format(parseISO(date), 'M月d日（EEE）', { locale: ja })

  const dayType = config ? getDayType(date, config).type : null
  const dow = getDay(new Date(date + 'T00:00:00'))
  const isWeekday = dayType
    ? (dayType === 'weekday' || dayType === 'schoolEvent')
    : (dow !== 0 && dow !== 6)
  const availableTimeSlots = isWeekday ? ['16:00〜18:00'] : ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

  const scheduleEntries = reservations.filter((r) => r.entryType === 'schedule')
  const deletedSlotEntries = reservations.filter((r) => r.entryType === 'deleted_slot')
  const reservationEntries = reservations.filter((r) => r.entryType === 'reservation')

  const defaultSlots = getDefaultTimeSlots(date, config)
  const scheduleSlots = [...new Set(schedule.map((s) => s.timeSlot))]
  const reservationSlots = reservations.map((r) => r.timeSlot)
  const timeSlots = sortSlots([...new Set([...defaultSlots, ...scheduleSlots, ...reservationSlots])])

  const handleDeleteFixedSlot = async (slot: string, facility: string, clubName: string) => {
    if (!window.confirm(`「${facility}：${clubName}」を空き枠にしますか？`)) return
    setBusy(true)
    try {
      await gasApi.deleteSlot({ clubName, date, timeSlot: slot, facility, deletedBy: selectedClub })
      onReservationAdded()
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const handleRestoreSlot = async (entry: Reservation) => {
    setBusy(true)
    try {
      await gasApi.restoreSlot(entry.id)
      onReservationAdded()
    } catch {
      alert('元に戻せませんでした。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteSchedule = async (entry: Reservation) => {
    if (!window.confirm(`「${entry.content}」を削除しますか？`)) return
    setBusy(true)
    try {
      await gasApi.deleteScheduleEntry(entry.id)
      onReservationAdded()
    } catch {
      alert('削除に失敗しました。')
    } finally {
      setBusy(false)
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
          availableTimeSlots={availableTimeSlots}
          onSuccess={() => { setShowScheduleForm(false); setEditingEntry(null); onReservationAdded(); onClose() }}
          onCancel={() => { setShowScheduleForm(false); setEditingEntry(null) }}
        />
      </Modal>
    )
  }

  if (usingSlot) {
    return (
      <Modal title="この枠を使用する" onClose={onClose}>
        <ScheduleEntryForm
          date={date}
          lockedSlot={usingSlot}
          onSuccess={() => { setUsingSlot(null); onReservationAdded(); onClose() }}
          onCancel={() => setUsingSlot(null)}
        />
      </Modal>
    )
  }

  return (
    <Modal title={dateLabel} onClose={onClose}>
      <div className="space-y-3">
        {timeSlots.map((slot) => {
          const fixedEntries = schedule.filter((s) => s.timeSlot === slot)
          const userScheduleForSlot = scheduleEntries.filter((r) => r.timeSlot === slot)
          const deletedSlotsForSlot = deletedSlotEntries.filter((r) => r.timeSlot === slot)
          const occupancyForSlot = reservationEntries.filter(
            (r) => r.timeSlot === slot || r.timeSlot === '終日'
          )

          // Collect facilities in order: fixed first, then extras from deleted/user-added
          const fixedFacilities = fixedEntries.map((s) => s.facility)
          const seen = new Set(fixedFacilities)
          const extraFacilities: string[] = []
          ;[...deletedSlotsForSlot, ...userScheduleForSlot].forEach((r) => {
            if (!seen.has(r.facility)) { extraFacilities.push(r.facility); seen.add(r.facility) }
          })
          const allFacilities = [...fixedFacilities, ...extraFacilities]

          return (
            <div key={slot} className="border rounded-lg p-3">
              <p className="text-sm font-semibold text-gray-600 mb-2">{slot}</p>

              {allFacilities.map((facility) => {
                const userEntry = userScheduleForSlot.find((r) => r.facility === facility)
                const deletedSlot = deletedSlotsForSlot.find((r) => r.facility === facility)
                const fixedEntry = fixedEntries.find((s) => s.facility === facility)

                if (userEntry) {
                  const uc = getClubColor(userEntry.clubName)
                  const isMyEntry = userEntry.clubName === selectedClub
                  return (
                    <div key={facility} className={`text-sm px-2 py-1.5 rounded mb-1 flex items-center justify-between gap-1 ${uc.bg} ${uc.text} ${isMyEntry ? 'border-l-4 border-current' : ''}`}>
                      <span className="flex-1 min-w-0 break-words">{facility}：{userEntry.clubName}（{userEntry.content}）</span>
                      {userEntry.clubName === selectedClub && (
                        <span className="flex gap-1 shrink-0">
                          <button disabled={busy} onClick={() => setEditingEntry(userEntry)}
                            className="text-xs bg-green-200 hover:bg-green-300 px-2 py-0.5 rounded disabled:opacity-50">編集</button>
                          <button disabled={busy} onClick={() => handleDeleteSchedule(userEntry)}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded disabled:opacity-50">削除</button>
                        </span>
                      )}
                    </div>
                  )
                }

                if (deletedSlot) {
                  const isMyDeletion = deletedSlot.comment === selectedClub
                  return (
                    <div key={facility} className="text-sm bg-gray-100 text-gray-500 px-2 py-1.5 rounded mb-1 flex items-center justify-between gap-1">
                      <span className="flex-1">{facility}：（空き）</span>
                      {isMyDeletion ? (
                        <button disabled={busy} onClick={() => handleRestoreSlot(deletedSlot)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded shrink-0 disabled:opacity-50">
                          ↩ 元に戻す
                        </button>
                      ) : (
                        <button disabled={busy} onClick={() => setUsingSlot({ timeSlot: slot, facility })}
                          className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-0.5 rounded shrink-0 disabled:opacity-50">
                          ＋ この枠を使用する
                        </button>
                      )}
                    </div>
                  )
                }

                if (fixedEntry) {
                  const fc = getClubColor(fixedEntry.clubName)
                  const isMyFixed = fixedEntry.clubName === selectedClub
                  return (
                    <div key={facility} className={`text-sm px-2 py-1.5 rounded mb-1 flex items-center justify-between gap-1 ${fc.bg} ${fc.text} ${isMyFixed ? 'border-l-4 border-current' : ''}`}>
                      <span className="flex-1">{facility}：{fixedEntry.clubName}</span>
                      <button disabled={busy} onClick={() => handleDeleteFixedSlot(slot, facility, fixedEntry.clubName)}
                        className="text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-0.5 rounded shrink-0 disabled:opacity-50">
                        🗑
                      </button>
                    </div>
                  )
                }

                return null
              })}

              {occupancyForSlot.map((r) => (
                <div key={r.id} className={`text-sm px-2 py-1.5 rounded mb-1 font-medium ${
                  r.status === '確定'  ? 'bg-blue-100 text-blue-800' :
                  r.status === '却下'  ? 'bg-gray-100 text-gray-400 line-through' :
                                         'bg-yellow-100 text-yellow-800'
                }`}>
                  【占有】{r.clubName}：{r.facility}
                  <span className="ml-2 text-xs opacity-70">{r.status}</span>
                </div>
              ))}

              {allFacilities.length === 0 && occupancyForSlot.length === 0 && (
                <p className="text-sm text-gray-400">予定なし</p>
              )}
            </div>
          )
        })}

        <button
          onClick={() => setShowScheduleForm(true)}
          className="w-full mt-2 bg-green-600 text-white rounded-lg py-3 font-medium"
        >
          ＋ 予定を追加する
        </button>

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
