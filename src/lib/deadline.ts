/** 占有予約の申請締切ルール
 *  対象月の予約は「前月20日」までに申請する（例：8月分 → 7月20日締切）。
 *  締切を過ぎた申請は指導者側では警告のみ（送信は可能）で、
 *  事務局が管理者画面から追加・修正して対応する。 */

/** GASが返す日時（"YYYY-MM-DD HH:mm:ss"）を安全にDate化する。
 *  Safariはスペース区切りをInvalid Dateにするため、ISO形式へ正規化してから解釈する。 */
export function parseDateTime(value: string): Date {
  if (!value) return new Date(NaN)
  return new Date(value.trim().replace(' ', 'T'))
}

/** 対象日が属する月の申請締切（前月20日の終わり） */
export function getApplicationDeadline(targetDate: string): Date {
  const [year, month] = targetDate.split('-').map(Number)
  // month は1始まり。前月20日 = new Date(year, (month-1)-1, 20)
  return new Date(year, month - 2, 20, 23, 59, 59, 999)
}

/** 対象日の申請が締切を過ぎているか */
export function isAfterDeadline(targetDate: string, now: Date = new Date()): boolean {
  if (!targetDate) return false
  const deadline = getApplicationDeadline(targetDate)
  if (isNaN(deadline.getTime())) return false
  return now.getTime() > deadline.getTime()
}

/** 締切の表示用文字列（例：「7月20日」） */
export function formatDeadline(targetDate: string): string {
  const d = getApplicationDeadline(targetDate)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
