export const CACHE_TTL = {
  config: 5 * 60 * 1000,
  reservations: 60 * 1000,
}

export function getCached<T>(key: string, ttl: number): T | null {
  try {
    const item = localStorage.getItem('cache_' + key)
    if (!item) return null
    const { data, timestamp } = JSON.parse(item) as { data: T; timestamp: number }
    if (Date.now() - timestamp > ttl) return null
    return data
  } catch {
    return null
  }
}

export function setCache(key: string, data: unknown): void {
  try {
    localStorage.setItem('cache_' + key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage unavailable or full
  }
}

export function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem('cache_' + key)
    } else {
      Object.keys(localStorage)
        .filter(k => k.startsWith('cache_'))
        .forEach(k => localStorage.removeItem(k))
    }
  } catch {
    // ignore
  }
}

export function clearReservationCaches(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('cache_reservations_'))
      .forEach(k => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
