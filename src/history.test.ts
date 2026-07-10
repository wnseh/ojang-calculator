import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultPlayers } from './engine/defaults'
import type { HoleResult } from './engine/types'
import { aggregateTotals, mergeHistory, type HistoryEntry } from './history'

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

describe('백업 병합 (mergeHistory)', () => {
  const payload = (entries: HistoryEntry[]) => ({
    app: 'ojang-calculator',
    version: 1,
    exportedAt: '2026-07-10T00:00:00Z',
    entries,
  })

  it('새 라운드는 추가, 같은 id는 중복 제외, 날짜순 정렬', () => {
    const existing = [entry('100', [hole(1, 4, [4, 5, 3, 6])])]
    const incoming = payload([
      { ...entry('100', [hole(1, 4, [4, 4, 4, 4])]), date: '2026-06-01' }, // 같은 id → 제외
      { ...entry('50', [hole(1, 4, [5, 5, 5, 5])]), date: '2026-05-05' }, // 새 라운드
    ])
    const r = mergeHistory(existing, incoming)
    expect(r.imported).toBe(1)
    expect(r.skipped).toBe(1)
    expect(r.merged.map((e) => e.id)).toEqual(['50', '100']) // 날짜순
    // 같은 id는 기존 기록이 유지됨
    expect(r.merged[1].holes[0].strokes.p2).toBe(5)
  })

  it('잘못된 payload는 에러', () => {
    expect(() => mergeHistory([], { foo: 'bar' })).toThrow()
    expect(() => mergeHistory([], payload([{ bad: true } as never]))).toThrow()
  })

  it('빈 백업 파일도 정상 처리', () => {
    const r = mergeHistory([entry('1', [])], payload([]))
    expect(r.imported).toBe(0)
    expect(r.merged).toHaveLength(1)
  })
})
