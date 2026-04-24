import { useState, useEffect, useMemo } from 'react'
import { gasApi } from '../../lib/gasApi'
import { AdminNav } from '../../components/admin/AdminNav'

interface LogEntry {
  timestamp: string
  action: string
  actor: string
  detail: string
}

const ACTION_LABELS: Record<string, string> = {
  addReservation: '予約追加', updateReservation: '予約更新', updateStatus: 'ステータス変更',
  deleteReservation: '削除', saveConfig: '設定変更', registerPush: '通知登録',
  sendNotification: '通知送信',
}

export function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterActor, setFilterActor] = useState('all')
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => {
    gasApi.getLogs().then((data) => { setLogs(data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const actors = useMemo(() => ['all', ...new Set(logs.map((l) => l.actor))], [logs])
  const actions = useMemo(() => ['all', ...new Set(logs.map((l) => l.action))], [logs])

  const filtered = useMemo(() =>
    logs.filter((l) =>
      (filterActor === 'all' || l.actor === filterActor) &&
      (filterAction === 'all' || l.action === filterAction)
    ), [logs, filterActor, filterAction])

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="変更履歴" />

      <div className="bg-white border-b px-4 py-3 flex gap-2 overflow-x-auto">
        <select value={filterActor} onChange={(e) => setFilterActor(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          <option value="all">全クラブ</option>
          {actors.filter((a) => a !== 'all').map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          <option value="all">全操作</option>
          {actions.filter((a) => a !== 'all').map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length}件</span>
      </div>

      <main className="p-3 max-w-3xl mx-auto">
        {loading ? (
          <p className="text-center text-gray-400 mt-8">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 mt-8">ログがありません</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((log, i) => (
              <div key={i} className="bg-white border rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="text-xs text-gray-400">{log.timestamp}</span>
                </div>
                <p className="text-sm text-gray-700"><span className="font-medium">{log.actor}</span>：{log.detail}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
