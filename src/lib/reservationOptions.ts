import type { TimeSlot, Facility } from '../types'

/** 占有予約で選択できる時間帯 */
export const RESERVATION_TIME_SLOTS: TimeSlot[] = [
  '8:00〜11:00',
  '11:00〜14:00',
  '14:00〜17:00',
  '8:00〜10:30',
  '10:30〜13:00',
  '13:00〜15:30',
  '16:00〜18:00',
  '終日',
]

/** 占有予約で選択できる施設（体育館ごとにグループ化） */
export const RESERVATION_FACILITY_GROUPS: { label: string; options: Facility[] }[] = [
  {
    label: '第1体育館',
    options: ['第1体育館（全面）', '第1体育館 半面A', '第1体育館 半面B', '第1体育館 ステージ'],
  },
  {
    label: '第2体育館',
    options: ['第2体育館（全面）'],
  },
  {
    label: '総合体育館',
    options: ['総合体育館（全面）', '総合体育館 半面A', '総合体育館 半面B'],
  },
]
