import { useEffect, useCallback, useState } from 'react'
import { gasApi } from '../lib/gasApi'
import { useAppStore } from '../store'

export function useReservations() {
  const { currentYear, currentMonth, setReservations, reservations } = useAppStore()

  const fetch = useCallback(async () => {
    try {
      const data = await gasApi.getReservations(currentYear, currentMonth)
      setReservations(data)
    } catch (e) {
      console.error('予約データ取得エラー', e)
    }
  }, [currentYear, currentMonth, setReservations])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { reservations, refetch: fetch }
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
        if (!data || !Array.isArray(data.clubs)) {
          setError(`GASから不正なデータが返されました: ${JSON.stringify(data)}`)
          return
        }
        setConfig(data)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        setError(`GAS接続エラー: ${msg}`)
        console.error('getConfig error', e)
      })
      .finally(() => setLoading(false))
  }, [config, setConfig])

  return { config, error, loading }
}
