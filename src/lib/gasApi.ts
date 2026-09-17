import type { AppConfig, Rotation, DayPattern, Reservation } from '../types'
import { getCached, getStale, setCache, clearCache, clearReservationCaches, CACHE_TTL } from './cache'
import { useAppStore } from '../store'

// 旧GAS形式（summerPatterns/winterPatterns）と新形式（patterns）の両方を受け付ける
type RawRotation = {
  patterns?: DayPattern[]
  summerPatterns?: DayPattern[]
  winterPatterns?: DayPattern[]
  startIndex?: number
}

function normalizeRotation(raw: RawRotation | null | undefined, winterPatterns?: DayPattern[]): Rotation | null {
  if (!raw) return null
  return {
    patterns: raw.patterns ?? raw.summerPatterns ?? winterPatterns ?? [],
    startIndex: raw.startIndex ?? 0,
  }
}

function normalizeConfig(raw: Record<string, unknown>): AppConfig {
  const rawSat = raw.saturdayRotation as RawRotation | null
  const rawSun = raw.sundayRotation as RawRotation | null
  return {
    clubs:         (raw.clubs         as AppConfig['clubs'])         ?? [],
    holidays:      (raw.holidays      as AppConfig['holidays'])      ?? [],
    schoolEvents:  (raw.schoolEvents  as AppConfig['schoolEvents'])  ?? [],
    adminPin:      (raw.adminPin      as string)                     ?? '',
    weekdaySchedule: (raw.weekdaySchedule as AppConfig['weekdaySchedule']) ?? null,
    // 夏季土曜：新形式 saturdayRotation.patterns、旧形式 saturdayRotation.summerPatterns
    saturdayRotation: normalizeRotation(rawSat),
    // 夏季日曜
    sundayRotation:   normalizeRotation(rawSun),
    // 夏季休暇
    summerVacationRotation: normalizeRotation(raw.summerVacationRotation as RawRotation | null),
    // 冬季土曜：新形式 winterSaturdayRotation、旧形式 saturdayRotation.winterPatterns
    winterSaturdayRotation:
      normalizeRotation(raw.winterSaturdayRotation as RawRotation | null) ??
      normalizeRotation(rawSat, rawSat?.winterPatterns),
    // 冬季日曜
    winterSundayRotation:
      normalizeRotation(raw.winterSundayRotation as RawRotation | null) ??
      normalizeRotation(rawSun, rawSun?.winterPatterns),
    // 冬季休暇
    winterVacationRotation: normalizeRotation(raw.winterVacationRotation as RawRotation | null),
  }
}

const GAS_URL = import.meta.env.VITE_GAS_URL ?? 'YOUR_GAS_WEBAPP_URL'

// ==========================================
// 通信処理
// GASウェブアプリは「GASで処理 → 処理完了後に script.googleusercontent.com へ転送して結果を返す」の2段階で、
// 後段が断続的にGoogleのHTMLエラーページ（404）を返すことがある。
// 取得系は自動で再試行し、保存系は「処理済みだが結果を受け取れなかった」を区別して扱う。
// ==========================================

/** GASが処理を完了した後に結果を受け取る転送先 */
const RESULT_HOST = 'script.googleusercontent.com'

/** 取得（GET）1回あたりの待ち時間。これを超えたら打ち切って再試行する */
const GET_TIMEOUT_MS = 20_000
/** 保存（POST）の待ち時間。GASの実行が遅いときに保存済みなのに失敗扱いにしないよう長めにする */
const POST_TIMEOUT_MS = 60_000
const GET_MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1_500

type GasErrorKind = 'timeout' | 'network' | 'html' | 'http' | 'parse' | 'server'

const GAS_ERROR_MESSAGE: Record<GasErrorKind, string> = {
  timeout: '通信に時間がかかりすぎたため、データを取得できませんでした。',
  network: 'インターネットに接続できませんでした。電波の状況を確認してください。',
  html:    'サーバーが混み合っているため、データを取得できませんでした。',
  http:    'サーバーが混み合っているため、データを取得できませんでした。',
  parse:   'サーバーから正しいデータを受け取れませんでした。',
  server:  'サーバーで一時的なエラーが発生したため、データを取得できませんでした。',
}

/** GAS通信エラー。message は利用者向けの文言、detail は原因調査用の情報 */
export class GasError extends Error {
  readonly kind: GasErrorKind
  readonly detail: string
  /** 結果の受け取り先まで転送されていた＝GASでの処理は完了している（結果だけ受け取れなかった） */
  readonly executed: boolean

  constructor(kind: GasErrorKind, detail: string, executed = false) {
    super(GAS_ERROR_MESSAGE[kind])
    this.name = 'GasError'
    this.kind = kind
    this.detail = detail
    this.executed = executed
  }
}

/** 保存系の結果。GASで処理済みだが結果を受け取れなかった場合は { unconfirmed: true } になる */
export type PostResult<T> = (T & { unconfirmed?: never }) | { unconfirmed: true }

/** 保存系のエラーを利用者向けの文言にする。
 *  届いたかどうか分からない場合は、二重登録を防ぐため確認してから送り直すよう案内する */
export function describeSaveError(e: unknown, action: string): string {
  if (e instanceof GasError && (e.kind === 'timeout' || e.kind === 'network')) {
    return `${action}できたか確認できませんでした。二重登録を防ぐため、少し待ってから画面を再読み込みし、反映されていないことを確認してからもう一度お試しください。`
  }
  return `${action}できませんでした。少し待ってからもう一度お試しください。`
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const hostOf = (url: string) => {
  try { return new URL(url).host } catch { return '' }
}

/** 管理画面かどうか。管理画面では古いデータを元に保存すると最新の変更を上書きするため、予備データを使わない */
const isAdminPage = () => window.location.hash.includes('/admin')

async function requestJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  // AbortSignal.timeout は古いiOS Safariで使えないため AbortController で実装する
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const transportError = (e: unknown, executed: boolean) =>
    controller.signal.aborted
      ? new GasError('timeout', `${timeoutMs / 1000}秒以内に応答なし`, executed)
      : new GasError('network', e instanceof Error ? e.message : String(e), executed)

  try {
    const res = await fetch(url, { ...init, redirect: 'follow', signal: controller.signal })
      .catch((e: unknown) => { throw transportError(e, false) })
    // GASは処理を完了してから結果の受け取り先へ転送するため、そこまで届いていれば処理は完了している
    const executed = res.redirected && hostOf(res.url) === RESULT_HOST
    const text = await res.text().catch((e: unknown) => { throw transportError(e, executed) })

    // 結果の受け取りに失敗するとGoogleのHTMLエラーページ（「ページが見つかりません」など）が返る
    if (text.trimStart().startsWith('<')) {
      const title = text.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
      throw new GasError('html', `HTTP ${res.status} ${title}`.trim(), executed)
    }
    if (!res.ok) throw new GasError('http', `HTTP ${res.status}`, executed)
    try {
      return JSON.parse(text) as T
    } catch {
      throw new GasError('parse', text.slice(0, 100), executed)
    }
  } finally {
    clearTimeout(timer)
  }
}

/** 取得系。失敗時は間隔を空けて再試行する（毎回新しい受け取りURLが発行されるため成功しやすい） */
async function gasGet<T>(
  action: string,
  params: Record<string, string> = {},
  /** 応答の形が正しければ null、不正なら理由を返す。不正な応答はキャッシュさせず再試行する */
  validate?: (data: unknown) => string | null,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= GET_MAX_ATTEMPTS; attempt++) {
    const url = new URL(GAS_URL)
    url.searchParams.set('action', action)
    url.searchParams.set('_t', `${Date.now()}_${attempt}`)  // GASキャッシュ無効化
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    try {
      const data = await requestJson<unknown>(url.toString(), { method: 'GET' }, GET_TIMEOUT_MS)
      // doGet は内部エラーを { error } としてHTTP 200で返すため、ここで失敗として扱う
      if (data !== null && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
        throw new GasError('server', String((data as { error: unknown }).error))
      }
      const invalid = validate?.(data) ?? null
      if (invalid) throw new GasError('parse', invalid)
      return data as T
    } catch (e) {
      lastError = e
      console.warn(
        `[gasApi] ${action} 取得失敗 (${attempt}/${GET_MAX_ATTEMPTS})`,
        e instanceof GasError ? `${e.kind}: ${e.detail}` : e,
      )
      // オフラインなら再試行しても無駄なので打ち切る
      if (attempt === GET_MAX_ATTEMPTS || !navigator.onLine) break
      await sleep(RETRY_BASE_DELAY_MS * attempt)
    }
  }
  throw lastError
}

/** 保存系。再試行しない：GAS側では処理済みのことがあり、再送すると二重登録になるため。
 *  GASでの処理完了が分かっていて結果だけ受け取れなかった場合は、失敗ではなく { unconfirmed: true } を返す */
async function gasPost<T>(action: string, body: Record<string, unknown>): Promise<PostResult<T>> {
  try {
    return await requestJson<T & { unconfirmed?: never }>(
      GAS_URL,
      { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, ...body }) },
      POST_TIMEOUT_MS,
    )
  } catch (e) {
    if (e instanceof GasError && e.executed) {
      console.warn(`[gasApi] ${action}: GASでの処理は完了したが、結果を受け取れなかった`, `${e.kind}: ${e.detail}`)
      return { unconfirmed: true }
    }
    throw e
  }
}

/** 最新データの取得に成功した／予備データで表示している、を画面に伝える */
function markFresh(key: string) {
  useAppStore.getState().setStaleSince(key, null)
}

function markStale(key: string, timestamp: number) {
  useAppStore.getState().setStaleSince(key, timestamp)
}

/** 取得に失敗したとき、管理画面以外なら最後に取得できたデータを返す。無ければ元のエラーを投げる */
function fallbackToStale<T>(key: string, error: unknown): T {
  const stale = isAdminPage() ? null : getStale<T>(key)
  if (!stale) throw error
  console.warn(`[gasApi] ${key} 取得失敗のため前回データで表示:`, new Date(stale.timestamp).toLocaleString())
  markStale(key, stale.timestamp)
  return stale.data
}

export const gasApi = {
  getConfig: async () => {
    if (!isAdminPage()) {
      const cached = getCached<AppConfig>('config', CACHE_TTL.config)
      if (cached) { console.log('[cache] config hit'); return cached }
    }
    try {
      const raw = await gasGet<Record<string, unknown>>('getConfig', {}, (d) =>
        d !== null && typeof d === 'object' && Array.isArray((d as { clubs?: unknown }).clubs) ? null : '設定データの形式が不正（clubs がない）')
      const data = normalizeConfig(raw)
      setCache('config', data)
      markFresh('config')
      return data
    } catch (e) {
      return fallbackToStale<AppConfig>('config', e)
    }
  },

  getReservations: async (year: number, month: number) => {
    const key = `reservations_${year}_${month}`
    const cached = getCached<Reservation[]>(key, CACHE_TTL.reservations)
    if (cached) { console.log('[cache] reservations hit', year, month); return cached }
    try {
      const data = await gasGet<Reservation[]>('getReservations', { year: String(year), month: String(month) },
        (d) => Array.isArray(d) ? null : '予約データの形式が不正（配列でない）')
      setCache(key, data)
      markFresh(key)
      return data
    } catch (e) {
      return fallbackToStale<Reservation[]>(key, e)
    }
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
    const result = await gasPost<{ success: boolean; error?: string }>('saveConfig', { config })
    console.log('[gasApi] saveConfig GASレスポンス:', result)
    if (!result.unconfirmed && !result.success) {
      throw new Error(result.error ?? 'GAS saveConfig が失敗しました')
    }
    clearCache('config')
    return result
  },

  /** 特定のローテーションのみを個別保存する（他のローテーションデータを変更しない） */
  saveRotation: async (rotationType: string, patterns: DayPattern[]) => {
    const result = await gasPost<{ success: boolean }>('saveRotation', { rotationType, patterns })
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
