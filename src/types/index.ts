export type ReservationStatus = '申請中' | '確定' | '却下'

export interface Club {
  id: string
  name: string
}

export interface Reservation {
  id: string
  createdAt: string
  clubName: string
  date: string
  timeSlot: TimeSlot
  facility: string       // scheduleエントリは施設名文字列をそのまま使用
  content: string
  comment: string
  status: ReservationStatus
  adminMemo: string
  updatedAt: string
  entryType: 'reservation' | 'schedule' | 'deleted_slot'
}

export type TimeSlot =
  | '8:00〜11:00'
  | '11:00〜14:00'
  | '14:00〜17:00'
  | '16:00〜18:00'
  | '終日'

export type Facility =
  | '第1体育館（全面）'
  | '第1体育館 半面A'
  | '第1体育館 半面B'
  | '第1体育館 ステージ'
  | '第2体育館（全面）'
  | '総合体育館（全面）'
  | '総合体育館 半面A'
  | '総合体育館 半面B'

export interface Holiday {
  date: string
  name: string
}

export interface SchoolEvent {
  date: string
  name: string
}

// 施設・時間帯ごとの使用1コマ
export interface SlotEntry {
  timeSlot: string
  facility: string
  clubName: string
}

export type DayPattern = SlotEntry[]

// 平日固定スケジュール（曜日別）
export interface WeekdaySchedule {
  monday:    DayPattern
  tuesday:   DayPattern
  wednesday: DayPattern
  thursday:  DayPattern
  friday:    DayPattern
}

// ローテーション（夏期・冬期のパターン群）
export interface Rotation {
  summerPatterns: DayPattern[]  // 5〜10月
  winterPatterns: DayPattern[]  // 11〜4月
  startIndex: number            // 今月の開始パターン（0-indexed = パターン番号-1）
}

export interface AppConfig {
  clubs: Club[]
  holidays: Holiday[]
  schoolEvents: SchoolEvent[]
  adminPin: string
  weekdaySchedule:  WeekdaySchedule | null
  saturdayRotation: Rotation | null
  sundayRotation:   Rotation | null
}

export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday' | 'schoolEvent' | 'longBreak'
