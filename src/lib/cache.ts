export const CACHE_TTL = {
  config: 5 * 60 * 1000,
  reservations: 60 * 1000,
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  /** 保存直後などに無効化された。通常の読み出しには使わないが、通信失敗時の予備として残す */
  expired?: boolean
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const item = localStorage.getItem('cache_' + key)
    if (!item) return null
    return JSON.parse(item) as CacheEntry<T>
  } catch {
    return null
  }
}

export function getCached<T>(key: string, ttl: number): T | null {
  const entry = readEntry<T>(key)
  if (!entry || entry.expired) return null
  if (Date.now() - entry.timestamp > ttl) return null
  return entry.data
}

/** 有効期限切れ・無効化済みでも、最後に取得できたデータを返す（通信失敗時の予備表示用） */
export function getStale<T>(key: string): { data: T; timestamp: number } | null {
  const entry = readEntry<T>(key)
  if (!entry || typeof entry.timestamp !== 'number') return null
  return { data: entry.data, timestamp: entry.timestamp }
}

export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem('cache_' + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage unavailable or full
  }
}

function expireEntry(storageKey: string): void {
  try {
    const item = localStorage.getItem(storageKey)
    if (!item) return
    const entry = JSON.parse(item) as CacheEntry<unknown>
    localStorage.setItem(storageKey, JSON.stringify({ ...entry, expired: true }))
  } catch {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }
}

/** キャッシュを無効化する。
 *  key 指定時は次回必ず再取得させつつ、通信失敗時の予備としてデータは残す。key 省略時はすべて削除する。 */
export function clearCache(key?: string): void {
  if (key) {
    expireEntry('cache_' + key)
    return
  }
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_'))
      .forEach(k => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

/** 予約データのキャッシュを無効化する（通信失敗時の予備としてデータは残す） */
export function clearReservationCaches(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_reservations_'))
      .forEach(expireEntry)
  } catch {
    // ignore
  }
}
