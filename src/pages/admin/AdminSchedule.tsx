import { useState, useMemo } from 'react'
import { eachDayOfInterval, startOfMonth, endOfMonth, format, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAppStore } from '../../store'
import { useReservations, useConfig } from '../../hooks/useReservations'
import { gasApi } from '../../lib/gasApi'
import { getDayType, getDaySchedule } from '../../lib/scheduleLogic'
import { AdminNav } from '../../components/admin/AdminNav'
import type { Reservation } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXModule = any

const FACILITIES = [
  '第1体育館 半面A',
  '第1体育館 半面B',
  '第1体育館（全面）',
  '第1体育館 ステージ',
  '第2体育館（全面）',
  '総合体育館 半面A',
  '総合体育館（全面）',
]

const DAY_TYPE_LABEL: Record<string, string> = {
  weekday: '平日', saturday: '土曜', sunday: '日曜',
  holiday: '祝日', schoolEvent: '学校行事', longBreak: '長期休暇',
}
const WEEKEND_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

function getClubForSlot(
  dateStr: string, timeSlot: string, facility: string,
  schedule: ReturnType<typeof getDaySchedule>,
  reservations: Reservation[],
): string {
  const dayRes = reservations.filter((r) => r.date === dateStr)
  const deleted = dayRes.find((r) => r.entryType === 'deleted_slot' && r.timeSlot === timeSlot && r.facility === facility)
  if (deleted) return ''
  const userEntry = dayRes.find((r) => r.entryType === 'schedule' && r.timeSlot === timeSlot && r.facility === facility)
  if (userEntry) return `${userEntry.clubName}（${userEntry.content}）`
  const fixed = schedule.find((s) => s.timeSlot === timeSlot && s.facility === facility)
  return fixed?.clubName ?? ''
}

export function AdminSchedule() {
  const { currentYear, currentMonth, setCurrentMonth, config } = useAppStore()
  const { reservations, refetch } = useReservations()
  const configResult = useConfig()

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [confirming, setConfirming] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')

  const confirmedEntry = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`
    return reservations.find((r) => r.entryType === 'confirmed_month' && r.date.startsWith(prefix))
  }, [reservations, year, month])

  const handleConfirm = async () => {
    if (!window.confirm(`${year}年${month}月の予定表を確定しますか？`)) return
    setConfirming(true)
    try {
      await gasApi.confirmMonth(year, month)
      refetch()
      setMessage('確定しました')
    } catch {
      setMessage('確定に失敗しました')
    } finally {
      setConfirming(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleUnconfirm = async () => {
    if (!confirmedEntry) return
    if (!window.confirm('確定を取り消しますか？')) return
    setConfirming(true)
    try {
      await gasApi.unconfirmMonth(confirmedEntry.id)
      refetch()
      setMessage('確定を取り消しました')
    } catch {
      setMessage('取り消しに失敗しました')
    } finally {
      setConfirming(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const handleExport = async () => {
    if (!config) { setMessage('設定データを読み込み中です'); return }
    setExporting(true)
    try {
      const XLSX: XLSXModule = await import('xlsx-js-style')
      const days = eachDayOfInterval({ start: startOfMonth(new Date(year, month - 1)), end: endOfMonth(new Date(year, month - 1)) })

      const headers = ['月日', '曜日', '区分', '行事名', '占有内容', '時間帯',
        ...FACILITIES, '変更メモ']

      const rows: unknown[][] = [headers]
      const styles: { row: number; col: number; fill: string }[] = []
      let rowIdx = 1

      const fillForType: Record<string, string> = {
        saturday: 'DBEAFE', sunday: 'FFEDD5', holiday: 'FEE2E2', schoolEvent: 'CFFAFE',
      }

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dow = getDay(day)
        const dayType = getDayType(dateStr, config)
        const schedule = getDaySchedule(dateStr, config, month)
        const typeLabel = DAY_TYPE_LABEL[dayType.type] ?? '平日'
        const dateLabel = format(day, 'M/d')
        const dowLabel = ['日', '月', '火', '水', '木', '金', '土'][dow]
        const eventName = dayType.eventName ?? ''
        const fill = fillForType[dayType.type] ?? ''

        const isWeekend = ['saturday', 'sunday', 'holiday', 'longBreak'].includes(dayType.type)
        const slots = isWeekend ? WEEKEND_SLOTS : ['16:00〜18:00']

        // occupancy reservations for this day
        const occRes = reservations.filter((r) => r.date === dateStr && r.entryType === 'reservation')

        for (let si = 0; si < slots.length; si++) {
          const slot = slots[si]
          const facilityValues = FACILITIES.map((f) => getClubForSlot(dateStr, slot, f, schedule, reservations))
          const occForSlot = occRes.filter((r) => r.timeSlot === slot || r.timeSlot === '終日')
          const occText = occForSlot.map((r) => `${r.clubName}：${r.content}`).join(' / ')

          rows.push([
            si === 0 ? dateLabel : '',
            si === 0 ? dowLabel : '',
            si === 0 ? typeLabel : '',
            si === 0 ? eventName : '',
            occText,
            slot,
            ...facilityValues,
            '',
          ])

          if (fill) {
            for (let col = 0; col < headers.length; col++) {
              styles.push({ row: rowIdx, col, fill })
            }
          }
          rowIdx++
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)

      // Apply styles
      const getColLetter = (col: number) => {
        let s = ''
        let n = col + 1
        while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26) }
        return s
      }

      // Header row style
      for (let c = 0; c < headers.length; c++) {
        const cell = getColLetter(c) + '1'
        if (!ws[cell]) ws[cell] = { v: headers[c] }
        ws[cell].s = { fill: { fgColor: { rgb: '1E3A8A' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } }
      }

      // Data row styles
      for (const { row, col, fill } of styles) {
        const cell = getColLetter(col) + String(row + 1)
        if (ws[cell]) {
          ws[cell].s = { fill: { fgColor: { rgb: fill } } }
        } else {
          ws[cell] = { v: '', s: { fill: { fgColor: { rgb: fill } } } }
        }
      }

      ws['!cols'] = [
        { wch: 6 }, { wch: 4 }, { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
        ...FACILITIES.map(() => ({ wch: 14 })), { wch: 16 },
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${month}月予定表`)
      XLSX.writeFile(wb, `${month}月予定表_共有用.xlsx`)
      setMessage('Excelを出力しました')
    } catch (e) {
      console.error(e)
      setMessage('Excel出力に失敗しました')
    } finally {
      setExporting(false)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="月間予定表" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className="bg-green-100 text-green-800 text-sm px-4 py-2 rounded-lg">{message}</div>
        )}

        {/* 年月選択 */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">対象年月</h2>
          <div className="flex gap-2 items-center">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <button onClick={() => { setCurrentMonth(year, month); refetch() }}
              className="text-sm bg-gray-100 border rounded-lg px-3 py-2 hover:bg-gray-200">
              データ更新
            </button>
          </div>
        </div>

        {/* 確定ステータス */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">確定ステータス</h2>
          {confirmedEntry ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full font-medium">✓ 確定済み</span>
                <span className="text-sm text-gray-500">{confirmedEntry.createdAt.slice(0, 10)} 確定</span>
              </div>
              <button onClick={handleUnconfirm} disabled={confirming}
                className="text-xs text-red-600 border border-red-300 rounded px-3 py-1 hover:bg-red-50 disabled:opacity-50">
                取り消し
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">未確定</span>
              <button onClick={handleConfirm} disabled={confirming}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {confirming ? '処理中...' : `${year}年${month}月を確定する`}
              </button>
            </div>
          )}
        </div>

        {/* Excel出力 */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-1">共有用Excel出力</h2>
          <p className="text-xs text-gray-500 mb-3">
            ローテーション・固定スケジュール・指導者追加・削除・占有予約を反映したExcelファイルを生成します
          </p>
          <button onClick={handleExport} disabled={exporting || !config}
            className="w-full bg-green-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">
            {exporting ? '生成中...' : `${month}月予定表_共有用.xlsx をダウンロード`}
          </button>
          {!config && <p className="text-xs text-amber-600 mt-2">※ 設定データ読み込み後に使用可能になります</p>}
        </div>

        {/* 当月サマリー */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">当月サマリー</h2>
          {(() => {
            const monthRes = reservations.filter((r) => r.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
            const scheduleCount = monthRes.filter((r) => r.entryType === 'schedule').length
            const deletedCount = monthRes.filter((r) => r.entryType === 'deleted_slot').length
            const reservationCount = monthRes.filter((r) => r.entryType === 'reservation').length
            return (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-700">{scheduleCount}</p>
                  <p className="text-xs text-green-600">追加予定</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-600">{deletedCount}</p>
                  <p className="text-xs text-gray-500">空き化</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-700">{reservationCount}</p>
                  <p className="text-xs text-blue-600">占有申請</p>
                </div>
              </div>
            )
          })()}
        </div>
      </main>
    </div>
  )
}
