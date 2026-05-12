import type { AppConfig, Reservation } from '../types'
import { getCached, setCache, clearCache, clearReservationCaches, CACHE_TTL } from './cache'

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
  getConfig: async () => {
    const cached = getCached<AppConfig>('config', CACHE_TTL.config)
    if (cached) { console.log('[cache] config hit'); return cached }
    const data = await gasGet<AppConfig>('getConfig')
    setCache('config', data)
    return data
  },

  getReservations: async (year: number, month: number) => {
    const key = `reservations_${year}_${month}`
    const cached = getCached<Reservation[]>(key, CACHE_TTL.reservations)
    if (cached) { console.log('[cache] reservations hit', year, month); return cached }
    const data = await gasGet<Reservation[]>('getReservations', { year: String(year), month: String(month) })
    setCache(key, data)
    return data
  },

  /** 占有予約申請（type: reservation） */
  addReservation: async (data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'adminMemo' | 'entryType'>) => {
    const result = await gasPost<{ success: boolean; id: string }>('addReservation', { ...data, entryType: 'reservation' })
    clearReservationCaches()
    return result
  },

  /** 指導者スケジュール追加（type: schedule） */
  addScheduleEntry: async (data: { clubName: string; date: string; timeSlot: string; facility: string; content: string }) => {
    const result = await gasPost<{ success: boolean; id: string }>('addReservation', { ...data, entryType: 'schedule', comment: '' })
    clearReservationCaches()
    return result
  },

  updateReservation: async (id: string, data: Partial<Reservation>) => {
    const result = await gasPost<{ success: boolean }>('updateReservation', { id, ...data })
    clearReservationCaches()
    return result
  },

  updateStatus: async (id: string, status: string, adminMemo?: string) => {
    const result = await gasPost<{ success: boolean }>('updateStatus', { id, status, adminMemo })
    clearReservationCaches()
    return result
  },

  cancelReservation: async (id: string) => {
    const result = await gasPost<{ success: boolean }>('updateReservation', { id, status: '取り消し' })
    clearReservationCaches()
    return result
  },

  /** スケジュールエントリを削除（論理削除） */
  deleteScheduleEntry: async (id: string) => {
    const result = await gasPost<{ success: boolean }>('deleteReservation', { id })
    clearReservationCaches()
    return result
  },

  /** 固定・ローテーション枠を空き枠としてマーク（deleted_slot） */
  deleteSlot: async (data: { clubName: string; date: string; timeSlot: string; facility: string; deletedBy: string }) => {
    const result = await gasPost<{ success: boolean; id: string }>('addReservation', {
      clubName: data.clubName,
      date: data.date,
      timeSlot: data.timeSlot,
      facility: data.facility,
      content: '',
      comment: data.deletedBy,
      entryType: 'deleted_slot',
    })
    clearReservationCaches()
    return result
  },

  /** deleted_slot を削除してスロットを元に戻す */
  restoreSlot: async (id: string) => {
    const result = await gasPost<{ success: boolean }>('deleteReservation', { id })
    clearReservationCaches()
    return result
  },

  /** 月間予定表を確定する */
  confirmMonth: async (year: number, month: number) => {
    const result = await gasPost<{ success: boolean; id: string }>('addReservation', {
      clubName: '管理者',
      date: `${year}-${String(month).padStart(2, '0')}-01`,
      timeSlot: '',
      facility: '',
      content: `${year}年${month}月`,
      comment: '',
      entryType: 'confirmed_month',
    })
    clearReservationCaches()
    return result
  },

  /** 月間確定を取り消す */
  unconfirmMonth: async (id: string) => {
    const result = await gasPost<{ success: boolean }>('deleteReservation', { id })
    clearReservationCaches()
    return result
  },

  /** 設定を保存する */
  saveConfig: async (config: AppConfig & { satStartIndex?: number; sunStartIndex?: number }) => {
    const result = await gasPost<{ success: boolean }>('saveConfig', { config })
    clearCache('config')
    return result
  },

  /** ログを取得する */
  getLogs: (params?: { year?: string; month?: string }) =>
    gasGet<{ timestamp: string; action: string; actor: string; detail: string }[]>('getLogs', params ?? {}),

  /** プッシュ通知subscriptionを登録 */
  registerPush: (subscription: PushSubscriptionJSON, clubName: string) =>
    gasPost<{ success: boolean }>('registerPush', { subscription, clubName }),

  /** プッシュ通知を送信 */
  sendPushNotification: (title: string, body: string) =>
    gasPost<{ success: boolean; sent: number }>('sendNotification', { title, body }),

  /** プッシュ通知の統計を取得 */
  getPushStats: () =>
    gasGet<{ registeredCount: number; history: { timestamp: string; title: string; sent: number }[] }>('getPushStats'),
}
