import { useState } from 'react'
import { useAppStore } from '../../store'
import { gasApi } from '../../lib/gasApi'
import { AdminNav } from '../../components/admin/AdminNav'
import {
  previewApplicationForm,
  exportApplicationForm,
  type ApplicationPreview,
} from '../../lib/applicationFormExport'
import type { Reservation } from '../../types'

export function AdminApplicationForm() {
  const { currentYear, currentMonth, config } = useAppStore()

  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<ApplicationPreview[] | null>(null)
  const [loadedReservations, setLoadedReservations] = useState<Reservation[] | null>(null)

  const handleLoad = async () => {
    if (!config) { setMessage('設定データを読み込み中です'); return }
    setLoading(true)
    setPreview(null)
    setMessage('')
    try {
      const reservations = await gasApi.getReservations(year, month)
      setLoadedReservations(reservations)
      const result = previewApplicationForm(year, month, config, reservations)
      setPreview(result)
      if (result.length === 0) {
        setMessage('この月に総合体育館を使用するクラブはありません')
      }
    } catch {
      setMessage('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!config || !loadedReservations) return
    setExporting(true)
    setMessage('')
    try {
      await exportApplicationForm(year, month, config, loadedReservations)
      setMessage('申請書を出力しました')
    } catch (e) {
      console.error(e)
      setMessage('出力に失敗しました')
    } finally {
      setExporting(false)
      setTimeout(() => setMessage(''), 4000)
    }
  }

  const totalSheets = preview?.reduce((sum, p) => sum + p.sheetCount, 0) ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav title="申請書出力" />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className={`text-sm px-4 py-2 rounded-lg ${
            message.includes('失敗') || message.includes('ありません')
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {message}
          </div>
        )}

        {/* 年月選択 */}
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-semibold text-gray-700 mb-3">対象年月</h2>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setPreview(null) }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}年</option>)}
            </select>
            <select
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setPreview(null) }}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <button
              onClick={handleLoad}
              disabled={loading || !config}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? '読み込み中...' : 'データ確認'}
            </button>
          </div>
          {!config && (
            <p className="text-xs text-amber-600 mt-2">※ 設定データ読み込み後に使用可能になります</p>
          )}
        </div>

        {/* プレビュー */}
        {preview !== null && preview.length > 0 && (
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">出力対象クラブ</h2>
              <span className="text-xs text-gray-500">合計 {totalSheets} シート</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2 pr-4">クラブ名</th>
                  <th className="pb-2 pr-4">施設</th>
                  <th className="pb-2 pr-4 text-right">利用回数</th>
                  <th className="pb-2 text-right">シート数</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-medium">{p.clubName}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.facilityType === '全面'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {p.facilityType}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-600">{p.entryCount}回</td>
                    <td className="py-2 text-right text-gray-600">{p.sheetCount}枚</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="mt-4 w-full bg-green-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
            >
              {exporting
                ? '生成中...'
                : `${year}年${String(month).padStart(2, '0')}月_総合体育館利用申請書.xlsx をダウンロード`}
            </button>
          </div>
        )}

        {/* 説明 */}
        <div className="bg-white border rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">出力仕様</p>
          <p>・対象施設：総合体育館（半面A・半面B・全面）</p>
          <p>・転記データ：ローテーション・固定スケジュール（占有予約は除く）</p>
          <p>・1シートに最大3件。4件以上は同クラブの2枚目シートに分割</p>
          <p>・申請者情報は全クラブ統一（一般社団法人たかすスポーツクラブ）</p>
        </div>
      </main>
    </div>
  )
}
