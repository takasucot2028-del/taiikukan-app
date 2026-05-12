import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppConfig, Reservation } from '../types'

interface AppState {
  selectedClub: string
  setSelectedClub: (club: string) => void

  config: AppConfig | null
  setConfig: (config: AppConfig) => void

  reservations: Reservation[]
  setReservations: (reservations: Reservation[]) => void

  currentYear: number
  currentMonth: number
  setCurrentMonth: (year: number, month: number) => void

  isAdminAuthenticated: boolean
  setAdminAuthenticated: (v: boolean) => void

  bgSyncing: boolean
  setBgSyncing: (v: boolean) => void

  syncError: string | null
  setSyncError: (msg: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedClub: '',
      setSelectedClub: (club) => set({ selectedClub: club }),

      config: null,
      setConfig: (config) => set({ config }),

      reservations: [],
      setReservations: (reservations) => set({ reservations }),

      currentYear: new Date().getFullYear(),
      currentMonth: new Date().getMonth() + 1,
      setCurrentMonth: (year, month) => set({ currentYear: year, currentMonth: month }),

      isAdminAuthenticated: false,
      setAdminAuthenticated: (v) => set({ isAdminAuthenticated: v }),

      bgSyncing: false,
      setBgSyncing: (v) => set({ bgSyncing: v }),

      syncError: null,
      setSyncError: (msg) => set({ syncError: msg }),
    }),
    {
      name: 'taiikukan-app-storage',
      partialize: (state) => ({
        selectedClub: state.selectedClub,
      }),
    }
  )
)
