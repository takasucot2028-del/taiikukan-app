import type { AppConfig, Reservation } from '../types'

const GAS_URL = import.meta.env.VITE_GAS_URL ?? 'YOUR_GAS_WEBAPP_URL'

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('GASがHTMLを返しました（デプロイ設定を確認してください）')
  return JSON.parse(text) as T
}

async function gasPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
  })
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('GASがHTMLを返しました（デプロイ設定を確認してください）')
  return JSON.parse(text) as T
}

export const gasApi = {
  getConfig: () => gasGet<AppConfig>('getConfig'),

  getReservations: (year: number, month: number) =>
    gasGet<Reservation[]>('getReservations', { year: String(year), month: String(month) }),

  /** 占有予約申請（type: reservation） */
  addReservation: (data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'adminMemo' | 'entryType'>) =>
    gasPost<{ success: boolean; id: string }>('addReservation', { ...data, entryType: 'reservation' }),

  /** 指導者スケジュール追加（type: schedule） */
  addScheduleEntry: (data: { clubName: string; date: string; timeSlot: string; facility: string; content: string }) =>
    gasPost<{ success: boolean; id: string }>('addReservation', { ...data, entryType: 'schedule', comment: '' }),

  updateReservation: (id: string, data: Partial<Reservation>) =>
    gasPost<{ success: boolean }>('updateReservation', { id, ...data }),

  updateStatus: (id: string, status: string, adminMemo?: string) =>
    gasPost<{ success: boolean }>('updateStatus', { id, status, adminMemo }),

  cancelReservation: (id: string) =>
    gasPost<{ success: boolean }>('updateReservation', { id, status: '取り消し' }),

  /** スケジュールエントリを削除（論理削除） */
  deleteScheduleEntry: (id: string) =>
    gasPost<{ success: boolean }>('deleteReservation', { id }),

  /** 固定・ローテーション枠を空き枠としてマーク（deleted_slot） */
  deleteSlot: (data: { clubName: string; date: string; timeSlot: string; facility: string; deletedBy: string }) =>
    gasPost<{ success: boolean; id: string }>('addReservation', {
      clubName: data.clubName,
      date: data.date,
      timeSlot: data.timeSlot,
      facility: data.facility,
      content: '',
      comment: data.deletedBy,
      entryType: 'deleted_slot',
    }),

  /** deleted_slot を削除してスロットを元に戻す */
  restoreSlot: (id: string) =>
    gasPost<{ success: boolean }>('deleteReservation', { id }),
}
