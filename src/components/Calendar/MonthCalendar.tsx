import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns'
import { ja } from 'date-fns/locale'
import { DayDetailModal } from './DayDetailModal'
import type { Reservation, AppConfig } from '../../types'

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

interface Props {
  year: number
  month: number
  reservations: Reservation[]
  config: AppConfig | null
  filterClub: string
  onMonthChange: (year: number, month: number) => void
  onRefresh: () => void
}

export function MonthCalendar({ year, month, reservations, config, filterClub, onMonthChange, onRefresh }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const firstDay = startOfMonth(new Date(year, month - 1))
  const lastDay = endOfMonth(firstDay)
  const days = eachDayOfInterval({ start: firstDay, end: lastDay })
  const startPadding = getDay(firstDay)

  const holidays = config?.holidays ?? []
  const schoolEvents = config?.schoolEvents ?? []

  const getDayClass = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dow = getDay(date)
    if (holidays.some((h) => h.date === dateStr)) return 'bg-red-100'
    if (schoolEvents.some((e) => e.date === dateStr)) return 'bg-cyan-100'
    if (dow === 0) return 'bg-orange-100'
    if (dow === 6) return 'bg-sky-100'
    return 'bg-white'
  }

  const getDayReservations = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return reservations.filter((r) =>
      r.date === dateStr && (filterClub === '' || r.clubName === filterClub)
    )
  }

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  return (
    <div>
      {/* ナビゲーション */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100">‹</button>
        <h2 className="text-lg font-bold">
          {format(firstDay, 'yyyy年M月', { locale: ja })}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100">›</button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-orange-500' : i === 6 ? 'text-sky-600' : 'text-gray-600'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-gray-50 min-h-[60px]" />
        ))}

        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dayReservations = getDayReservations(day)
          const confirmedCount = dayReservations.filter((r) => r.status === '確定').length
          const pendingCount = dayReservations.filter((r) => r.status === '申請中').length

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`${getDayClass(day)} min-h-[60px] p-1 text-left flex flex-col hover:brightness-95 transition-all ${!isSameMonth(day, firstDay) ? 'opacity-30' : ''}`}
            >
              <span className={`text-sm font-medium ${getDay(day) === 0 ? 'text-orange-600' : getDay(day) === 6 ? 'text-sky-700' : 'text-gray-800'}`}>
                {format(day, 'd')}
              </span>
              {confirmedCount > 0 && (
                <span className="text-xs bg-blue-600 text-white rounded px-1 mt-0.5">確{confirmedCount}</span>
              )}
              {pendingCount > 0 && (
                <span className="text-xs bg-yellow-500 text-white rounded px-1 mt-0.5">申{pendingCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border" />土曜</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border" />日曜</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border" />祝日</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-100 border" />学校行事</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600" />確定</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" />申請中</span>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          reservations={reservations.filter((r) => r.date === selectedDate)}
          onClose={() => setSelectedDate(null)}
          onReservationAdded={onRefresh}
        />
      )}
    </div>
  )
}
