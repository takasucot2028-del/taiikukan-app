import { useState, useCallback } from 'react'
import { useAppStore } from '../../store'
import { gasApi } from '../../lib/gasApi'
import { useConfig } from '../../hooks/useReservations'
import { AdminNav } from '../../components/admin/AdminNav'
import type { AppConfig, Rotation, Club, Holiday, SchoolEvent, SlotEntry } from '../../types'

const TABS = ['クラブ', '祝日', '学校行事', '平日スケジュール', 'ローテーション', '開始番号'] as const
type Tab = typeof TABS[number]

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const WEEKDAY_LABELS: Record<string, string> = { monday: '月', tuesday: '火', wednesday: '水', thursday: '木', friday: '金' }
const FACILITIES = ['第1体育館 半面A', '第1体育館 半面B', '第1体育館（全面）', '第1体育館 ステージ', '第2体育館（全面）', '総合体育館 半面A', '総合体育館 半面B']
const WEEKEND_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']

// 6種類のローテーション設定（AppConfigのフィールド名を直接使用）
const ROT_CONFIGS: { key: keyof AppConfig; label: string; count: number }[] = [
  { key: 'saturdayRotation',       label: '夏季土曜', count: 3 },
  { key: 'sundayRotation',         label: '夏季日曜', count: 3 },
  { key: 'summerVacationRotation', label: '夏季休暇', count: 3 },
  { key: 'winterSaturdayRotation', label: '冬季土曜', count: 3 },
  { key: 'winterSundayRotation',   label: '冬季日曜', count: 3 },
  { key: 'winterVacationRotation', label: '冬季休暇', count: 3 },
]

function ClubTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [clubs, setClubs] = useState<Club[]>(config.clubs)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const doSave = async (updated: Club[]) => {
    setSaving(true)
    try {
      await onSave({ ...config, clubs: updated })
      setClubs(updated)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="space-y-2">
        {clubs.map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
            <span className="text-gray-800">{c.name}</span>
            <button onClick={() => doSave(clubs.filter((x) => x.id !== c.id))}
              className="text-red-500 text-sm px-2">削除</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しいクラブ名"
          className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => {
          if (!newName.trim()) return
          const updated = [...clubs, { id: crypto.randomUUID(), name: newName.trim() }]
          doSave(updated).then(() => setNewName(''))
        }} disabled={saving || !newName.trim()}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50">追加</button>
      </div>
    </div>
  )
}

function HolidayTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [holidays, setHolidays] = useState<Holiday[]>(config.holidays)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const doSave = async (updated: Holiday[]) => {
    setSaving(true)
    try {
      await onSave({ ...config, holidays: updated })
      setHolidays(updated)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
          <div key={h.date} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700">{h.date}　{h.name}</span>
            <button onClick={() => doSave(holidays.filter((x) => x.date !== h.date))}
              className="text-red-500 text-xs px-2">削除</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="祝日名"
          className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => {
          if (!date || !name.trim()) return
          const updated = [...holidays.filter((h) => h.date !== date), { date, name: name.trim() }]
          doSave(updated).then(() => { setDate(''); setName('') })
        }} disabled={saving || !date || !name.trim()}
          className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">追加</button>
      </div>
    </div>
  )
}

function SchoolEventTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [events, setEvents] = useState<SchoolEvent[]>(config.schoolEvents)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [scheduleType, setScheduleType] = useState<'weekday' | 'rotation'>('weekday')
  const [editingKey, setEditingKey] = useState<string | null>(null) // "date|name" で編集対象を識別
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const doSave = async (updated: SchoolEvent[]) => {
    setSaving(true)
    try {
      await onSave({ ...config, schoolEvents: updated })
      setEvents(updated)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  const resetForm = () => { setDate(''); setName(''); setScheduleType('weekday'); setEditingKey(null) }

  const startEdit = (e: SchoolEvent) => {
    setDate(e.date)
    setName(e.name)
    setScheduleType(e.type ?? 'weekday')
    setEditingKey(`${e.date}|${e.name}`)
  }

  const handleSubmit = () => {
    if (!date || !name.trim()) return
    const newEvent: SchoolEvent = { date, name: name.trim(), type: scheduleType }
    let updated: SchoolEvent[]
    if (editingKey) {
      const [origDate, origName] = editingKey.split('|')
      updated = events.map((x) => (x.date === origDate && x.name === origName) ? newEvent : x)
    } else {
      updated = [...events, newEvent]
    }
    doSave(updated).then(resetForm)
  }

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
          const isEditing = editingKey === `${e.date}|${e.name}`
          return (
            <div key={`${e.date}-${e.name}`}
              className={`flex items-center justify-between border rounded-lg px-3 py-2 ${isEditing ? 'bg-blue-50 border-blue-400' : 'bg-white'}`}>
              <span className="text-sm text-gray-700 flex items-center gap-2 min-w-0">
                <span className="shrink-0">{e.date}</span>
                <span className="truncate">{e.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${e.type === 'rotation' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {e.type === 'rotation' ? '休日' : '平日'}
                </span>
              </span>
              <span className="flex gap-1 shrink-0 ml-2">
                <button onClick={() => isEditing ? resetForm() : startEdit(e)}
                  className={`text-xs px-2 py-0.5 rounded ${isEditing ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                  {isEditing ? 'キャンセル' : '編集'}
                </button>
                <button onClick={() => doSave(events.filter((x) => !(x.date === e.date && x.name === e.name)))}
                  className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200">削除</button>
              </span>
            </div>
          )
        })}
      </div>

      <div className="border rounded-lg p-3 bg-white space-y-3">
        <p className="text-xs font-semibold text-gray-500">{editingKey ? '✏️ 編集中' : '＋ 新規追加'}</p>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="行事名"
            className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="scheduleType" value="weekday"
              checked={scheduleType === 'weekday'} onChange={() => setScheduleType('weekday')} />
            <span>平日スケジュール（通常授業・行事など）</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="scheduleType" value="rotation"
              checked={scheduleType === 'rotation'} onChange={() => setScheduleType('rotation')} />
            <span>休日ローテーション（夏休み・冬休みなど）</span>
          </label>
        </div>
        <div className="flex gap-2">
          {editingKey && (
            <button onClick={resetForm}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg px-3 py-2 text-sm">
              キャンセル
            </button>
          )}
          <button onClick={handleSubmit} disabled={saving || !date || !name.trim()}
            className="flex-1 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {saving ? '保存中...' : editingKey ? '更新する' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WeekdayScheduleTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const wd = config.weekdaySchedule
  const toGrid = (): Record<string, Record<string, string>> => {
    const g: Record<string, Record<string, string>> = {}
    WEEKDAYS.forEach((d) => {
      g[d] = {}
      if (wd) {
        wd[d].forEach((s) => { g[d][s.facility] = s.clubName })
      }
    })
    return g
  }
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>(toGrid)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const clubs = config.clubs.map((c) => c.name)

  const handleSave = async () => {
    setSaving(true)
    const newWd: Record<string, SlotEntry[]> = {}
    WEEKDAYS.forEach((d) => {
      newWd[d] = FACILITIES
        .filter((f) => grid[d]?.[f])
        .map((f) => ({ timeSlot: '16:00〜18:00', facility: f, clubName: grid[d][f] }))
    })
    try {
      await onSave({ ...config, weekdaySchedule: newWd as AppConfig['weekdaySchedule'] })
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <p className="text-xs text-gray-500">時間帯：16:00〜18:00（固定）</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">施設</th>
              {WEEKDAYS.map((d) => <th key={d} className="border px-2 py-1">{WEEKDAY_LABELS[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {FACILITIES.map((f) => (
              <tr key={f}>
                <td className="border px-2 py-1 font-medium whitespace-nowrap">{f}</td>
                {WEEKDAYS.map((d) => (
                  <td key={d} className="border px-1 py-0.5">
                    <select value={grid[d]?.[f] ?? ''} onChange={(e) => setGrid((g) => ({ ...g, [d]: { ...g[d], [f]: e.target.value } }))}
                      className="w-full text-xs border-0 focus:ring-0 bg-transparent">
                      <option value="">（空き）</option>
                      {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}

// 1種類のローテーション編集カード（個別保存）
function RotationCard({
  rotKey, label, count, config, onSaved, refetch,
}: {
  rotKey: keyof AppConfig
  label: string
  count: number
  config: AppConfig
  onSaved: (key: keyof AppConfig, patterns: SlotEntry[][]) => void
  refetch: () => Promise<void>
}) {
  const clubs = config.clubs.map((c) => c.name)
  const rot = config[rotKey] as Rotation | null

  const [localPats, setLocalPats] = useState<SlotEntry[][]>(() =>
    Array.from({ length: count }, (_, i) => rot?.patterns?.[i] ?? [])
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const getCell = (pi: number, slot: string, f: string) =>
    localPats[pi]?.find((s) => s.timeSlot === slot && s.facility === f)?.clubName ?? ''

  const setCell = (pi: number, slot: string, f: string, val: string) =>
    setLocalPats((prev) =>
      prev.map((p, i) => {
        if (i !== pi) return p
        const next = p.filter((s) => !(s.timeSlot === slot && s.facility === f))
        if (val) next.push({ timeSlot: slot, facility: f, clubName: val })
        return next
      })
    )

  const handleSave = async () => {
    setSaving(true)
    try {
      await gasApi.saveRotation(rotKey as string, localPats)
      onSaved(rotKey, localPats)
      await refetch()
      setMsg('保存しました')
    } catch {
      setMsg('保存に失敗しました')
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    }
  }

  return (
    <div className="border rounded-xl bg-white p-4 space-y-3">
      <h3 className="font-semibold text-gray-700 text-sm">{label}ローテーション</h3>
      {msg && (
        <div className={`text-sm px-3 py-2 rounded ${msg.includes('失敗') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {msg}
        </div>
      )}

      {Array.from({ length: count }, (_, pi) => (
        <div key={pi} className="border rounded-lg p-3 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 mb-2">パターン {pi + 1}</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="border px-1 py-0.5">時間帯</th>
                  {FACILITIES.map((f) => (
                    <th key={f} className="border px-1 py-0.5 whitespace-nowrap">
                      {f.replace('体育館', '体')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKEND_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="border px-1 py-0.5 whitespace-nowrap font-medium">{slot}</td>
                    {FACILITIES.map((f) => (
                      <td key={f} className="border px-0.5 py-0.5">
                        <select
                          value={getCell(pi, slot, f)}
                          onChange={(e) => setCell(pi, slot, f, e.target.value)}
                          className="text-xs w-20 border-0 bg-transparent focus:ring-0"
                        >
                          <option value="">—</option>
                          {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? '保存中...' : 'この設定を保存'}
      </button>
    </div>
  )
}

function RotationTab({ config, refetch }: { config: AppConfig; refetch: () => Promise<void> }) {
  const { setConfig } = useAppStore()
  const [localConfig, setLocalConfig] = useState(config)

  const handleSaved = useCallback((key: keyof AppConfig, patterns: SlotEntry[][]) => {
    const rot = localConfig[key] as Rotation | null
    const updated = {
      ...localConfig,
      [key]: { ...(rot ?? { startIndex: 0 }), patterns },
    }
    setLocalConfig(updated)
    setConfig(updated)  // GAS は saveRotation 済みなので store のみ更新
  }, [localConfig, setConfig])

  return (
    <div className="space-y-4">
      {ROT_CONFIGS.map((rc) => (
        <RotationCard
          key={rc.key as string}
          rotKey={rc.key}
          label={rc.label}
          count={rc.count}
          config={localConfig}
          onSaved={handleSaved}
          refetch={refetch}
        />
      ))}
    </div>
  )
}

const ROT_INDEX_CONFIGS: { key: keyof AppConfig; label: string }[] = [
  { key: 'saturdayRotation',       label: '夏季土曜' },
  { key: 'sundayRotation',         label: '夏季日曜' },
  { key: 'summerVacationRotation', label: '夏季休暇' },
  { key: 'winterSaturdayRotation', label: '冬季土曜' },
  { key: 'winterSundayRotation',   label: '冬季日曜' },
  { key: 'winterVacationRotation', label: '冬季休暇' },
]

function StartIndexTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [startIndices, setStartIndices] = useState<Record<string, number>>(() => {
    const r: Record<string, number> = {}
    ROT_INDEX_CONFIGS.forEach(({ key }) => {
      const rot = config[key] as Rotation | null
      r[key as string] = (rot?.startIndex ?? 0) + 1
    })
    return r
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSave = async () => {
    setSaving(true)
    try {
      const newConfig = { ...config }
      ROT_INDEX_CONFIGS.forEach(({ key }) => {
        const existing = newConfig[key] as Rotation | null
        if (existing) {
          ;(newConfig as Record<string, unknown>)[key as string] = {
            ...existing,
            startIndex: startIndices[key as string] - 1,
          }
        }
      })
      await onSave(newConfig)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="bg-white border rounded-xl p-4 space-y-4">
        {ROT_INDEX_CONFIGS.map(({ key, label }) => {
          const rot = config[key] as Rotation | null
          const count = Math.max(rot?.patterns?.filter(p => p.length > 0).length ?? 3, 1)
          return (
            <div key={key as string}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}の開始パターン番号
              </label>
              <select
                value={startIndices[key as string]}
                onChange={(e) => setStartIndices(prev => ({ ...prev, [key as string]: Number(e.target.value) }))}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>パターン {n}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}

export function AdminSettings() {
  const { setConfig } = useAppStore()
  const { config, refetch } = useConfig()
  const [activeTab, setActiveTab] = useState<Tab>('クラブ')

  const handleSave = useCallback(async (newConfig: AppConfig) => {
    await gasApi.saveConfig(newConfig)
    setConfig(newConfig)
  }, [setConfig])

  if (!config) return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="設定管理" />
      <p className="text-center text-gray-400 mt-16">設定データを読み込み中...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="設定管理" />

      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 ${
                activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 max-w-4xl mx-auto">
        {activeTab === 'クラブ' && <ClubTab config={config} onSave={handleSave} />}
        {activeTab === '祝日' && <HolidayTab config={config} onSave={handleSave} />}
        {activeTab === '学校行事' && <SchoolEventTab config={config} onSave={handleSave} />}
        {activeTab === '平日スケジュール' && <WeekdayScheduleTab config={config} onSave={handleSave} />}
        {activeTab === 'ローテーション' && <RotationTab config={config} refetch={refetch} />}
        {activeTab === '開始番号' && <StartIndexTab config={config} onSave={handleSave} />}
      </main>
    </div>
  )
}
