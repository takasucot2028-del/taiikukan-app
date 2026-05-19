import { eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns'
import { getDaySchedule } from './scheduleLogic'
import type { AppConfig, Reservation, SlotEntry } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XLSXModule = any

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

function buildSheetRows(
  clubName: string,
  facilityType: '半面' | '全面',
  pageEntries: DateEntry[],
): string[][] {
  const today = new Date()
  const { era, eraYear } = toWareki(today.getFullYear())
  const outputDate = `${era}${eraYear}年${today.getMonth() + 1}月${today.getDate()}日`
  const facilityName = facilityType === '半面' ? '総合体育館（半面）' : '総合体育館（全面）'

  const rows: string[][] = Array.from({ length: 60 }, () => ['', '', '', '', '', '', ''])

  rows[0] = ['鷹栖町体育館利用許可申請書', '', '', '', '', '', '']
  rows[13] = ['', '', '', '', '', '', outputDate]
  rows[15] = ['鷹栖町体育施設指定管理者', '', '', '', '', '', '']
  rows[16] = ['一般社団法人　たかすスポーツクラブ　様', '', '', '', '', '', '']
  rows[19] = [`個人名・主催団体名：${clubName}`, '', '', '', '', '', '']
  rows[23] = ['申請者名：一般社団法人たかすスポーツクラブ', '', '', '', '', '', '']
  rows[26] = ['住所：鷹栖町南２条４丁目１番２号', '', '', '', '', '', '']
  rows[29] = ['℡：0166-87-4291', '', '', '', '', '', '']
  rows[36] = [`利用体育館：${facilityName}`, '', '', '', '', '', '']
  rows[41] = ['利用目的・内容：定期練習', '', '', '', '', '', '']

  const dateRowIndices = [47, 49, 51]
  for (let i = 0; i < Math.min(pageEntries.length, 3); i++) {
    const e = pageEntries[i]
    const { era: eE, eraYear: eyE } = toWareki(e.year)
    const dayPadded = String(e.day).padStart(2, ' ')
    const startTime = `${String(e.startH).padStart(2, '0')}時${String(e.startM).padStart(2, '0')}分`
    const endTime = `${String(e.endH).padStart(2, '0')}時${String(e.endM).padStart(2, '0')}分`
    rows[dateRowIndices[i]] = [
      `・${eE}${eyE}年 ${e.month}月${dayPadded}日（${e.weekday}） ${startTime}〜${endTime}`,
      '', '', '', '', '', '',
    ]
  }

  return rows
}

export async function exportApplicationForm(
  year: number,
  month: number,
  config: AppConfig,
  reservations: Reservation[],
): Promise<void> {
  const XLSX: XLSXModule = await import('xlsx-js-style')

  const allEntries = buildAllEntries(year, month, config, reservations)
  const groupMap = groupEntries(allEntries)

  const wb = XLSX.utils.book_new()

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

      const rows = buildSheetRows(clubName, facilityType, pageEntries)
      const ws = XLSX.utils.aoa_to_sheet(rows)

      ws['!cols'] = [
        { wch: 46 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 8 },
        { wch: 16 },
      ]

      const titleCell = 'A1'
      if (ws[titleCell]) {
        ws[titleCell].s = {
          font: { bold: true, sz: 14 },
          alignment: { horizontal: 'center' },
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
  }

  const filename = `${year}年${String(month).padStart(2, '0')}月_総合体育館利用申請書.xlsx`
  XLSX.writeFile(wb, filename)
}
