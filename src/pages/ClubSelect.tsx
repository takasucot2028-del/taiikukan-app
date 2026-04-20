import { useState } from 'react'
import { useAppStore } from '../store'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useConfig } from '../hooks/useReservations'

const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined

export function ClubSelect() {
  const { setSelectedClub } = useAppStore()
  const { config, error, loading } = useConfig()
  const [search, setSearch] = useState('')

  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-red-50 border border-red-300 rounded-xl p-5 max-w-lg w-full">
          <h2 className="text-red-700 font-bold text-lg mb-2">データ取得エラー</h2>
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <p className="text-gray-600 text-xs mb-3">
            GAS WebアプリURL:<br />
            <code className="break-all bg-gray-100 px-1 rounded text-xs">{GAS_URL ?? '未設定'}</code>
          </p>
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium mb-1">確認手順</summary>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>GASエディタで最新のCode.gsを貼り付けて「新しいバージョン」で再デプロイ</li>
              <li>アクセス権限が「全員（匿名含む）」になっているか確認</li>
              <li>ブラウザで直接GAS URLに <code>?action=getConfig</code> を付けてアクセスし、JSONが返るか確認</li>
            </ol>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full bg-blue-600 text-white rounded-lg py-2 text-sm"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  if (!config) return <LoadingSpinner />

  const filtered = config.clubs.filter((c) =>
    c.name.includes(search)
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-blue-700 text-white px-4 py-5 text-center">
        <h1 className="text-xl font-bold">体育館予約管理</h1>
        <p className="text-sm text-blue-200 mt-1">鷹栖中学校 地域部活動</p>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          あなたのクラブを選択してください
        </h2>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="クラブ名を検索..."
          className="w-full border rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="space-y-2">
          {filtered.map((club) => (
            <button
              key={club.id}
              onClick={() => setSelectedClub(club.name)}
              className="w-full text-left px-4 py-3 bg-white border rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium text-gray-800"
            >
              {club.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 mt-8">該当するクラブがありません</p>
        )}
      </div>
    </div>
  )
}
