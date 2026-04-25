const RELATED: Record<string, string[]> = {
  '女子バレー部': ['女子バレー部', '男女バレーボール'],
  '男子バレー':   ['男子バレー',   '男女バレーボール'],
}

/** 選択クラブと合同練習などで関連するクラブ名の配列を返す（自クラブを含む）*/
export function getRelatedClubs(selectedClub: string): string[] {
  return RELATED[selectedClub] ?? [selectedClub]
}
