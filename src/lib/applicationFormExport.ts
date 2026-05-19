import { eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns'
import { getDaySchedule } from './scheduleLogic'
import type { AppConfig, SlotEntry } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXModule = any
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

/** ローテーション・固定スケジュールのみ使用（予約データは一切適用しない） */
function getBaseSougoSlots(dateStr: string, config: AppConfig, month: number): SlotEntry[] {
  return getDaySchedule(dateStr, config, month).filter((s) => SOUGO_FACILITIES.includes(s.facility))
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

function buildAllEntries(year: number, month: number, config: AppConfig): DateEntry[] {
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month - 1)),
    end: endOfMonth(new Date(year, month - 1)),
  })

  const seen = new Set<string>()
  const entries: DateEntry[] = []

  for (const day of days) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const slots = getBaseSougoSlots(dateStr, config, month)
    const dow = getDay(day)
    const weekday = WEEKDAYS_JP[dow]

    for (const slot of slots) {
      const times = parseTimeSlot(slot.timeSlot)
      if (!times) continue
      const ft = facilityToMen(slot.facility)
      // 同日・同施設種別・同時間帯の重複を除去（半面A/B が同時利用の場合）
      const dedupeKey = `${slot.clubName}|${ft}|${dateStr}|${slot.timeSlot}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      entries.push({ year, month, day: day.getDate(), weekday, ...times, facilityType: ft, clubName: slot.clubName })
    }
  }

  return entries
}

function groupEntries(entries: DateEntry[]): Map<string, { facilityType: '半面' | '全面'; entries: DateEntry[] }> {
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

export function previewApplicationForm(year: number, month: number, config: AppConfig): ApplicationPreview[] {
  const entries = buildAllEntries(year, month, config)
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

/** 既存セルは v/t のみ上書き（書式・スタイルを保持）、新規セルは最小構成で追加 */
function setCell(ws: Worksheet, addr: string, value: string | number): void {
  const t = typeof value === 'number' ? 'n' : 's'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing: any = ws[addr]
  if (existing) {
    existing.v = value
    existing.t = t
    delete existing.w  // 表示キャッシュをクリア
  } else {
    ws[addr] = { v: value, t }
  }
}

/** グループ全体で最も多い曜日を返す */
function getDominantWeekday(entries: DateEntry[]): string {
  const counts: Record<string, number> = {}
  for (const e of entries) {
    counts[e.weekday] = (counts[e.weekday] ?? 0) + 1
  }
  return Object.entries(counts).reduce((best, [wd, cnt]) => cnt > best[1] ? [wd, cnt] : best, ['', 0])[0]
}

/**
 * 原稿シートを複製して必要セルを埋める
 *
 * 確定セル位置（結合情報で確認済み）:
 *   W15（W15:AH17結合）: 申請日
 *   T21（T21:AI24結合）: 個人名・主催団体名
 *   T25（T25:AI27結合）: 申請者名
 *   T28（T28:AI30結合）: 住所
 *   Y31（Y31:AI33結合）: 電話番号
 *   R38（R38:S42結合） : 利用面文字（"全" or "半"）
 *   H43（H43:AI47結合）: 利用目的・内容
 *   Y64（Y64:AB64結合）: 定期利用曜日（V64="(毎週", AC64="曜日を予定)"）
 *
 *   日時行（行49/51/53）:
 *     I列（I:J結合）: "令和8" 等の元号+年
 *     L列（L:M結合）: 月
 *     O列（O:P結合）: 日
 *     R列（R:T結合）: "( 日 ）" 曜日（VOREAS書式）
 *     U列（U:V結合）: 開始時
 *     X列（X:Y結合）: 開始分（"00"文字列）
 *     AB列（AB:AC結合）: 終了時
 *     AE列（AE:AF結合）: 終了分（"00"文字列）
 */
function fillSheet(
  templateWs: Worksheet,
  clubName: string,
  facilityType: '半面' | '全面',
  pageEntries: DateEntry[],
  allGroupEntries: DateEntry[],
  outputDateStr: string,
): Worksheet {
  const ws: Worksheet = JSON.parse(JSON.stringify(templateWs))

  // 固定フィールド
  setCell(ws, 'W15', outputDateStr)
  setCell(ws, 'T21', clubName)
  setCell(ws, 'T25', '一般社団法人たかすスポーツクラブ')
  setCell(ws, 'T28', '鷹栖町南２条４丁目１番２号')
  setCell(ws, 'Y31', '0166-87-4291')
  setCell(ws, 'R38', facilityType === '全面' ? '全' : '半')
  setCell(ws, 'H43', '定期練習')

  // 定期利用記入欄: グループ全体で最多曜日 → Y64（V64:X64="(毎週" の直後）
  const dominantWd = getDominantWeekday(allGroupEntries)
  if (dominantWd) setCell(ws, 'Y64', dominantWd)

  // 日時行（最大3件）
  const DATE_ROWS = [
    { yr: 'I49', mo: 'L49', dy: 'O49', wd: 'R49', sH: 'U49', sM: 'X49', eH: 'AB49', eM: 'AE49' },
    { yr: 'I51', mo: 'L51', dy: 'O51', wd: 'R51', sH: 'U51', sM: 'X51', eH: 'AB51', eM: 'AE51' },
    { yr: 'I53', mo: 'L53', dy: 'O53', wd: 'R53', sH: 'U53', sM: 'X53', eH: 'AB53', eM: 'AE53' },
  ]

  for (let i = 0; i < Math.min(pageEntries.length, 3); i++) {
    const e = pageEntries[i]
    const dr = DATE_ROWS[i]
    const { era, eraYear } = toWareki(e.year)

    setCell(ws, dr.yr, `${era}${eraYear}`)              // "令和8"
    setCell(ws, dr.mo, e.month)                          // 5
    setCell(ws, dr.dy, e.day)                            // 3
    setCell(ws, dr.wd, `( ${e.weekday} ）`)              // "( 日 ）"
    setCell(ws, dr.sH, e.startH)                         // 14
    setCell(ws, dr.sM, String(e.startM).padStart(2, '0')) // "00"
    setCell(ws, dr.eH, e.endH)                           // 17
    setCell(ws, dr.eM, String(e.endM).padStart(2, '0'))  // "00"
  }

  return ws
}

export async function exportApplicationForm(year: number, month: number, config: AppConfig): Promise<void> {
  const XLSX: XLSXModule = await import('xlsx-js-style')

  // public/templates/soutai_template.xlsx を取得
  const templateUrl = `${import.meta.env.BASE_URL}templates/soutai_template.xlsx`
  const response = await fetch(templateUrl)
  if (!response.ok) throw new Error(`テンプレート取得失敗: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const templateWb: XLSXModule = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const templateWs: Worksheet = templateWb.Sheets['原稿']
  if (!templateWs) throw new Error('テンプレートの「原稿」シートが見つかりません')

  const allEntries = buildAllEntries(year, month, config)
  const groupMap = groupEntries(allEntries)

  const wb = XLSX.utils.book_new()

  const today = new Date()
  const { era, eraYear } = toWareki(today.getFullYear())
  const outputDateStr = `${era}${eraYear}年${today.getMonth() + 1}月${today.getDate()}日`

  // クラブ名でソートして出力順を安定させる
  const sortedGroups = [...groupMap.entries()].sort(([a], [b]) =>
    a.split('|')[0].localeCompare(b.split('|')[0], 'ja'),
  )

  const clubSheetCount = new Map<string, number>()

  for (const [key, group] of sortedGroups) {
    const clubName = key.split('|')[0]
    const { facilityType, entries } = group

    // 3件ごとにページ分割
    for (let pageStart = 0; pageStart < entries.length; pageStart += 3) {
      const pageEntries = entries.slice(pageStart, pageStart + 3)
      const sheetNum = (clubSheetCount.get(clubName) ?? 0) + 1
      clubSheetCount.set(clubName, sheetNum)

      const rawName = sheetNum === 1 ? clubName : `${clubName}(${sheetNum})`
      const sheetName = sanitizeSheetName(rawName)

      const ws = fillSheet(templateWs, clubName, facilityType, pageEntries, entries, outputDateStr)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
  }

  const filename = `${year}年${String(month).padStart(2, '0')}月_総合体育館利用申請書.xlsx`
  XLSX.writeFile(wb, filename)
}
