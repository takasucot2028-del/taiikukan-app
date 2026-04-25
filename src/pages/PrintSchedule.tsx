import { useMemo } from 'react'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAppStore } from '../store'
import { useReservations, useConfig } from '../hooks/useReservations'
import { getDayType, getDaySchedule } from '../lib/scheduleLogic'
import { getClubColor } from '../lib/clubColors'
import type { Reservation } from '../types'

const FACILITIES = [
  '第1体育館 半面A',
  '第1体育館 半面B',
  '第1体育館（全面）',
  '第1体育館 ステージ',
  '第2体育館（全面）',
  '総合体育館 半面A',
  '総合体育館 半面B',
]

const FACILITY_SHORT: Record<string, string> = {
  '第1体育館 半面A':    '第1\n半面A',
  '第1体育館 半面B':    '第1\n半面B',
  '第1体育館（全面）':  '第1\n全面',
  '第1体育館 ステージ': '第1\nステージ',
  '第2体育館（全面）':  '第2\n全面',
  '総合体育館 半面A':   '総合\n半面A',
  '総合体育館 半面B':   '総合\n半面B',
}

const DAY_TYPE_LABEL: Record<string, string> = {
  weekday:     '平日',
  saturday:    '土曜',
  sunday:      '日曜',
  holiday:     '祝日',
  schoolEvent: '学校行事',
  longBreak:   '長期休業',
}

function rowBg(type: string): string {
  switch (type) {
    case 'saturday':    return 'bg-sky-50'
    case 'sunday':      return 'bg-orange-50'
    case 'holiday':     return 'bg-red-50'
    case 'schoolEvent': return 'bg-cyan-50'
    default:            return 'bg-white'
  }
}

interface DayRow {
  dateStr: string
  dateLabel: string
  dow: string
  type: string
  eventName: string
  timeSlot: string
  facilities: Record<string, string>
  isFirstRow: boolean
  rowSpan: number
}

export function PrintSchedule() {
  const { currentYear, currentMonth } = useAppStore()
  const { config } = useConfig()
  const { reservations } = useReservations()

  const rows = useMemo<DayRow[]>(() => {
    if (!config) return []

    const firstDay = startOfMonth(new Date(currentYear, currentMonth - 1))
    const days = eachDayOfInterval({ start: firstDay, end: endOfMonth(firstDay) })
    const result: DayRow[] = []

    days.forEach((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const { type, eventName } = getDayType(dateStr, config)
      const dow = format(day, 'EEE', { locale: ja })
      const dateLabel = format(day, 'M/d')
      const isWeekday = type === 'weekday' || type === 'schoolEvent'
      const timeSlots = isWeekday
        ? ['16:00〜18:00']
        : ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

      const baseSlots = getDaySchedule(dateStr, config, currentMonth)
      const dayRes = reservations.filter((r: Reservation) => r.date === dateStr)
      const deletedSlots = dayRes.filter((r: Reservation) => r.entryType === 'deleted_slot')
      const userSchedule = dayRes.filter((r: Reservation) => r.entryType === 'schedule')

      timeSlots.forEach((slot, idx) => {
        const facilities: Record<string, string> = {}
        FACILITIES.forEach((fac) => {
          const userEntry = userSchedule.find((r: Reservation) => r.timeSlot === slot && r.facility === fac)
          const deleted = deletedSlots.find((r: Reservation) => r.timeSlot === slot && r.facility === fac)
          const fixed = baseSlots.find((s) => s.timeSlot === slot && s.facility === fac)

          if (userEntry) {
            facilities[fac] = userEntry.clubName
          } else if (deleted) {
            facilities[fac] = ''
          } else if (fixed) {
            facilities[fac] = fixed.clubName
          } else {
            facilities[fac] = ''
          }
        })

        result.push({
          dateStr,
          dateLabel,
          dow,
          type,
          eventName: eventName ?? '',
          timeSlot: slot,
          facilities,
          isFirstRow: idx === 0,
          rowSpan: timeSlots.length,
        })
      })
    })

    return result
  }, [config, reservations, currentYear, currentMonth])

  return (
    <div className="min-h-screen bg-white">
      {/* 印刷ボタン（印刷時非表示） */}
      <div className="p-4 flex items-center gap-4 print:hidden border-b">
        <h1 className="font-bold text-lg">{currentYear}年{currentMonth}月 体育館使用予定表</h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          印刷する
        </button>
        <button
          onClick={() => window.close()}
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          閉じる
        </button>
      </div>

      <div className="p-2 print:p-0">
        <h2 className="hidden print:block text-center font-bold text-base mb-2">
          {currentYear}年{currentMonth}月 体育館使用予定表
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '24px' }} />
              <col style={{ width: '44px' }} />
              <col style={{ width: '56px' }} />
              {FACILITIES.map((f) => <col key={f} style={{ width: '72px' }} />)}
            </colgroup>
            <thead>
              <tr className="bg-blue-800 text-white">
                <th className="border border-blue-700 px-1 py-1 text-center font-bold">月日</th>
                <th className="border border-blue-700 px-1 py-1 text-center font-bold">曜</th>
                <th className="border border-blue-700 px-1 py-1 text-center font-bold">区分</th>
                <th className="border border-blue-700 px-1 py-1 text-center font-bold">時間帯</th>
                {FACILITIES.map((f) => (
                  <th key={f} className="border border-blue-700 px-1 py-1 text-center font-bold whitespace-pre-line leading-tight">
                    {FACILITY_SHORT[f]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bg = rowBg(row.type)
                return (
                  <tr key={`${row.dateStr}-${row.timeSlot}`} className={bg}>
                    {row.isFirstRow && (
                      <>
                        <td
                          rowSpan={row.rowSpan}
                          className="border border-gray-300 px-1 py-0.5 text-center font-medium align-middle"
                        >
                          {row.dateLabel}
                        </td>
                        <td
                          rowSpan={row.rowSpan}
                          className="border border-gray-300 px-1 py-0.5 text-center align-middle"
                        >
                          {row.dow}
                        </td>
                        <td
                          rowSpan={row.rowSpan}
                          className="border border-gray-300 px-1 py-0.5 text-center align-middle text-[10px] leading-tight"
                        >
                          <div>{DAY_TYPE_LABEL[row.type] ?? row.type}</div>
                          {row.eventName && (
                            <div className="text-gray-500 mt-0.5 truncate" title={row.eventName}>{row.eventName}</div>
                          )}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 px-1 py-0.5 text-center text-[10px] whitespace-nowrap">
                      {row.timeSlot}
                    </td>
                    {FACILITIES.map((fac) => {
                      const clubName = row.facilities[fac] ?? ''
                      const c = clubName ? getClubColor(clubName) : null
                      return (
                        <td
                          key={fac}
                          className={`border border-gray-300 px-1 py-0.5 text-center text-[10px] leading-tight ${c ? `${c.bg} ${c.text}` : ''}`}
                        >
                          {clubName}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
