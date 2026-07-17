import type { Reservation } from '../types'

/** 施設の物理的な包含関係：全面を押さえると同じ体育館の半面も使えなくなる。
 *  ステージは床面とは別スペースのため全面には含めない。 */
const FACILITY_PARTS: Record<string, string[]> = {
  '第1体育館（全面）': ['第1体育館 半面A', '第1体育館 半面B'],
  '第2体育館（全面）': [],
  '総合体育館（全面）': ['総合体育館 半面A', '総合体育館 半面B'],
}

/** 施設名の表記ゆれを吸収する（例：「第1体育館 全面」→「第1体育館（全面）」） */
export function normalizeFacility(facility: string): string {
  if (!facility) return ''
  return facility.trim().replace(/\s*全面\s*$/, '（全面）')
}

/** 2つの施設が物理的に重なるか（全面 ⇔ 半面 を含む） */
export function facilitiesOverlap(a: string, b: string): boolean {
  const na = normalizeFacility(a)
  const nb = normalizeFacility(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if ((FACILITY_PARTS[na] ?? []).includes(nb)) return true
  if ((FACILITY_PARTS[nb] ?? []).includes(na)) return true
  return false
}

/** 時間帯を「その日の何分から何分まで」に変換する。「終日」は全時間。 */
function parseTimeRange(slot: string): [number, number] | null {
  if (!slot) return null
  if (slot === '終日') return [0, 24 * 60]
  const m = slot.match(/^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]
}

/** 2つの時間帯が実時刻として重なるか。
 *  「終日」や、休暇の新時間帯と従来時間帯の混在（例 8:00〜11:00 と 8:00〜10:30）も正しく判定する。 */
export function timeSlotsOverlap(a: string, b: string): boolean {
  if (a === b) return true
  const ra = parseTimeRange(a)
  const rb = parseTimeRange(b)
  // 解釈できない表記は完全一致のみを重なりとみなす
  if (!ra || !rb) return false
  return ra[0] < rb[1] && rb[0] < ra[1]
}

/** その日の確定済み占有予約 */
export function getConfirmedOccupancies(dateStr: string, reservations?: Reservation[]): Reservation[] {
  if (!reservations) return []
  return reservations.filter(
    (r) => r.date === dateStr && r.entryType === 'reservation' && r.status === '確定'
  )
}

/** 指定の枠（時間帯×施設）と重なる確定占有を返す。無ければ undefined。 */
export function findOccupancy(
  timeSlot: string,
  facility: string,
  occupancies: Reservation[],
): Reservation | undefined {
  return occupancies.find(
    (o) => timeSlotsOverlap(o.timeSlot, timeSlot) && facilitiesOverlap(o.facility, facility)
  )
}
