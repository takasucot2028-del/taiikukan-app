import { useState } from 'react'
import { useAppStore } from '../store'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useConfig } from '../hooks/useReservations'

export function ClubSelect() {
  const { setSelectedClub } = useAppStore()
  const config = useConfig()
  const [search, setSearch] = useState('')

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
