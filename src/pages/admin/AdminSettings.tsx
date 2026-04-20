import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import { gasApi } from '../../lib/gasApi'
import type { Club } from '../../types'

export function AdminSettings() {
  const navigate = useNavigate()
  const { config, setConfig } = useAppStore()
  const [newClubName, setNewClubName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const clubs: Club[] = config?.clubs ?? []

  const addClub = async () => {
    if (!newClubName.trim() || !config) return
    const newClub: Club = { id: crypto.randomUUID(), name: newClubName.trim() }
    const updated = { ...config, clubs: [...clubs, newClub] }
    setSaving(true)
    try {
      await gasApi['saveConfig' as keyof typeof gasApi]?.(updated as never)
      setConfig(updated)
      setNewClubName('')
      setMessage('保存しました')
    } catch {
      setMessage('保存に失敗しました')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  const removeClub = async (id: string) => {
    if (!config) return
    const updated = { ...config, clubs: clubs.filter((c) => c.id !== id) }
    setSaving(true)
    try {
      setConfig(updated)
      setMessage('削除しました')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-800 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/admin/dashboard')} className="text-xl">‹</button>
        <h1 className="font-bold">設定管理</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        {message && (
          <div className="bg-green-100 text-green-800 text-sm px-4 py-2 rounded-lg">{message}</div>
        )}

        <section>
          <h2 className="font-semibold text-gray-700 mb-3">クラブ一覧</h2>
          <div className="space-y-2">
            {clubs.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
                <span className="text-gray-800">{c.name}</span>
                <button
                  onClick={() => removeClub(c.id)}
                  className="text-red-500 text-sm px-2"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              placeholder="新しいクラブ名"
              className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addClub}
              disabled={saving || !newClubName.trim()}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
