import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { Reservation } from '../../types'

interface Props {
  reservations: Reservation[]
  filterClub: string
}

const STATUS_CLASS: Record<string, string> = {
  '確定': 'bg-blue-100 text-blue-800',
  '申請中': 'bg-yellow-100 text-yellow-800',
  '却下': 'bg-gray-100 text-gray-500',
}

export function ListView({ reservations, filterClub }: Props) {
  const filtered = filterClub
    ? reservations.filter((r) => r.clubName === filterClub)
    : reservations

  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) {
    return <p className="text-center text-gray-500 py-12">予約申請がありません</p>
  }

  return (
    <div className="space-y-3">
      {sorted.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-800">
              {format(parseISO(r.date), 'M月d日（EEE）', { locale: ja })}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status] ?? 'bg-gray-100'}`}>
              {r.status}
            </span>
          </div>
          <p className="text-sm text-gray-700">{r.clubName}</p>
          <p className="text-sm text-gray-600">{r.facility} | {r.timeSlot}</p>
          <p className="text-sm text-gray-500 truncate">{r.content}</p>
        </div>
      ))}
    </div>
  )
}
