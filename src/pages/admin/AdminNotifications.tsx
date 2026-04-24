import { useState, useEffect } from 'react'
import { useAppStore } from '../../store'
import { gasApi } from '../../lib/gasApi'
import { AdminNav } from '../../components/admin/AdminNav'

interface PushStats {
  registeredCount: number
  history: { timestamp: string; title: string; sent: number }[]
}

export function AdminNotifications() {
  const { currentYear, currentMonth } = useAppStore()
  const [stats, setStats] = useState<PushStats | null>(null)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    gasApi.getPushStats()
      .then(setStats)
      .catch(() => setStats({ registeredCount: 0, history: [] }))
  }, [])

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(''), 4000) }

  const handleSendConfirm = async () => {
    if (!window.confirm(`${currentYear}年${currentMonth}月の確定通知を送信しますか？`)) return
    setSending(true)
    try {
      const res = await gasApi.sendPushNotification(
        `体育館予約 ${currentMonth}月予定表確定`,
        `${currentMonth}月の体育館使用予定表が確定しました`
      )
      showMsg(`送信しました（${res.sent}端末）`)
      const s = await gasApi.getPushStats()
      setStats(s)
    } catch {
      showMsg('送信に失敗しました（VAPID設定を確認してください）')
    } finally {
      setSending(false)
    }
  }

  const handleSendReminder = async () => {
    if (!window.confirm('リマインド通知を送信しますか？')) return
    setSending(true)
    try {
      const res = await gasApi.sendPushNotification(
        '体育館予約 締め切り通知',
        `翌月分の占有予約申請の締め切りは今月20日です`
      )
      showMsg(`送信しました（${res.sent}端末）`)
    } catch {
      showMsg('送信に失敗しました')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="通知管理" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className="bg-green-100 text-green-800 text-sm px-4 py-2 rounded-lg">{message}</div>
        )}

        {/* 登録状況 */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">登録端末</h2>
          <p className="text-3xl font-bold text-gray-800">{stats?.registeredCount ?? '—'}<span className="text-base font-normal text-gray-500 ml-1">台</span></p>
          <p className="text-xs text-gray-400 mt-1">プッシュ通知を有効にしているユーザー数</p>
        </div>

        {/* 通知送信 */}
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-700">通知を送信</h2>

          <div className="border rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-1">確定通知</p>
            <p className="text-xs text-gray-500 mb-2">
              タイトル：体育館予約 {currentMonth}月予定表確定<br />
              本文：{currentMonth}月の体育館使用予定表が確定しました
            </p>
            <button onClick={handleSendConfirm} disabled={sending}
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {sending ? '送信中...' : '確定通知を送信'}
            </button>
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-1">締め切りリマインド</p>
            <p className="text-xs text-gray-500 mb-2">
              タイトル：体育館予約 締め切り通知<br />
              本文：翌月分の占有予約申請の締め切りは今月20日です
            </p>
            <button onClick={handleSendReminder} disabled={sending}
              className="w-full bg-amber-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
              {sending ? '送信中...' : 'リマインドを送信'}
            </button>
          </div>
        </div>

        {/* 送信履歴 */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">送信履歴</h2>
          {!stats || stats.history.length === 0 ? (
            <p className="text-sm text-gray-400">送信履歴がありません</p>
          ) : (
            <div className="space-y-2">
              {stats.history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-gray-700">{h.title}</p>
                    <p className="text-xs text-gray-400">{h.timestamp}</p>
                  </div>
                  <span className="text-xs text-gray-500">{h.sent}端末</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VAPID設定案内 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">プッシュ通知の設定について</h3>
          <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
            <li>web-push CLIでVAPIDキーペアを生成する</li>
            <li>GASのスクリプトプロパティに VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を設定</li>
            <li>.env に VITE_VAPID_PUBLIC_KEY=（公開鍵）を設定してビルド</li>
            <li>毎月15日のTime-drivenトリガーにsendMonthlyReminder関数を設定</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
