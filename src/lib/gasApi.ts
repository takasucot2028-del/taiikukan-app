import type { AppConfig, Reservation } from '../types'

// スプレッドシートIDとGAS URLは環境変数または定数で管理
const GAS_URL = import.meta.env.VITE_GAS_URL ?? 'YOUR_GAS_WEBAPP_URL'

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(GAS_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`GAS error: ${res.status}`)
  return res.json() as Promise<T>
}

async function gasPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  })
  if (!res.ok) throw new Error(`GAS error: ${res.status}`)
  return res.json() as Promise<T>
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
