/** 合同練習などで1つの枠を共有するクラブの対応表。
 *  「男女バレーボール」を廃止し男子・女子を独立した枠に分けたため、現在は関連クラブなし。 */
const RELATED: Record<string, string[]> = {}

/** 選択クラブと合同練習などで関連するクラブ名の配列を返す（自クラブを含む）*/
export function getRelatedClubs(selectedClub: string): string[] {
  return RELATED[selectedClub] ?? [selectedClub]
}
