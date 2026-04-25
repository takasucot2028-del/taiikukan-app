import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useConfig } from '../hooks/useReservations'
import { getClubColor } from '../lib/clubColors'

const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined

const VOLLEYBALL_SUBS = ['男子バレー', '女子バレー部', '男女バレーボール']

export function ClubSelect() {
  const navigate = useNavigate()
  const { setSelectedClub } = useAppStore()
  const { config, error, loading } = useConfig()
  const [search, setSearch] = useState('')
  const [volleyOpen, setVolleyOpen] = useState(false)

  console.log('[ClubSelect] localStorage:', localStorage.getItem('taiikukan-app-storage'))

  const handleSelect = (clubName: string) => {
    setSelectedClub(clubName)
    navigate('/home')
  }

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

  // バレー系クラブをグループ化、その他は通常表示
  const volleyballClubs = config.clubs.filter((c) => VOLLEYBALL_SUBS.includes(c.name))
  const otherClubs = config.clubs.filter((c) => !VOLLEYBALL_SUBS.includes(c.name))

  // 検索中はバレーグループも含めてフラットにフィルタ
  const isSearching = search.length > 0
  const filteredOther = otherClubs.filter((c) => c.name.includes(search))
  const filteredVolley = volleyballClubs.filter((c) => c.name.includes(search))

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
          {/* 検索中：バレー系も含めてフラット表示 */}
          {isSearching ? (
            <>
              {filteredOther.map((club) => (
                <button
                  key={club.id}
                  onClick={() => handleSelect(club.name)}
                  className="w-full text-left px-4 py-4 min-h-[52px] bg-white border rounded-lg active:bg-blue-100 hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium text-gray-800 text-base"
                >
                  {club.name}
                </button>
              ))}
              {filteredVolley.map((club) => {
                const c = getClubColor(club.name)
                return (
                  <button
                    key={club.id}
                    onClick={() => handleSelect(club.name)}
                    className="w-full text-left px-4 py-4 min-h-[52px] bg-white border rounded-lg active:bg-blue-100 hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium text-gray-800 text-base flex items-center gap-2"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{club.name}</span>
                  </button>
                )
              })}
              {filteredOther.length === 0 && filteredVolley.length === 0 && (
                <p className="text-center text-gray-400 mt-8">該当するクラブがありません</p>
              )}
            </>
          ) : (
            <>
              {/* 通常表示：バレーボールグループを折りたたみ */}
              {volleyballClubs.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setVolleyOpen(!volleyOpen)}
                    className="w-full text-left px-4 py-4 bg-white hover:bg-blue-50 transition-colors flex items-center justify-between"
                  >
                    <span className="font-bold text-gray-800 text-base">バレーボール</span>
                    <span className="text-gray-400 text-sm">{volleyOpen ? '▲' : '▶'}</span>
                  </button>

                  {volleyOpen && (
                    <div className="border-t bg-gray-50">
                      {VOLLEYBALL_SUBS.filter((name) => volleyballClubs.some((c) => c.name === name)).map((name) => {
                        const c = getClubColor(name)
                        return (
                          <button
                            key={name}
                            onClick={() => handleSelect(name)}
                            className="w-full text-left pl-8 pr-4 py-3 min-h-[48px] hover:bg-blue-50 active:bg-blue-100 transition-colors flex items-center gap-2 border-b last:border-b-0"
                          >
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* その他クラブ */}
              {otherClubs.map((club) => (
                <button
                  key={club.id}
                  onClick={() => handleSelect(club.name)}
                  className="w-full text-left px-4 py-4 min-h-[52px] bg-white border rounded-lg active:bg-blue-100 hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium text-gray-800 text-base"
                >
                  {club.name}
                </button>
              ))}

              {otherClubs.length === 0 && volleyballClubs.length === 0 && (
                <p className="text-center text-gray-400 mt-8">クラブがありません</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
