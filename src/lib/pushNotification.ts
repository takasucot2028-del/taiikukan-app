import { gasApi } from './gasApi'

// VAPID公開鍵（GAS側の設定と一致させること）
// GASスクリプトプロパティ VAPID_PUBLIC_KEY に設定した値を入れる
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

// applicationServerKey は ArrayBuffer 裏付けの view を要求するため、戻り値を Uint8Array<ArrayBuffer> に固定する
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/taiikukan-app/sw.js')
    return reg
  } catch {
    return null
  }
}

export async function requestPushPermission(clubName: string): Promise<boolean> {
  if (!('Notification' in window) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY が設定されていません')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await registerServiceWorker()
  if (!reg) return false

  try {
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await gasApi.registerPush(subscription.toJSON() as PushSubscriptionJSON, clubName)
    return true
  } catch (err) {
    console.error('[Push] subscription失敗:', err)
    return false
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}
