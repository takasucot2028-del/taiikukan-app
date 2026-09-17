import type { Reservation } from '../types'

/** GASでは処理済みだが結果を受け取れず、一覧でまだ確認できていない占有申請。
 *  通信が不安定なときに「失敗した」と思って二重申請されるのを防ぐため、端末に記録しておく。 */
export interface PendingSubmission {
  clubName: string
  date: string
  timeSlot: string
  facility: string
  content: string
  submittedAt: number
}

type Slot = Pick<PendingSubmission, 'clubName' | 'date' | 'timeSlot' | 'facility'>

const STORAGE_KEY = 'pending_submissions'
/** これより古い記録は、反映済みか管理者が対応済みとみなして破棄する */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

const isSameSlot = (a: Slot, b: Slot) =>
  a.clubName === b.clubName && a.date === b.date && a.timeSlot === b.timeSlot && a.facility === b.facility

function load(): PendingSubmission[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(list)) return []
    return (list as PendingSubmission[]).filter((p) => Date.now() - p.submittedAt < MAX_AGE_MS)
  } catch {
    return []
  }
}

function save(list: PendingSubmission[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // localStorage unavailable or full
  }
}

export function addPendingSubmission(submission: Omit<PendingSubmission, 'submittedAt'>): void {
  save([...load(), { ...submission, submittedAt: Date.now() }])
}

export function getPendingSubmissions(clubName: string): PendingSubmission[] {
  return load().filter((p) => p.clubName === clubName)
}

/** 同じクラブ・日付・時間帯・施設の申請が、送信済み（反映確認中）として記録されているか */
export function hasPendingSubmission(slot: Slot): boolean {
  return load().some((p) => isSameSlot(p, slot))
}

/** 取得できた予約データに同じ申請があれば、反映済みとして記録から外す（期限切れの記録も併せて破棄） */
export function reconcilePendingSubmissions(reservations: Reservation[]): void {
  const remaining = load().filter((p) => !reservations.some(
    (r) => r.entryType === 'reservation' && isSameSlot(r, p) && r.content === p.content,
  ))
  save(remaining)
}
