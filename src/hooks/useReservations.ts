import { useEffect, useCallback, useState } from 'react'
import { gasApi } from '../lib/gasApi'
import { useAppStore } from '../store'

export function useReservations() {
  const { currentYear, currentMonth, setReservations, reservations } = useAppStore()

  const fetchData = useCallback(async () => {
    try {
      const data = await gasApi.getReservations(currentYear, currentMonth)
      console.log('[useReservations] 取得件数:', data.length)
      setReservations(data)
    } catch (e) {
      console.error('[useReservations] 予約データ取得エラー', e)
    }
  }, [currentYear, currentMonth, setReservations])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { reservations, refetch: fetchData }
}

export function useConfig() {
  const { config, setConfig } = useAppStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (config) return
    setLoading(true)
    setError(null)
    gasApi.getConfig()
      .then((data) => {
        console.log('[useConfig] GASレスポンス:', JSON.stringify(data).slice(0, 500))
        if (!data || !Array.isArray(data.clubs)) {
          setError(`GASから不正なデータ: ${JSON.stringify(data).slice(0, 200)}`)
          return
        }
        if (data.clubs.length === 0) {
          setError(`クラブ一覧が空です。スプレッドシートの行番号設定を確認してください。GASレスポンス: ${JSON.stringify(data).slice(0, 200)}`)
          return
        }
        console.log('[useConfig] クラブ数:', data.clubs.length, '/ 祝日数:', data.holidays.length, '/ 行事数:', data.schoolEvents.length)
        setConfig(data)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`GAS接続エラー: ${msg}`)
        console.error('[useConfig] エラー:', e)
      })
      .finally(() => setLoading(false))
  }, [config, setConfig])

  return { config, error, loading }
}
