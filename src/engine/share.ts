import { isHoleComplete } from './settlement'
import type { HoleResult, RuleConfig, Settlement } from './types'

const fmt = (n: number) => n.toLocaleString('ko-KR')
const sign = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n))

/** 카톡 공유용 정산 텍스트 */
export function buildShareText(
  config: RuleConfig,
  holes: HoleResult[],
  settlement: Settlement,
  dateStr: string,
  memo?: string,
): string {
  const lines: string[] = []
  lines.push(`⛳ 오장 정산 (${dateStr})`)
  lines.push(`타당 ${fmt(config.strokeValue)}원 · ${config.players.length}인`)
  lines.push('')

  const played = holes.filter((h) => isHoleComplete(config, h))
  if (played.length > 0) {
    lines.push('[스코어]')
    lines.push(`홀(파): ${config.players.map((p) => p.name).join(' / ')}`)
    for (const h of played) {
      const hs = settlement.holes.find((s) => s.holeNo === h.holeNo)
      const scores = config.players.map((p) => h.strokes[p.id]).join(' / ')
      const badge = hs?.skipped ? ' [제외]' : hs && hs.multiplier > 1 ? ` [×${hs.multiplier}]` : ''
      lines.push(`${h.holeNo}(${h.par}): ${scores}${badge}`)
    }
    lines.push('')
  }

  lines.push('[최종 손익]')
  for (const p of config.players) {
    lines.push(`${p.name} ${sign(settlement.netByPlayer[p.id] ?? 0)}원`)
  }
  lines.push('')

  if (settlement.minimalTransfers.length > 0) {
    const name = (id: string) => config.players.find((p) => p.id === id)?.name ?? id
    lines.push('[송금]')
    for (const t of settlement.minimalTransfers) {
      lines.push(`${name(t.from)} → ${name(t.to)} ${fmt(t.amount)}원`)
    }
  } else {
    lines.push('[송금] 없음 (전원 0원)')
  }

  if (memo && memo.trim()) {
    lines.push('')
    lines.push(`[메모] ${memo.trim()}`)
  }
  return lines.join('\n')
}
