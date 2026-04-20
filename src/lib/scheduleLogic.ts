import { getDay } from 'date-fns'
import type { AppConfig, SlotEntry, DayType, DayPattern } from '../types'

/** 夏期（5〜10月）か冬期（11〜4月）かを返す */
function isSummer(month: number): boolean {
  return month >= 5 && month <= 10
}

/** 日付の区分を判定（優先順位: 学校行事 > 祝日 > 土 > 日 > 平日） */
export function getDayType(dateStr: string, config: AppConfig): { type: DayType; eventName?: string } {
  const schoolEvent = config.schoolEvents.find((e) => e.date === dateStr)
  if (schoolEvent) return { type: 'schoolEvent', eventName: schoolEvent.name }

  const holiday = config.holidays.find((h) => h.date === dateStr)
  if (holiday) return { type: 'holiday', eventName: holiday.name }

  const dow = getDay(new Date(dateStr + 'T00:00:00'))
  if (dow === 6) return { type: 'saturday' }
  if (dow === 0) return { type: 'sunday' }
  return { type: 'weekday' }
}

/**
 * 対象日が同じ曜日で月内に何番目か（0-indexed）を返す
 * 例：月内2番目の土曜 → 1
 */
function getNthDayOfWeekInMonth(dateStr: string, targetDow: number): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const dow = getDay(new Date(year, month - 1, d))
    if (dow === targetDow) count++
  }
  return count
}

/** 日曜/祝日ローテーション向け：月内の「日曜扱い」の連番（0-indexed）を返す */
function getNthSundayTypeInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = getDay(new Date(year, month - 1, d))
    const isHoliday = config.holidays.some((h) => h.date === ds)
    const isSchoolEvent = config.schoolEvents.some((e) => e.date === ds)
    // 日曜扱い：日曜 or 祝日（学校行事は除く）
    if ((dow === 0 || isHoliday) && !isSchoolEvent) count++
  }
  return count
}

/** ローテーションパターンを取得（夏期/冬期・startIndexから循環） */
function getRotationPattern(
  patterns: DayPattern[],
  startIndex: number,
  nthOccurrence: number,
): DayPattern {
  if (patterns.length === 0) return []
  // 空でないパターンのみを有効とする
  const validPatterns = patterns.filter((p) => p.length > 0)
  if (validPatterns.length === 0) return []
  const idx = (startIndex + nthOccurrence) % validPatterns.length
  return validPatterns[idx]
}

/** NexusBC固定ルール：日曜ローテーションの14:00〜17:00は第1全面・第2全面をNexusBCに上書き */
function applyNexusBcRule(slots: SlotEntry[]): SlotEntry[] {
  return slots.map((s) => {
    if (
      s.timeSlot === '14:00〜17:00' &&
      (s.facility === '第1体育館 全面' || s.facility === '第2体育館 全面')
    ) {
      return { ...s, clubName: 'NexusBC' }
    }
    return s
  })
}

/** 指定日のスケジュールを生成して返す */
export function getDaySchedule(
  dateStr: string,
  config: AppConfig,
  month: number,
): SlotEntry[] {
  const { type } = getDayType(dateStr, config)
  const summer = isSummer(month)

  // ---- 平日・学校行事平日 → 平日固定スケジュール ----
  if (type === 'weekday' || type === 'schoolEvent') {
    if (!config.weekdaySchedule) return []
    const dow = getDay(new Date(dateStr + 'T00:00:00'))
    const keyMap: Record<number, keyof typeof config.weekdaySchedule> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday',
    }
    const key = keyMap[dow]
    return key ? (config.weekdaySchedule[key] ?? []) : []
  }

  // ---- 土曜ローテーション ----
  if (type === 'saturday') {
    if (!config.saturdayRotation) return []
    const patterns = summer
      ? config.saturdayRotation.summerPatterns
      : config.saturdayRotation.winterPatterns
    const nth = getNthDayOfWeekInMonth(dateStr, 6)
    return getRotationPattern(patterns, config.saturdayRotation.startIndex, nth)
  }

  // ---- 日曜・祝日・長期休業 → 日曜ローテーション ----
  if (type === 'sunday' || type === 'holiday' || type === 'longBreak') {
    if (!config.sundayRotation) return []
    const patterns = summer
      ? config.sundayRotation.summerPatterns
      : config.sundayRotation.winterPatterns
    const nth = getNthSundayTypeInMonth(dateStr, config)
    const slots = getRotationPattern(patterns, config.sundayRotation.startIndex, nth)
    return applyNexusBcRule(slots)
  }

  return []
}

/** カレンダーセル用：日付のスケジュール概要（クラブ名リスト） */
export function getDayClubSummary(
  dateStr: string,
  config: AppConfig,
  month: number,
  filterClub: string,
): string[] {
  const slots = getDaySchedule(dateStr, config, month)
  const filtered = filterClub ? slots.filter((s) => s.clubName === filterClub) : slots
  // 重複クラブ名を除去
  const names = [...new Set(filtered.map((s) => s.clubName))]
  return names
}
