import { useAppStore } from '../../store'

export function SyncIndicator() {
  const { bgSyncing, syncError, setSyncError } = useAppStore()

  if (!bgSyncing && !syncError) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {bgSyncing && (
        <div className="bg-white shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-600">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>同期中...</span>
        </div>
      )}
      {syncError && (
        <div className="bg-red-50 border border-red-200 shadow-lg rounded-xl px-4 py-3 text-sm max-w-xs">
          <p className="text-red-700 mb-2">{syncError}</p>
          <button
            onClick={() => setSyncError(null)}
            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded w-full"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
