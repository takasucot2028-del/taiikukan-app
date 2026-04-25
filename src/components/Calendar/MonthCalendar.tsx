import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { DayDetailModal } from './DayDetailModal'
import { getDayType, getDaySchedule, getDayClubSummary } from '../../lib/scheduleLogic'
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
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(firstDay) })
  const startPadding = getDay(firstDay)

  const getDayBg = (dateStr: string): string => {
    const dow = getDay(new Date(dateStr + 'T00:00:00'))
    if (!config) {
      if (dow === 0) return 'bg-orange-50'
      if (dow === 6) return 'bg-sky-50'
      return 'bg-white'
    }
    const { type } = getDayType(dateStr, config)
    switch (type) {
      case 'holiday':     return 'bg-red-50'
      case 'schoolEvent': return 'bg-cyan-50'
      case 'saturday':    return 'bg-sky-50'
      case 'sunday':      return 'bg-orange-50'
      case 'longBreak':   return 'bg-green-50'
      default:            return 'bg-white'
    }
  }

  const prevMonth = () => month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1)
  const nextMonth = () => month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-2 text-xl rounded-lg hover:bg-gray-100">‹</button>
        <h2 className="text-lg font-bold">{format(firstDay, 'yyyy年M月', { locale: ja })}</h2>
        <button onClick={nextMonth} className="p-2 text-xl rounded-lg hover:bg-gray-100">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-medium py-1 ${
            i === 0 ? 'text-orange-500' : i === 6 ? 'text-sky-600' : 'text-gray-600'
          }`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-gray-50 min-h-[68px]" />
        ))}

        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const dow = getDay(day)

          // イベント名（祝日・学校行事）
          let eventLabel = ''
          if (config) {
            const { type, eventName } = getDayType(dateStr, config)
            if (eventName && (type === 'holiday' || type === 'schoolEvent')) {
              eventLabel = eventName
            }
          }

          // スケジュールクラブ名一覧（deleted_slot・schedule優先適用）
          const dayReservations = reservations.filter((r) => r.date === dateStr)
          const clubNames = config
            ? getDayClubSummary(dateStr, config, month, filterClub, dayReservations)
            : []

          // スマホ3件・PC5件
          const mobileMax = 3
          const pcMax = 5

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`${getDayBg(dateStr)} min-h-[68px] md:min-h-32 p-1 md:p-2 text-left flex flex-col overflow-hidden hover:brightness-95 active:brightness-90 transition-all`}
            >
              <span className={`text-sm md:text-base font-medium leading-tight shrink-0 ${
                dow === 0 ? 'text-orange-600' : dow === 6 ? 'text-sky-700' : 'text-gray-800'
              }`}>
                {format(day, 'd')}
              </span>

              {eventLabel && (
                <span className="text-[9px] md:text-xs text-gray-500 leading-tight truncate w-full mt-0.5 shrink-0">
                  {eventLabel}
                </span>
              )}

              {/* スマホ表示（md未満）: 3件まで */}
              <span className="md:hidden flex flex-col w-full overflow-hidden">
                {clubNames.slice(0, mobileMax).map((name, i) => (
                  <span key={i} className="text-[9px] text-gray-700 leading-tight truncate w-full mt-0.5">
                    {name}
                  </span>
                ))}
                {clubNames.length > mobileMax && (
                  <span className="text-[9px] text-gray-400 leading-tight mt-0.5">他{clubNames.length - mobileMax}件</span>
                )}
              </span>

              {/* PC表示（md以上）: 5件まで */}
              <span className="hidden md:flex flex-col w-full overflow-hidden">
                {clubNames.slice(0, pcMax).map((name, i) => (
                  <span key={i} className="text-xs text-gray-700 leading-tight truncate w-full mt-0.5">
                    {name}
                  </span>
                ))}
                {clubNames.length > pcMax && (
                  <span className="text-xs text-gray-400 leading-tight mt-0.5">他{clubNames.length - pcMax}件</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 border" />土曜</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border" />日曜</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border" />祝日</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-100 border" />学校行事</span>
      </div>

      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          reservations={reservations.filter((r) => r.date === selectedDate)}
          schedule={config ? getDaySchedule(selectedDate, config, month) : []}
          config={config}
          onClose={() => setSelectedDate(null)}
          onReservationAdded={onRefresh}
        />
      )}
    </div>
  )
}
