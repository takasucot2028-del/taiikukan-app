import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'

export function AdminLogin() {
  const navigate = useNavigate()
  const { config, setAdminAuthenticated } = useAppStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const correctPin = config?.adminPin ?? '1234'
    if (pin === correctPin) {
      setAdminAuthenticated(true)
      navigate('/admin/dashboard')
    } else {
      setError('PINコードが違います')
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">管理者ログイン</h1>
        <p className="text-sm text-center text-gray-500 mb-6">体育館予約管理システム</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PINコード</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              placeholder="4〜6桁のPIN"
              className="w-full border rounded-lg px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full bg-blue-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}
