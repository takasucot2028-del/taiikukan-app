export type ReservationStatus = '申請中' | '確定' | '却下'

export interface Club {
  id: string
  name: string
  color?: string
}

export interface Reservation {
  id: string
  createdAt: string
  clubName: string
  date: string        // YYYY-MM-DD
  timeSlot: TimeSlot
  facility: Facility
  content: string
  comment: string
  status: ReservationStatus
  adminMemo: string
  updatedAt: string
}

export type TimeSlot =
  | '8:00〜11:00'
  | '11:00〜14:00'
  | '14:00〜17:00'
  | '16:00〜18:00'
  | '終日'

export type Facility =
  | '第1体育館'
  | '第2体育館'
  | '総合体育館'
  | '第1・第2体育館'
  | '全施設'

export interface Holiday {
  date: string  // YYYY-MM-DD
  name: string
}

export interface SchoolEvent {
  date: string  // YYYY-MM-DD
  name: string
}

export interface AppConfig {
  clubs: Club[]
  holidays: Holiday[]
  schoolEvents: SchoolEvent[]
  adminPin: string
}

export interface DayInfo {
  date: string   // YYYY-MM-DD
  dayType: 'weekday' | 'saturday' | 'sunday' | 'holiday' | 'schoolEvent' | 'longBreak'
  eventName?: string
  reservations: Reservation[]
}
