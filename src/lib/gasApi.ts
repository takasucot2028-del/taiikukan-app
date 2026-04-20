import type { AppConfig, Reservation } from '../types'

const GAS_URL = import.meta.env.VITE_GAS_URL ?? 'YOUR_GAS_WEBAPP_URL'

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  })

  const text = await res.text()

  // GASがHTMLエラーページを返した場合
  if (text.trimStart().startsWith('<')) {
    throw new Error(`GASがHTMLを返しました（デプロイ設定を確認してください）`)
  }

  try {
    const json = JSON.parse(text) as T
    return json
  } catch {
    throw new Error(`JSONパースエラー: ${text.slice(0, 200)}`)
  }
}

async function gasPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' }, // GASはapplication/jsonでpreflight発生するためtext/plainを使用
    body: JSON.stringify({ action, ...body }),
  })

  const text = await res.text()

  if (text.trimStart().startsWith('<')) {
    throw new Error(`GASがHTMLを返しました（デプロイ設定を確認してください）`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`JSONパースエラー: ${text.slice(0, 200)}`)
  }
}

export const gasApi = {
  getConfig: () => gasGet<AppConfig>('getConfig'),

  getReservations: (year: number, month: number) =>
    gasGet<Reservation[]>('getReservations', {
      year: String(year),
      month: String(month),
    }),

  addReservation: (data: Omit<Reservation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'adminMemo'>) =>
    gasPost<{ success: boolean; id: string }>('addReservation', data),

  updateReservation: (id: string, data: Partial<Reservation>) =>
    gasPost<{ success: boolean }>('updateReservation', { id, ...data }),

  updateStatus: (id: string, status: string, adminMemo?: string) =>
    gasPost<{ success: boolean }>('updateStatus', { id, status, adminMemo }),

  cancelReservation: (id: string) =>
    gasPost<{ success: boolean }>('updateReservation', { id, status: '取り消し' }),
}
