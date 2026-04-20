import { getDay } from 'date-fns'
import type { AppConfig, SlotEntry, DayType } from '../types'

/** 日付の区分を判定する（優先順位: 学校行事 > 祝日 > 土 > 日 > 平日） */
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

/** 土曜/日曜ローテーションのパターン番号を計算する */
function getRotationIndex(
  dateStr: string,
  dayType: 'saturday' | 'sunday' | 'longBreak',
  config: AppConfig,
  year: number,
  month: number,
): number {
  const rotation = dayType === 'saturday'
    ? config.saturdayRotation
    : config.sundayRotation
  if (!rotation || rotation.patterns.length === 0) return 0

  // 対象月の最初の土曜/日曜から何週目かでパターンを決定
  const targetDow = dayType === 'saturday' ? 6 : 0
  let count = 0
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month - 1, d)
    if (dt.getMonth() !== month - 1) break
    const dow = getDay(dt)
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (dow === targetDow || (dayType !== 'saturday' && dow === 0)) {
      if (ds === dateStr) {
        const idx = (rotation.startIndex + count) % rotation.patterns.length
        return idx
      }
      count++
    }
  }
  return rotation.startIndex % rotation.patterns.length
}

/** NexusBC固定ルールを適用する（日曜14:00〜17:00の第1・第2全面） */
function applyNexusBcRule(slots: SlotEntry[]): SlotEntry[] {
  return slots.map((s) => {
    if (s.timeSlot === '14:00〜17:00' && (s.facility === '第1全面' || s.facility === '第2全面')) {
      return { ...s, clubName: 'NexusBC' }
    }
    return s
  })
}

/** 曜日インデックス（0=月,1=火,...,4=金）から平日スケジュールを取得 */
function getWeekdaySlots(dowIndex: number, config: AppConfig): SlotEntry[] {
  if (!config.weekdaySchedule) return []
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  return config.weekdaySchedule[keys[dowIndex]] ?? []
}

/** 指定日のスケジュールを生成する */
export function getDaySchedule(
  dateStr: string,
  config: AppConfig,
  year: number,
  month: number,
): SlotEntry[] {
  const { type } = getDayType(dateStr, config)

  if (type === 'weekday' || type === 'schoolEvent') {
    const dow = getDay(new Date(dateStr + 'T00:00:00'))
    // 月=1, 火=2, ... 金=5（0-indexedに変換）
    const dowIndex = dow - 1
    if (dowIndex < 0 || dowIndex > 4) return []
    return getWeekdaySlots(dowIndex, config)
  }

  if (type === 'saturday') {
    if (!config.saturdayRotation) return []
    const idx = getRotationIndex(dateStr, 'saturday', config, year, month)
    return config.saturdayRotation.patterns[idx] ?? []
  }

  if (type === 'sunday' || type === 'holiday' || type === 'longBreak') {
    if (!config.sundayRotation) return []
    const idx = getRotationIndex(dateStr, 'sunday', config, year, month)
    const slots = config.sundayRotation.patterns[idx] ?? []
    return applyNexusBcRule(slots)
  }

  return []
}
