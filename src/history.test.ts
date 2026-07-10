import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultPlayers } from './engine/defaults'
import type { HoleResult } from './engine/types'
import { aggregateTotals, type HistoryEntry } from './history'

function hole(holeNo: number, par: 3 | 4 | 5, strokes: number[]): HoleResult {
  const s: Record<string, number> = {}
  strokes.forEach((v, i) => (s[`p${i + 1}`] = v))
  return { holeNo, par, strokes: s }
}

function entry(id: string, holes: HoleResult[]): HistoryEntry {
  return { id, date: '2026-07-10', config: defaultConfig(defaultPlayers(4)), holes, memo: '' }
}

describe('누적 전적 집계', () => {
  it('이름 기준으로 라운드를 합산하고 수익순 정렬', () => {
    const entries = [
      // 라운드1: p1 +5000 / p2 -15000 / p3 +45000 / p4 -35000
      entry('1', [hole(1, 4, [4, 5, 3, 6])]),
      // 라운드2: 3명 동타 당홀 ×2 → p1 -30000 / 나머지 +10000
      entry('2', [hole(1, 4, [5, 4, 4, 4])]),
    ]
    const totals = aggregateTotals(entries)
    const byName = Object.fromEntries(totals.map((t) => [t.name, t]))
    expect(byName['플레이어1'].total).toBe(-25000)
    expect(byName['플레이어2'].total).toBe(-5000)
    expect(byName['플레이어3'].total).toBe(55000)
    expect(byName['플레이어4'].total).toBe(-25000)
    expect(byName['플레이어1'].rounds).toBe(2)
    // 수익순 정렬
    expect(totals[0].name).toBe('플레이어3')
    // 전체 합 0
    expect(totals.reduce((a, t) => a + t.total, 0)).toBe(0)
  })

  it('빈 히스토리는 빈 배열', () => {
    expect(aggregateTotals([])).toEqual([])
  })
})
