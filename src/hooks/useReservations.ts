import { useEffect, useCallback } from 'react'
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

  useEffect(() => {
    if (config) return
    gasApi.getConfig().then(setConfig).catch(console.error)
  }, [config, setConfig])

  return config
}
