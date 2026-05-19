import { eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns'
import { getDaySchedule } from './scheduleLogic'
import type { AppConfig, Reservation, SlotEntry } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXModule = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WsCell = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Worksheet = Record<string, any>

const SOUGO_FACILITIES = ['総合体育館 半面A', '総合体育館 半面B', '総合体育館（全面）']
const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土']

function toWareki(year: number): { era: string; eraYear: number } {
  return { era: '令和', eraYear: year - 2018 }
}

function facilityToMen(facility: string): '半面' | '全面' {
  return facility === '総合体育館（全面）' ? '全面' : '半面'
}

function parseTimeSlot(slot: string): { startH: number; startM: number; endH: number; endM: number } | null {
  const m = slot.match(/^(\d+):(\d+)〜(\d+):(\d+)$/)
  if (!m) return null
  return { startH: +m[1], startM: +m[2], endH: +m[3], endM: +m[4] }
}

function getEffectiveSougoSlots(
  dateStr: string,
  config: AppConfig,
  month: number,
  reservations: Reservation[],
): SlotEntry[] {
  const baseSlots = getDaySchedule(dateStr, config, month)
  let effective: SlotEntry[] = [...baseSlots]

  const dayRes = reservations.filter((r) => r.date === dateStr)
  const deletedSlots = dayRes.filter((r) => r.entryType === 'deleted_slot')
  const scheduleItems = dayRes.filter((r) => r.entryType === 'schedule')

  effective = effective.filter(
    (s) => !deletedSlots.some((d) => d.timeSlot === s.timeSlot && d.facility === s.facility),
  )
  effective = effective.filter(
    (s) => !scheduleItems.some((r) => r.timeSlot === s.timeSlot && r.facility === s.facility),
  )
  scheduleItems.forEach((r) => {
    effective.push({ timeSlot: r.timeSlot, facility: r.facility, clubName: r.clubName })
  })

  return effective.filter((s) => SOUGO_FACILITIES.includes(s.facility))
}

interface DateEntry {
  year: number
  month: number
  day: number
  weekday: string
  startH: number
  startM: number
  endH: number
  endM: number
  facilityType: '半面' | '全面'
  clubName: string
}

export interface ApplicationPreview {
  clubName: string
  facilityType: '半面' | '全面'
  entryCount: number
  sheetCount: number
}

function buildAllEntries(
  year: number,
  month: number,
  config: AppConfig,
  reservations: Reservation[],
): DateEntry[] {
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month - 1)),
    end: endOfMonth(new Date(year, month - 1)),
  })

  const seen = new Set<string>()
  const entries: DateEntry[] = []

  for (const day of days) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const slots = getEffectiveSougoSlots(dateStr, config, month, reservations)
    const dow = getDay(day)
    const weekday = WEEKDAYS_JP[dow]

    for (const slot of slots) {
      const times = parseTimeSlot(slot.timeSlot)
      if (!times) continue
      const ft = facilityToMen(slot.facility)
      const dedupeKey = `${slot.clubName}|${ft}|${dateStr}|${slot.timeSlot}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      entries.push({
        year,
        month,
        day: day.getDate(),
        weekday,
        ...times,
        facilityType: ft,
        clubName: slot.clubName,
      })
    }
  }

  return entries
}

function groupEntries(
  entries: DateEntry[],
): Map<string, { facilityType: '半面' | '全面'; entries: DateEntry[] }> {
  const groupMap = new Map<string, { facilityType: '半面' | '全面'; entries: DateEntry[] }>()
  for (const entry of entries) {
    const key = `${entry.clubName}|${entry.facilityType}`
    if (!groupMap.has(key)) {
      groupMap.set(key, { facilityType: entry.facilityType, entries: [] })
    }
    groupMap.get(key)!.entries.push(entry)
  }
  for (const group of groupMap.values()) {
    group.entries.sort((a, b) => {
      const aNum = a.year * 10000 + a.month * 100 + a.day
      const bNum = b.year * 10000 + b.month * 100 + b.day
      return aNum - bNum || (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM)
    })
  }
  return groupMap
}

export function previewApplicationForm(
  year: number,
  month: number,
  config: AppConfig,
  reservations: Reservation[],
): ApplicationPreview[] {
  const entries = buildAllEntries(year, month, config, reservations)
  const groupMap = groupEntries(entries)
  const result: ApplicationPreview[] = []
  for (const [key, group] of groupMap.entries()) {
    const clubName = key.split('|')[0]
    result.push({
      clubName,
      facilityType: group.facilityType,
      entryCount: group.entries.length,
      sheetCount: Math.ceil(group.entries.length / 3),
    })
  }
  return result.sort((a, b) => a.clubName.localeCompare(b.clubName, 'ja'))
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '_').slice(0, 31)
}

/** セルに値を書き込む。既存セルがあればv/tのみ上書き */
function setCell(ws: Worksheet, addr: string, value: string | number): void {
  const t = typeof value === 'number' ? 'n' : 's'
  const existing: WsCell = ws[addr]
  if (existing) {
    existing.v = value
    existing.t = t
    // 数値セルはフォーマットを保持するためwのみ削除
    delete existing.w
  } else {
    ws[addr] = { v: value, t }
  }
}

/**
 * テンプレートシートをディープコピーして各フィールドを埋める
 *
 * 原稿シートの入力セル（VOREASサンプル & 空白テンプレートの調査結果より）:
 *   W15 : 申請日（例: 令和8年5月20日）
 *   T21 : 個人名・主催団体名（クラブ名）
 *   T25 : 申請者名
 *   T28 : 住所
 *   Y31 : 電話番号
 *   R38 : 利用面文字（"全" or "半"）
 *   H43 : 利用目的・内容
 *   日時行 (49/51/53):
 *     I列: 元号年（数値）  L列: 月  O列: 日
 *     R列: "( 曜 ）"文字列
 *     U列: 開始時  X列: 開始分（"00"等）
 *     AB列: 終了時  AE列: 終了分
 */
function fillSheet(
  templateWs: Worksheet,
  clubName: string,
  facilityType: '半面' | '全面',
  pageEntries: DateEntry[],
  outputDateStr: string,
): Worksheet {
  const ws: Worksheet = JSON.parse(JSON.stringify(templateWs))

  setCell(ws, 'W15', outputDateStr)
  setCell(ws, 'T21', clubName)
  setCell(ws, 'T25', '一般社団法人たかすスポーツクラブ')
  setCell(ws, 'T28', '鷹栖町南２条４丁目１番２号')
  setCell(ws, 'Y31', '0166-87-4291')
  setCell(ws, 'R38', facilityType === '全面' ? '全' : '半')
  setCell(ws, 'H43', '定期練習')

  // 日時行のセル列アドレス (原稿シートの行49・51・53)
  const dateRowAddrs = [
    { row: 49, yr: 'I49', mo: 'L49', dy: 'O49', wd: 'R49', sH: 'U49', sM: 'X49', eH: 'AB49', eM: 'AE49' },
    { row: 51, yr: 'I51', mo: 'L51', dy: 'O51', wd: 'R51', sH: 'U51', sM: 'X51', eH: 'AB51', eM: 'AE51' },
    { row: 53, yr: 'I53', mo: 'L53', dy: 'O53', wd: 'R53', sH: 'U53', sM: 'X53', eH: 'AB53', eM: 'AE53' },
  ]

  for (let i = 0; i < Math.min(pageEntries.length, 3); i++) {
    const e = pageEntries[i]
    const dr = dateRowAddrs[i]
    const { eraYear } = toWareki(e.year)

    setCell(ws, dr.yr, eraYear)
    setCell(ws, dr.mo, e.month)
    setCell(ws, dr.dy, e.day)
    setCell(ws, dr.wd, `( ${e.weekday} ）`)
    setCell(ws, dr.sH, e.startH)
    setCell(ws, dr.sM, String(e.startM).padStart(2, '0'))
    setCell(ws, dr.eH, e.endH)
    setCell(ws, dr.eM, String(e.endM).padStart(2, '0'))
  }

  return ws
}

export async function exportApplicationForm(
  year: number,
  month: number,
  config: AppConfig,
  reservations: Reservation[],
): Promise<void> {
  const XLSX: XLSXModule = await import('xlsx-js-style')

  // テンプレートを取得 (public/templates/ に配置済み)
  const templateUrl = `${import.meta.env.BASE_URL}templates/soutai_template.xlsx`
  const response = await fetch(templateUrl)
  if (!response.ok) throw new Error(`テンプレート取得失敗: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const templateWb: XLSXModule = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const templateWs: Worksheet = templateWb.Sheets['原稿']
  if (!templateWs) throw new Error('テンプレートの「原稿」シートが見つかりません')

  const allEntries = buildAllEntries(year, month, config, reservations)
  const groupMap = groupEntries(allEntries)

  const wb = XLSX.utils.book_new()

  const today = new Date()
  const { era, eraYear } = toWareki(today.getFullYear())
  const outputDateStr = `${era}${eraYear}年${today.getMonth() + 1}月${today.getDate()}日`

  const sortedGroups = [...groupMap.entries()].sort(([a], [b]) =>
    a.split('|')[0].localeCompare(b.split('|')[0], 'ja'),
  )

  const clubSheetCount = new Map<string, number>()

  for (const [key, group] of sortedGroups) {
    const clubName = key.split('|')[0]
    const { facilityType, entries } = group

    for (let pageStart = 0; pageStart < entries.length; pageStart += 3) {
      const pageEntries = entries.slice(pageStart, pageStart + 3)
      const sheetNum = (clubSheetCount.get(clubName) ?? 0) + 1
      clubSheetCount.set(clubName, sheetNum)

      const rawName = sheetNum === 1 ? clubName : `${clubName}(${sheetNum})`
      const sheetName = sanitizeSheetName(rawName)

      const ws = fillSheet(templateWs, clubName, facilityType, pageEntries, outputDateStr)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
  }

  const filename = `${year}年${String(month).padStart(2, '0')}月_総合体育館利用申請書.xlsx`
  XLSX.writeFile(wb, filename)
}
