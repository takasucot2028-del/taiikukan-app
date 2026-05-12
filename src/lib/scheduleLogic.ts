import { getDay } from 'date-fns'
import type { AppConfig, SlotEntry, DayType, DayPattern, Rotation, Reservation } from '../types'

function isSummer(month: number): boolean {
  return month >= 5 && month <= 10
}

export function getDayType(
  dateStr: string,
  config: AppConfig,
): { type: DayType; eventName?: string; scheduleType?: 'weekday' | 'rotation' } {
  const schoolEvent = config.schoolEvents.find((e) => e.date === dateStr)
  if (schoolEvent) {
    console.log(`[scheduleLogic] 学校行事 ${dateStr}: name=${schoolEvent.name} type=${schoolEvent.type ?? 'weekday(default)'}`)
    return {
      type: 'schoolEvent',
      eventName: schoolEvent.name,
      scheduleType: schoolEvent.type ?? 'weekday',
    }
  }

  const holiday = config.holidays.find((h) => h.date === dateStr)
  if (holiday) return { type: 'holiday', eventName: holiday.name }

  const dow = getDay(new Date(dateStr + 'T00:00:00'))
  if (dow === 6) return { type: 'saturday' }
  if (dow === 0) return { type: 'sunday' }
  return { type: 'weekday' }
}

/** 通常土曜（rotation学校行事を除く）の月内連番（0-indexed） */
function getNthSatInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const dow = getDay(new Date(year, month - 1, d))
    if (dow !== 6) continue
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'rotation') continue  // 休暇ローテーション枠
    count++
  }
  return count
}

/** 通常日曜・祝日（rotation学校行事を除く）の月内連番（0-indexed） */
function getNthSunInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = getDay(new Date(year, month - 1, d))
    const ev = config.schoolEvents.find((e) => e.date === ds)
    const isHoliday = config.holidays.some((h) => h.date === ds)
    if (ev?.type === 'rotation') continue  // 休暇ローテーション枠
    if (dow === 0 || isHoliday) count++
  }
  return count
}

/** rotation学校行事（曜日不問）の月内連番（0-indexed） */
function getNthVacInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'rotation') count++
  }
  return count
}

function getRotationPattern(
  patterns: DayPattern[],
  startIndex: number,
  nthOccurrence: number,
): DayPattern {
  if (patterns.length === 0) return []
  const validPatterns = patterns.filter((p) => p.length > 0)
  if (validPatterns.length === 0) return []
  const idx = (startIndex + nthOccurrence) % validPatterns.length
  return validPatterns[idx]
}

function applyRotation(
  rotation: Rotation,
  nth: number,
  label: string,
  dateStr: string,
): SlotEntry[] {
  const result = getRotationPattern(rotation.patterns, rotation.startIndex, nth)
  const rotNum = Math.max(rotation.patterns.filter(p => p.length > 0).length, 1)
  const patIdx = ((rotation.startIndex + nth) % rotNum) + 1
  console.log(`[schedule] ${label} ${dateStr}: ${nth + 1}番目 パターン${patIdx} → ${result.length}スロット`)
  return result
}

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

export function getDaySchedule(
  dateStr: string,
  config: AppConfig,
  month: number,
): SlotEntry[] {
  const { type, scheduleType } = getDayType(dateStr, config)
  const summer = isSummer(month)
  const dow = getDay(new Date(dateStr + 'T00:00:00'))

  // 平日 or 学校行事（平日スケジュール）
  if (type === 'weekday' || (type === 'schoolEvent' && scheduleType !== 'rotation')) {
    if (!config.weekdaySchedule) return []
    const keyMap: Record<number, keyof NonNullable<AppConfig['weekdaySchedule']>> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday',
    }
    const key = keyMap[dow]
    const slots = key ? (config.weekdaySchedule[key] ?? []) : []
    return slots.map((s) => ({ ...s, timeSlot: s.timeSlot || '16:00〜18:00' }))
  }

  // 学校行事（rotation）→ 夏季/冬季休暇ローテーション
  if (type === 'schoolEvent' && scheduleType === 'rotation') {
    const rotation = summer ? config.summerVacationRotation : config.winterVacationRotation
    if (!rotation) return []
    const nth = getNthVacInMonth(dateStr, config)
    return applyRotation(rotation, nth, summer ? '夏季休暇ローテーション' : '冬季休暇ローテーション', dateStr)
  }

  // 土曜 → 夏季/冬季土曜ローテーション
  if (type === 'saturday') {
    const rotation = summer ? config.saturdayRotation : config.winterSaturdayRotation
    if (!rotation) return []
    const nth = getNthSatInMonth(dateStr, config)
    return applyRotation(rotation, nth, summer ? '夏季土曜ローテーション' : '冬季土曜ローテーション', dateStr)
  }

  // 日曜・祝日 → 夏季/冬季日曜ローテーション
  if (type === 'sunday' || type === 'holiday' || type === 'longBreak') {
    const rotation = summer ? config.sundayRotation : config.winterSundayRotation
    if (!rotation) return []
    const nth = getNthSunInMonth(dateStr, config)
    const slots = getRotationPattern(rotation.patterns, rotation.startIndex, nth)
    const result = applyNexusBcRule(slots)
    const rotNum = Math.max(rotation.patterns.filter(p => p.length > 0).length, 1)
    const patIdx = ((rotation.startIndex + nth) % rotNum) + 1
    console.log(`[schedule] ${summer ? '夏季' : '冬季'}日曜ローテーション ${dateStr}: ${nth + 1}番目 パターン${patIdx} → ${result.length}スロット`)
    return result
  }

  return []
}

/** カレンダーセル用：日付のスケジュール概要（deleted_slot・schedule優先適用済み）
 *  filterClubs: 空配列 = 全表示、1件以上 = 該当クラブのみ */
export function getDayClubSummary(
  dateStr: string,
  config: AppConfig,
  month: number,
  filterClub: string | string[],
  reservations?: Reservation[],
): string[] {
  const baseSlots = getDaySchedule(dateStr, config, month)
  let effective: SlotEntry[] = [...baseSlots]

  if (reservations && reservations.length > 0) {
    const dayRes = reservations.filter((r) => r.date === dateStr)
    const deletedSlots = dayRes.filter((r) => r.entryType === 'deleted_slot')
    const userSchedule = dayRes.filter((r) => r.entryType === 'schedule')

    effective = effective.filter(
      (s) => !userSchedule.some((r) => r.timeSlot === s.timeSlot && r.facility === s.facility)
    )
    effective = effective.filter(
      (s) => !deletedSlots.some((d) => d.timeSlot === s.timeSlot && d.facility === s.facility)
    )
    userSchedule.forEach((r) => {
      effective.push({ timeSlot: r.timeSlot, facility: r.facility, clubName: r.clubName })
    })
  }

  const clubs = Array.isArray(filterClub) ? filterClub : (filterClub ? [filterClub] : [])
  const filtered = clubs.length > 0 ? effective.filter((s) => clubs.includes(s.clubName)) : effective
  return [...new Set(filtered.map((s) => s.clubName))]
}
