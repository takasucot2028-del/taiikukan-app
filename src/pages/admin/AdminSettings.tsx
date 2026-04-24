import { useState, useCallback } from 'react'
import { useAppStore } from '../../store'
import { gasApi } from '../../lib/gasApi'
import { AdminNav } from '../../components/admin/AdminNav'
import type { AppConfig, Club, Holiday, SchoolEvent, SlotEntry } from '../../types'

const TABS = ['クラブ', '祝日', '学校行事', '平日スケジュール', 'ローテーション', '開始番号'] as const
type Tab = typeof TABS[number]

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const WEEKDAY_LABELS: Record<string, string> = { monday: '月', tuesday: '火', wednesday: '水', thursday: '木', friday: '金' }
const FACILITIES = ['第1体育館 半面A', '第1体育館 半面B', '第1体育館（全面）', '第1体育館 ステージ', '第2体育館（全面）', '総合体育館 半面A', '総合体育館 半面B']
const WEEKEND_SLOTS = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00']
const ROT_CONFIGS = [
  { key: 'summerSat', label: '夏期土曜', rotation: 'saturdayRotation', patternsKey: 'summerPatterns', count: 3 },
  { key: 'summerSun', label: '夏期日曜', rotation: 'sundayRotation', patternsKey: 'summerPatterns', count: 3 },
  { key: 'winterSat', label: '冬期土曜', rotation: 'saturdayRotation', patternsKey: 'winterPatterns', count: 6 },
  { key: 'winterSun', label: '冬期日曜', rotation: 'sundayRotation', patternsKey: 'winterPatterns', count: 6 },
] as const

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

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
          <div key={`${e.date}-${e.name}`} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
            <span className="text-sm text-gray-700">{e.date}　{e.name}</span>
            <button onClick={() => doSave(events.filter((x) => !(x.date === e.date && x.name === e.name)))}
              className="text-red-500 text-xs px-2">削除</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="行事名"
          className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => {
          if (!date || !name.trim()) return
          doSave([...events, { date, name: name.trim() }]).then(() => { setDate(''); setName('') })
        }} disabled={saving || !date || !name.trim()}
          className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">追加</button>
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

function RotationTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const [activeRot, setActiveRot] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const clubs = config.clubs.map((c) => c.name)

  // Local edit state: { [rotKey]: SlotEntry[][] (patterns × slots) }
  const initPatterns = (count: number, src: AppConfig, rotKey: string, pKey: string): SlotEntry[][] => {
    const rot = src[rotKey as keyof AppConfig] as { summerPatterns: SlotEntry[][]; winterPatterns: SlotEntry[][] } | null
    const pats = rot?.[pKey as 'summerPatterns' | 'winterPatterns'] ?? []
    return Array.from({ length: count }, (_, i) => pats[i] ?? [])
  }

  const [patterns, setPatterns] = useState<Record<string, SlotEntry[][]>>(() => {
    const r: Record<string, SlotEntry[][]> = {}
    ROT_CONFIGS.forEach(({ key, rotation, patternsKey, count }) => {
      r[key] = initPatterns(count, config, rotation, patternsKey)
    })
    return r
  })

  const rc = ROT_CONFIGS[activeRot]

  const getCell = (patIdx: number, slot: string, facility: string): string => {
    const pat = patterns[rc.key][patIdx] ?? []
    return pat.find((s) => s.timeSlot === slot && s.facility === facility)?.clubName ?? ''
  }

  const setCell = (patIdx: number, slot: string, facility: string, value: string) => {
    setPatterns((prev) => {
      const pats = prev[rc.key].map((p, i) => {
        if (i !== patIdx) return p
        const filtered = p.filter((s) => !(s.timeSlot === slot && s.facility === facility))
        if (value) filtered.push({ timeSlot: slot, facility, clubName: value })
        return filtered
      })
      return { ...prev, [rc.key]: pats }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const newConfig = { ...config }
      ROT_CONFIGS.forEach(({ key, rotation, patternsKey }) => {
        const rot = (newConfig[rotation as keyof AppConfig] as Record<string, SlotEntry[][]> | null) ?? { summerPatterns: [], winterPatterns: [], startIndex: 0 }
        ;(newConfig[rotation as keyof AppConfig] as Record<string, SlotEntry[][]>) = { ...rot, [patternsKey]: patterns[key] }
      })
      await onSave(newConfig)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-3">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="flex gap-1 flex-wrap">
        {ROT_CONFIGS.map((r, i) => (
          <button key={r.key} onClick={() => setActiveRot(i)}
            className={`px-3 py-1 rounded text-sm ${activeRot === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {Array.from({ length: rc.count }, (_, pi) => (
        <div key={pi} className="border rounded-xl p-3 bg-white">
          <p className="text-xs font-semibold text-gray-600 mb-2">パターン {pi + 1}</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border px-1 py-0.5">時間帯</th>
                  {FACILITIES.map((f) => <th key={f} className="border px-1 py-0.5 whitespace-nowrap">{f.replace('体育館', '体')}</th>)}
                </tr>
              </thead>
              <tbody>
                {WEEKEND_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="border px-1 py-0.5 whitespace-nowrap font-medium">{slot}</td>
                    {FACILITIES.map((f) => (
                      <td key={f} className="border px-0.5 py-0.5">
                        <select value={getCell(pi, slot, f)} onChange={(e) => setCell(pi, slot, f, e.target.value)}
                          className="text-xs w-20 border-0 bg-transparent focus:ring-0">
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

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {saving ? '保存中...' : 'ローテーションを保存'}
      </button>
    </div>
  )
}

function StartIndexTab({ config, onSave }: { config: AppConfig; onSave: (c: AppConfig) => Promise<void> }) {
  const sat = (config.saturdayRotation?.startIndex ?? 0) + 1
  const sun = (config.sundayRotation?.startIndex ?? 0) + 1
  const [satStart, setSatStart] = useState(sat)
  const [sunStart, setSunStart] = useState(sun)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const satCount = Math.max(config.saturdayRotation?.summerPatterns?.filter(p => p.length > 0).length ?? 3, 1)
  const sunCount = Math.max(config.sundayRotation?.summerPatterns?.filter(p => p.length > 0).length ?? 3, 1)

  const handleSave = async () => {
    setSaving(true)
    try {
      const newConfig: AppConfig = {
        ...config,
        saturdayRotation: config.saturdayRotation ? { ...config.saturdayRotation, startIndex: satStart - 1 } : null,
        sundayRotation: config.sundayRotation ? { ...config.sundayRotation, startIndex: sunStart - 1 } : null,
      }
      await onSave(newConfig)
      setMsg('保存しました')
    } catch { setMsg('保存に失敗しました') }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000) }
  }

  return (
    <div className="space-y-4">
      {msg && <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded">{msg}</div>}
      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">土曜の開始パターン番号</label>
          <select value={satStart} onChange={(e) => setSatStart(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: satCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>パターン {n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">日曜の開始パターン番号</label>
          <select value={sunStart} onChange={(e) => setSunStart(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: sunCount }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>パターン {n}</option>
            ))}
          </select>
        </div>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
        {saving ? '保存中...' : '保存する'}
      </button>
    </div>
  )
}

export function AdminSettings() {
  const { config, setConfig } = useAppStore()
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
        {activeTab === 'ローテーション' && <RotationTab config={config} onSave={handleSave} />}
        {activeTab === '開始番号' && <StartIndexTab config={config} onSave={handleSave} />}
      </main>
    </div>
  )
}
