import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { DayDetailModal } from './DayDetailModal'
import { getDayType, getDaySchedule, getDayClubSummary } from '../../lib/scheduleLogic'
import { getClubColor } from '../../lib/clubColors'
import { useAppStore } from '../../store'
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
  const { selectedClub } = useAppStore()

  const firstDay = startOfMonth(new Date(year, month - 1))
  const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(firstDay) })
  const startPadding = getDay(firstDay)

  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

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
  const goToday = () => onMonthChange(today.getFullYear(), today.getMonth() + 1)

  return (
    <div>
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <button onClick={prevMonth} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">
          ‹ 前月
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{format(firstDay, 'yyyy年M月', { locale: ja })}</h2>
          {!isCurrentMonth && (
            <button onClick={goToday} className="text-xs px-2 py-1 rounded border border-blue-400 text-blue-600 hover:bg-blue-50">
              今月
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600">
          翌月 ›
        </button>
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

          let eventLabel = ''
          if (config) {
            const { type, eventName } = getDayType(dateStr, config)
            if (eventName && (type === 'holiday' || type === 'schoolEvent')) {
              eventLabel = eventName
            }
          }

          const dayReservations = reservations.filter((r) => r.date === dateStr)
          const clubNames = config
            ? getDayClubSummary(dateStr, config, month, filterClub, dayReservations)
            : []

          const mobileMax = 3
          const pcMax = 5

          const ClubBadge = ({ name, className = '' }: { name: string; className?: string }) => {
            const c = getClubColor(name)
            const isMyClub = name === selectedClub
            return (
              <span className={`text-[9px] md:text-xs px-1 rounded-full leading-tight truncate w-full inline-block ${c.bg} ${c.text} ${isMyClub && !filterClub ? 'ring-2 ring-offset-1 ring-current' : ''} ${className}`}>
                {name}
              </span>
            )
          }

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

              {/* スマホ（md未満）: 3件まで */}
              <span className="md:hidden flex flex-col w-full overflow-hidden gap-0.5 mt-0.5">
                {clubNames.slice(0, mobileMax).map((name, i) => (
                  <ClubBadge key={i} name={name} />
                ))}
                {clubNames.length > mobileMax && (
                  <span className="text-[9px] text-gray-400 leading-tight">他{clubNames.length - mobileMax}件</span>
                )}
              </span>

              {/* PC（md以上）: 5件まで */}
              <span className="hidden md:flex flex-col w-full overflow-hidden gap-0.5 mt-0.5">
                {clubNames.slice(0, pcMax).map((name, i) => (
                  <ClubBadge key={i} name={name} />
                ))}
                {clubNames.length > pcMax && (
                  <span className="text-xs text-gray-400 leading-tight">他{clubNames.length - pcMax}件</span>
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
