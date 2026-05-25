import { getDay } from 'date-fns'
import type { AppConfig, SlotEntry, DayType, DayPattern, Rotation, Reservation, SchoolEventType } from '../types'

function isSummer(month: number): boolean {
  return month >= 5 && month <= 10
}

export function getDayType(
  dateStr: string,
  config: AppConfig,
): { type: DayType; eventName?: string; scheduleType?: SchoolEventType } {
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

/** 夏季土曜ローテーション用カウンター（0-indexed）
 *  summerSat指定日 + rotation指定の土曜 を除いた通常土曜を数える */
function getNthSatInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const dow = getDay(new Date(year, month - 1, d))
    if (dow !== 6) continue
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    // summerSat/winterSat/rotation（土曜）は専用カウンターで扱うのでスキップ
    if (ev?.type === 'summerSat' || ev?.type === 'winterSat') continue
    if (ev?.type === 'rotation' && dow === 6) continue
    count++
  }
  return count
}

/** summerSat 指定日の月内連番（0-indexed） */
function getNthSummerSatInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'summerSat') count++
  }
  return count
}

/** summerSun 指定日の月内連番（0-indexed） */
function getNthSummerSunInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'summerSun') count++
  }
  return count
}

/** summerVac 指定日の月内連番（0-indexed） */
function getNthSummerVacInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'summerVac') count++
  }
  return count
}

/** winterSat 指定日の月内連番（0-indexed） */
function getNthWinterSatInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'winterSat') count++
  }
  return count
}

/** winterSun 指定日の月内連番（0-indexed） */
function getNthWinterSunInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'winterSun') count++
  }
  return count
}

/** winterVac 指定日の月内連番（0-indexed） */
function getNthWinterVacInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'winterVac') count++
  }
  return count
}

/** 日曜・祝日（summerSun/winterSun/rotation日曜を含む）の月内連番（0-indexed）
 *  summerSat/winterSat/rotation（平日・土曜）は除外 */
function getNthSunInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = getDay(new Date(year, month - 1, d))
    const ev = config.schoolEvents.find((e) => e.date === ds)
    const isHoliday = config.holidays.some((h) => h.date === ds)
    // summerSat/winterSat/rotation（土曜・平日）は別カウンターなのでスキップ
    if (ev?.type === 'summerSat' || ev?.type === 'winterSat') continue
    if (ev?.type === 'summerVac' || ev?.type === 'winterVac') continue
    if (ev?.type === 'rotation' && dow !== 0) continue
    if (dow === 0 || isHoliday) count++
  }
  return count
}

/** rotation学校行事（後方互換・日曜を除く）の月内連番（0-indexed） */
function getNthVacInMonth(dateStr: string, config: AppConfig): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  let count = 0
  for (let d = 1; d < day; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = getDay(new Date(year, month - 1, d))
    const ev = config.schoolEvents.find((e) => e.date === ds)
    if (ev?.type === 'rotation' && dow !== 0) count++
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

  // 平日（学校行事なし）
  if (type === 'weekday') {
    if (!config.weekdaySchedule) return []
    const keyMap: Record<number, keyof NonNullable<AppConfig['weekdaySchedule']>> = {
      1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday',
    }
    const key = keyMap[dow]
    const slots = key ? (config.weekdaySchedule[key] ?? []) : []
    return slots.map((s) => ({ ...s, timeSlot: s.timeSlot || '16:00〜18:00' }))
  }

  // 学校行事 → scheduleType に応じてローテーションを選択
  if (type === 'schoolEvent') {
    switch (scheduleType) {
      case 'weekday': {
        if (!config.weekdaySchedule) return []
        const keyMap: Record<number, keyof NonNullable<AppConfig['weekdaySchedule']>> = {
          1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday',
        }
        const key = keyMap[dow]
        const slots = key ? (config.weekdaySchedule[key] ?? []) : []
        return slots.map((s) => ({ ...s, timeSlot: s.timeSlot || '16:00〜18:00' }))
      }
      case 'summerSat': {
        const rotation = config.saturdayRotation
        if (!rotation) return []
        const nth = getNthSummerSatInMonth(dateStr, config)
        return applyRotation(rotation, nth, '夏季土曜ローテーション', dateStr)
      }
      case 'summerSun': {
        const rotation = config.sundayRotation
        if (!rotation) return []
        const nth = getNthSummerSunInMonth(dateStr, config)
        const slots = getRotationPattern(rotation.patterns, rotation.startIndex, nth)
        const result = applyNexusBcRule(slots)
        const rotNum = Math.max(rotation.patterns.filter((p) => p.length > 0).length, 1)
        const patIdx = ((rotation.startIndex + nth) % rotNum) + 1
        console.log(`[schedule] 夏季日曜ローテーション ${dateStr}: ${nth + 1}番目 パターン${patIdx} → ${result.length}スロット`)
        return result
      }
      case 'summerVac': {
        const rotation = config.summerVacationRotation
        if (!rotation) return []
        const nth = getNthSummerVacInMonth(dateStr, config)
        return applyRotation(rotation, nth, '夏季休暇ローテーション', dateStr)
      }
      case 'winterSat': {
        const rotation = config.winterSaturdayRotation
        if (!rotation) return []
        const nth = getNthWinterSatInMonth(dateStr, config)
        return applyRotation(rotation, nth, '冬季土曜ローテーション', dateStr)
      }
      case 'winterSun': {
        const rotation = config.winterSundayRotation
        if (!rotation) return []
        const nth = getNthWinterSunInMonth(dateStr, config)
        const slots = getRotationPattern(rotation.patterns, rotation.startIndex, nth)
        const result = applyNexusBcRule(slots)
        const rotNum = Math.max(rotation.patterns.filter((p) => p.length > 0).length, 1)
        const patIdx = ((rotation.startIndex + nth) % rotNum) + 1
        console.log(`[schedule] 冬季日曜ローテーション ${dateStr}: ${nth + 1}番目 パターン${patIdx} → ${result.length}スロット`)
        return result
      }
      case 'winterVac': {
        const rotation = config.winterVacationRotation
        if (!rotation) return []
        const nth = getNthWinterVacInMonth(dateStr, config)
        return applyRotation(rotation, nth, '冬季休暇ローテーション', dateStr)
      }
      case 'rotation':
      default: {
        // 後方互換: rotation は曜日に応じて夏季/冬季の日曜/休暇ローテーションを適用
        if (dow === 0) {
          const rotation = summer ? config.sundayRotation : config.winterSundayRotation
          if (!rotation) return []
          const nth = getNthSunInMonth(dateStr, config)
          const slots = getRotationPattern(rotation.patterns, rotation.startIndex, nth)
          const result = applyNexusBcRule(slots)
          const rotNum = Math.max(rotation.patterns.filter((p) => p.length > 0).length, 1)
          const patIdx = ((rotation.startIndex + nth) % rotNum) + 1
          console.log(`[schedule] ${summer ? '夏季' : '冬季'}日曜ローテーション（rotation後方互換）${dateStr}: ${nth + 1}番目 パターン${patIdx} → ${result.length}スロット`)
          return result
        }
        const rotation = summer ? config.summerVacationRotation : config.winterVacationRotation
        if (!rotation) return []
        const nth = getNthVacInMonth(dateStr, config)
        return applyRotation(rotation, nth, summer ? '夏季休暇ローテーション' : '冬季休暇ローテーション', dateStr)
      }
    }
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
    const deletedSlotItems = dayRes.filter((r) => r.entryType === 'deleted_slot')
    const scheduleTypeItems = dayRes.filter((r) => r.entryType === 'schedule')
    if (scheduleTypeItems.length > 0 || deletedSlotItems.length > 0) {
      console.log('[getDaySchedule] reservations数:', reservations.length, 'date:', dateStr)
      console.log('[getDaySchedule] scheduleItems:', scheduleTypeItems.length, scheduleTypeItems.map(r => ({ club: r.clubName, slot: r.timeSlot, facility: r.facility })))
    }

    const confirmedResvItems = dayRes.filter(
      (r) => r.entryType === 'reservation' && r.status === '確定'
    )

    effective = effective.filter(
      (s) => !scheduleTypeItems.some((r) => r.timeSlot === s.timeSlot && r.facility === s.facility)
    )
    effective = effective.filter(
      (s) => !deletedSlotItems.some((d) => d.timeSlot === s.timeSlot && d.facility === s.facility)
    )
    effective = effective.filter(
      (s) => !confirmedResvItems.some((r) => r.timeSlot === s.timeSlot && r.facility === s.facility)
    )
    scheduleTypeItems.forEach((r) => {
      effective.push({ timeSlot: r.timeSlot, facility: r.facility, clubName: r.clubName })
    })
    confirmedResvItems.forEach((r) => {
      effective.push({ timeSlot: r.timeSlot, facility: r.facility, clubName: r.clubName })
    })
    console.log('[schedule] 予約データ適用:', {
      date: dateStr,
      scheduleItems: scheduleTypeItems.length,
      deletedSlots: deletedSlotItems.length,
      confirmedReservations: confirmedResvItems.length,
      result: effective.length
    })
  }

  const clubs = Array.isArray(filterClub) ? filterClub : (filterClub ? [filterClub] : [])
  const filtered = clubs.length > 0 ? effective.filter((s) => clubs.includes(s.clubName)) : effective
  return [...new Set(filtered.map((s) => s.clubName))]
}
