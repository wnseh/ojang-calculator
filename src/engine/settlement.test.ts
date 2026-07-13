import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultPlayers } from './defaults'
import { minimizeTransfers, settle } from './settlement'
import type { HoleResult, NearestHoleRule, RuleConfig } from './types'

type Patch = Partial<Omit<RuleConfig, 'doubleRule'>> & {
  doubleRule?: Partial<RuleConfig['doubleRule']>
}

function cfg(patch: Patch = {}, playerCount = 4): RuleConfig {
  const base = defaultConfig(defaultPlayers(playerCount))
  return {
    ...base,
    ...patch,
    doubleRule: { ...base.doubleRule, ...patch.doubleRule },
  }
}

const NEAR_CASH: NearestHoleRule = { mode: 'cash', amount: 5000, requireParSave: false }

function hole(
  holeNo: number,
  par: 3 | 4 | 5,
  strokes: number[],
  extra: Partial<HoleResult> = {},
): HoleResult {
  const s: Record<string, number> = {}
  strokes.forEach((v, i) => {
    if (v > 0) s[`p${i + 1}`] = v
  })
  return { holeNo, par, strokes: s, ...extra }
}

function netOf(config: RuleConfig, holes: HoleResult[]): Record<string, number> {
  return settle(config, holes).netByPlayer
}

function expectSumZero(net: Record<string, number>) {
  expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0)
}

describe('기본 쌍별 타수차 정산', () => {
  it('PRD 워크드 예제: 파4, A파/B보기/C버디/D더블', () => {
    const net = netOf(cfg(), [hole(1, 4, [4, 5, 3, 6])])
    expect(net).toEqual({ p1: 5000, p2: -15000, p3: 45000, p4: -35000 })
    expectSumZero(net)
  })

  it('전원 동타면 이동 금액 없음', () => {
    const net = netOf(cfg(), [hole(1, 4, [5, 5, 5, 5])])
    expect(net).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 })
  })

  it('3인 플레이도 동작', () => {
    const net = netOf(cfg({}, 3), [hole(1, 4, [4, 5, 6])])
    // p1: +5000(p2) +10000(p3) = +15000 / p2: -5000 +5000 = 0 / p3: -15000
    expect(net).toEqual({ p1: 15000, p2: 0, p3: -15000 })
  })
})

describe('홀 배수 직접 선택', () => {
  it('배수를 정하지 않으면 항상 민판(×1) — 버디/동타여도 자동 배판 없음', () => {
    const s = settle(cfg(), [hole(1, 4, [3, 4, 4, 4]), hole(2, 4, [4, 5, 4, 4])])
    expect(s.holes[0].multiplier).toBe(1)
    expect(s.holes[1].multiplier).toBe(1)
  })

  it('홀에서 선택한 배수로 그 홀만 계산', () => {
    const s = settle(cfg(), [
      hole(1, 4, [4, 5, 3, 6]),
      hole(2, 4, [4, 5, 6, 7], { multiplier: 2 }),
      hole(3, 4, [4, 5, 6, 7], { multiplier: 8 }),
      hole(4, 4, [4, 5, 6, 7]),
    ])
    expect(s.holes.map((h) => h.multiplier)).toEqual([1, 2, 8, 1])
    // 2번홀 p1: (1+2+3)타 × 5000 × 2 = +60000 / 3번홀은 ×8 = +240000
    expect(s.holes[1].netByPlayer.p1).toBe(60000)
    expect(s.holes[2].netByPlayer.p1).toBe(240000)
  })
})

describe('구버전 자동 배판 기록 호환 (레거시)', () => {
  const legacy = (patch: Partial<RuleConfig['doubleRule']> = {}) =>
    cfg({
      doubleRule: {
        bonusAffected: true,
        doubleParExempt: false,
        onBirdie: true,
        onBigNumber: true,
        onMajorityTie: true,
        onAllTie: true,
        allowManualCall: true,
        maxMultiplier: 4,
        stacking: true,
        ...patch,
      },
    })

  it('버디 → 다음홀 ×2', () => {
    const s = settle(legacy({ onMajorityTie: false }), [
      hole(1, 4, [4, 5, 3, 6]),
      hole(2, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[1].multiplier).toBe(2)
    expect(s.holes[1].netByPlayer).toEqual({ p1: 10000, p2: -30000, p3: 10000, p4: 10000 })
  })

  it('3명 동타 → 당홀 ×2, 상한 컷', () => {
    const s = settle(legacy(), [hole(1, 4, [4, 4, 4, 5])])
    expect(s.holes[0].multiplier).toBe(2)
    const capped = settle(legacy({ maxMultiplier: 2 }), [
      hole(1, 4, [3, 3, 4, 5]),
      hole(2, 4, [4, 5, 6, 7]),
    ])
    expect(capped.holes[1].multiplier).toBe(2)
  })

  it('스킵 홀에서 배판 리셋, 미입력 홀은 이월 유지', () => {
    const s = settle(legacy({ onMajorityTie: false }), [
      hole(1, 4, [3, 4, 5, 6]),
      hole(2, 4, [3, 4, 4, 4], { skipBetting: true }),
      hole(3, 4, [4, 5, 6, 7]),
    ])
    expect(s.holes[2].multiplier).toBe(1)
    const gap = settle(legacy({ onMajorityTie: false }), [
      hole(1, 4, [3, 4, 5, 6]),
      hole(2, 4, [0, 0, 0, 0]),
      hole(3, 4, [4, 5, 4, 4]),
    ])
    expect(gap.holes[2].multiplier).toBe(2)
  })

  it('묻고 더블 + capOverride(그 홀부터 적용)', () => {
    const s = settle(legacy({ onMajorityTie: false }), [
      hole(1, 4, [3, 3, 4, 5]), // 이월 트리거 2
      hole(2, 4, [3, 3, 4, 5], { capOverride: 8, manualDouble: true }), // 트리거 3 → ×8
      hole(3, 4, [4, 5, 6, 7], { manualDouble: true }), // 트리거 3, 상한 유지 → ×8
    ])
    expect(s.holes[1].multiplier).toBe(8)
    expect(s.holes[2].multiplier).toBe(8)
  })

  it('레거시 기록도 홀에 배수가 직접 있으면 그 값 우선', () => {
    const s = settle(legacy(), [hole(1, 4, [4, 4, 4, 5], { multiplier: 1 })])
    expect(s.holes[0].multiplier).toBe(1)
  })
})

describe('내기 스킵 홀 / 미입력 홀', () => {
  it('스킵 홀은 배수를 정했어도 정산 없음', () => {
    const s = settle(cfg(), [
      hole(1, 4, [3, 4, 5, 6], { skipBetting: true, multiplier: 4 }),
      hole(2, 4, [4, 5, 6, 7]),
    ])
    expect(s.holes[0].skipped).toBe(true)
    expect(s.holes[0].netByPlayer).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 })
    expect(s.holes[1].multiplier).toBe(1)
  })

  it('미입력 홀은 정산 없음(played=false)', () => {
    const s = settle(cfg(), [hole(1, 4, [0, 0, 0, 0]), hole(2, 4, [4, 5, 6, 7])])
    expect(s.holes[0].played).toBe(false)
    expect(s.holes[0].netByPlayer.p1).toBe(0)
    expect(s.holes[1].played).toBe(true)
  })
})

describe('보너스 (버디값/이글값)', () => {
  it('버디값은 나머지 전원이 지급', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [hole(1, 4, [3, 4, 4, 4])])
    const birdie = s.holes[0].transfers.filter((t) => t.reason === 'birdie')
    expect(birdie).toHaveLength(3)
    expect(birdie.every((t) => t.to === 'p1' && t.amount === 5000)).toBe(true)
  })

  it('이글값 지급 + 파3 홀인원은 이글 등급 (배판 홀이면 보너스도 배수)', () => {
    const net = netOf(cfg(), [hole(1, 3, [1, 3, 3, 3], { multiplier: 2 })])
    // 타수차: 각자 2타 × 5000 × 2 = 20000 / 이글값 10000 × 2 = 20000씩
    expect(net.p1).toBe(3 * 20000 + 3 * 20000)
    expectSumZero(net)
  })

  it('배판 시 보너스 배수 미적용 옵션', () => {
    const s = settle(cfg({ doubleRule: { bonusAffected: false, doubleParExempt: false } }), [
      hole(1, 4, [3, 4, 4, 4], { multiplier: 2 }),
    ])
    const birdie = s.holes[0].transfers.filter((t) => t.reason === 'birdie')
    expect(birdie.every((t) => t.amount === 5000)).toBe(true) // 배수 없이 원래 금액
    const stroke = s.holes[0].transfers.filter((t) => t.reason === 'stroke')
    expect(stroke.every((t) => t.amount === 10000)).toBe(true) // 타수차는 ×2
  })
})

describe('니어리스트 (홀별 설정)', () => {
  it('정액 모드: 수령자가 나머지 각자에게서 받음', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false, onAllTie: false } }), [
      hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1', nearestRule: NEAR_CASH }),
    ])
    expect(net).toEqual({ p1: 15000, p2: -5000, p3: -5000, p4: -5000 })
  })

  it('1타 차감 모드: 정산용 타수에서만 차감', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false, onAllTie: false } }), [
      hole(1, 3, [3, 3, 3, 3], {
        nearestWinner: 'p1',
        nearestRule: { ...NEAR_CASH, mode: 'strokeMinus' },
      }),
    ])
    // eff: p1=2, 나머지 3 → 각자 1타 × 5000
    expect(net).toEqual({ p1: 15000, p2: -5000, p3: -5000, p4: -5000 })
  })

  it('파 세이브 조건: 니어 수령자가 보기면 무효', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false, onAllTie: false } }), [
      hole(1, 3, [3, 4, 3, 3], {
        nearestWinner: 'p2',
        nearestRule: { ...NEAR_CASH, requireParSave: true },
      }),
    ])
    // 니어 무효 → 타수차만: p2가 각자에게 5000씩
    expect(net).toEqual({ p1: 5000, p2: -15000, p3: 5000, p4: 5000 })
  })

  it('니어 조건이 없는(미정/없음) 파3은 니어 지급 없음', () => {
    const c = cfg({ doubleRule: { onAllTie: false, onMajorityTie: false } })
    // 미정(undefined) + 새 라운드(config 폴백 없음)
    expect(netOf(c, [hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1' })]).p1).toBe(0)
    // 명시적 없음(null)
    expect(
      netOf(c, [hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1', nearestRule: null })]).p1,
    ).toBe(0)
  })

  it('파4에서는 니어 없음', () => {
    const net = netOf(cfg({ doubleRule: { onAllTie: false } }), [
      hole(1, 4, [4, 4, 4, 4], { nearestWinner: 'p1', nearestRule: NEAR_CASH }),
    ])
    expect(net.p1).toBe(0)
  })

  it('구버전 config 니어 설정 폴백 (저장된 라운드 호환)', () => {
    const c = cfg({
      nearest: { enabled: true, mode: 'cash', amount: 5000, requireParSave: false },
      doubleRule: { onMajorityTie: false, onAllTie: false },
    })
    // 홀에 nearestRule이 없으면(구버전 기록) config 값으로 계산
    const net = netOf(c, [hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1' })])
    expect(net.p1).toBe(15000)
    // 홀에서 명시적으로 없음(null) 처리하면 config보다 우선
    const off = netOf(c, [hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1', nearestRule: null })])
    expect(off.p1).toBe(0)
  })
})

describe('롱기스트 (홀별 설정)', () => {
  it('파5에서 정한 금액으로 정액 지급', () => {
    const net = netOf(cfg({ doubleRule: { onAllTie: false } }), [
      hole(1, 5, [5, 5, 5, 5], { longestWinner: 'p3', longestRule: { amount: 3000 } }),
    ])
    expect(net).toEqual({ p1: -3000, p2: -3000, p3: 9000, p4: -3000 })
  })

  it('조건 미정이면 지급 없음', () => {
    const net = netOf(cfg({ doubleRule: { onAllTie: false } }), [
      hole(1, 5, [5, 5, 5, 5], { longestWinner: 'p3' }),
    ])
    expect(net.p3).toBe(0)
  })
})


describe('양파(더블파)', () => {
  it('양파 이상은 항상 더블파로 컷해서 정산', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false } }), [hole(1, 4, [4, 12, 4, 4])])
    // p2 → 8로 컷: 4타차 × 5000 × 3명 = -60000 (3명 동타는 꺼서 민판)
    expect(net.p2).toBe(-60000)
  })

  it('양파자 배판 면제: 배판 홀에서 양파자가 낀 쌍은 민판', () => {
    const s = settle(cfg({ doubleRule: { bonusAffected: true, doubleParExempt: true } }), [
      hole(1, 4, [4, 8, 5, 5], { multiplier: 2 }), // p2 양파
    ])
    const t = s.holes[0].transfers
    // p2가 낀 쌍은 ×1: p2→p1 4타=20000, p2→p3 3타=15000, p2→p4 3타=15000
    expect(t.find((x) => x.from === 'p2' && x.to === 'p1')?.amount).toBe(20000)
    expect(t.find((x) => x.from === 'p2' && x.to === 'p3')?.amount).toBe(15000)
    // p2 없는 쌍은 ×2: p3→p1 1타=10000, p4→p1 1타=10000
    expect(t.find((x) => x.from === 'p3' && x.to === 'p1')?.amount).toBe(10000)
  })
})

describe('핸디', () => {
  it('플레이어별 받는 타수 → 쌍별 차이 자동 적용, 라운드 시작부터 반영', () => {
    // 나(p1) 0타, p2 0타, p3 5타, p4 10타 (타당 5000)
    const s = settle(cfg({ handicaps: { p1: 0, p2: 0, p3: 5, p4: 10 } }), [])
    // p1→p3 25000, p1→p4 50000, p2→p3 25000, p2→p4 50000, p3→p4 25000
    expect(s.handicapTransfers).toHaveLength(5)
    expect(s.netByPlayer).toEqual({ p1: -75000, p2: -75000, p3: 25000, p4: 125000 })
    expect(Object.values(s.netByPlayer).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('10타 주면 홀 입력 전부터 상대 +50,000 / 나 -50,000', () => {
    const s = settle(cfg({ handicaps: { p1: 0, p2: 10 } }, 2), [])
    expect(s.netByPlayer.p1).toBe(-50000)
    expect(s.netByPlayer.p2).toBe(50000)
  })
})

describe('하우스 리밋', () => {
  it('손실 상한 도달 시 경고', () => {
    const s = settle(cfg({ houseLimit: 30000 }), [hole(1, 4, [4, 5, 3, 6])])
    expect(s.warnings).toHaveLength(1)
    expect(s.warnings[0]).toContain('플레이어4')
  })
})

describe('불변식·정산 요약', () => {
  it('복합 라운드에서 전체 손익 합은 항상 0', () => {
    const c = cfg({ handicaps: { p4: 2 } })
    const s = settle(c, [
      hole(1, 4, [4, 5, 3, 6]),
      hole(2, 5, [5, 6, 7, 4], { longestWinner: 'p2', longestRule: { amount: 5000 } }),
      hole(3, 3, [2, 3, 4, 6], { nearestWinner: 'p1', nearestRule: NEAR_CASH }),
      hole(4, 4, [4, 4, 4, 4], { skipBetting: true }),
      hole(5, 4, [8, 7, 3, 4], { multiplier: 8 }),
    ])
    expectSumZero(s.netByPlayer)
    for (const h of s.holes) expectSumZero(h.netByPlayer)
  })

  it('최소 송금: 송금 합계가 채권 합계와 일치', () => {
    const net = { a: 30000, b: 5000, c: -20000, d: -15000 }
    const transfers = minimizeTransfers(net)
    const totalPaid = transfers.reduce((s, t) => s + t.amount, 0)
    expect(totalPaid).toBe(35000)
    // 각자 받는/내는 금액이 net과 일치
    const check: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 }
    for (const t of transfers) {
      check[t.from] -= t.amount
      check[t.to] += t.amount
    }
    expect(check).toEqual(net)
  })
})
