/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GASウェブアプリのエンドポイントURL（.env の VITE_GAS_URL） */
  readonly VITE_GAS_URL?: string
  /** プッシュ通知のVAPID公開鍵（.env の VITE_VAPID_PUBLIC_KEY） */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
