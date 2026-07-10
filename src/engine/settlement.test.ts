import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultPlayers } from './defaults'
import { minimizeTransfers, previewMultiplier, settle } from './settlement'
import type { HoleResult, RuleConfig } from './types'

type Patch = Partial<Omit<RuleConfig, 'doubleRule' | 'nearest' | 'longest'>> & {
  doubleRule?: Partial<RuleConfig['doubleRule']>
  nearest?: Partial<RuleConfig['nearest']>
  longest?: Partial<RuleConfig['longest']>
}

function cfg(patch: Patch = {}, playerCount = 4): RuleConfig {
  const base = defaultConfig(defaultPlayers(playerCount))
  return {
    ...base,
    ...patch,
    doubleRule: { ...base.doubleRule, ...patch.doubleRule },
    nearest: { ...base.nearest, ...patch.nearest },
    longest: { ...base.longest, ...patch.longest },
  }
}

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

describe('배판 트리거', () => {
  // 주의: [4,5,4,4]류 스코어는 3명 동타 트리거가 겹치므로 onMajorityTie를 끄고 검증
  it('버디 → 다음홀 ×2', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [
      hole(1, 4, [4, 5, 3, 6]),
      hole(2, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[0].multiplier).toBe(1)
    expect(s.holes[1].multiplier).toBe(2)
    // 2번홀: p2만 보기 → 각자에게 1타 × 5000 × 2 = 10000씩 지급
    expect(s.holes[1].netByPlayer).toEqual({ p1: 10000, p2: -30000, p3: 10000, p4: 10000 })
  })

  it('버디 2개 + 중첩 곱연산 → ×4 (상한 ×4)', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [
      hole(1, 4, [3, 3, 4, 5]),
      hole(2, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[1].multiplier).toBe(4)
  })

  it('상한 ×2면 트리거 2개여도 ×2', () => {
    const s = settle(cfg({ doubleRule: { maxMultiplier: 2, onMajorityTie: false } }), [
      hole(1, 4, [3, 3, 4, 5]),
      hole(2, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[1].multiplier).toBe(2)
  })

  it('중첩 곱연산 끔이면 트리거 개수 무관 ×2', () => {
    const s = settle(cfg({ doubleRule: { stacking: false, maxMultiplier: 0, onMajorityTie: false } }), [
      hole(1, 4, [3, 3, 4, 5]),
      hole(2, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[1].multiplier).toBe(2)
  })

  it('양파직전(파4 트리플) → 다음홀 ×2', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [
      hole(1, 4, [4, 4, 5, 7]),
      hole(2, 4, [4, 4, 4, 5]),
    ])
    expect(s.holes[1].multiplier).toBe(2)
  })

  it('3명 동타 → 당홀 소급 ×2', () => {
    const s = settle(cfg(), [hole(1, 4, [4, 4, 4, 5])])
    expect(s.holes[0].multiplier).toBe(2)
    // p4가 각자에게 1타 × 5000 × 2 = 10000씩
    expect(s.holes[0].netByPlayer).toEqual({ p1: 10000, p2: 10000, p3: 10000, p4: -30000 })
    // 당홀 조건이므로 다음홀로는 이월 안 됨
    expect(s.nextMultiplier).toBe(1)
  })

  it('전원 동타 → 다음홀 ×2 (당홀은 민판)', () => {
    const s = settle(cfg(), [hole(1, 4, [5, 5, 5, 5])])
    expect(s.holes[0].multiplier).toBe(1)
    expect(s.nextMultiplier).toBe(2)
  })

  it('3인 플레이: 2명 동타 → 당홀 소급 ×2', () => {
    const s = settle(cfg({}, 3), [hole(1, 4, [4, 4, 5])])
    expect(s.holes[0].multiplier).toBe(2)
    // p3가 각자에게 1타 × 5000 × 2 = 10000씩
    expect(s.holes[0].netByPlayer).toEqual({ p1: 10000, p2: 10000, p3: -20000 })
  })

  it('4인 플레이: 2명 동타는 당홀 배판 아님', () => {
    const s = settle(cfg(), [hole(1, 4, [4, 4, 5, 6])])
    expect(s.holes[0].multiplier).toBe(1)
  })

  it('수동 배판 콜(묻고 더블)', () => {
    const on = settle(cfg({ doubleRule: { onMajorityTie: false } }), [
      hole(1, 4, [4, 5, 4, 4], { manualDouble: true }),
    ])
    expect(on.holes[0].multiplier).toBe(2)
    const off = settle(cfg({ doubleRule: { allowManualCall: false, onMajorityTie: false } }), [
      hole(1, 4, [4, 5, 4, 4], { manualDouble: true }),
    ])
    expect(off.holes[0].multiplier).toBe(1)
  })

  it('배판 조건 끄면 트리거 없음', () => {
    const s = settle(
      cfg({ doubleRule: { onBirdie: false, onBigNumber: false, onMajorityTie: false, onAllTie: false } }),
      [hole(1, 4, [3, 8, 4, 4]), hole(2, 4, [4, 5, 4, 4])],
    )
    expect(s.holes[0].multiplier).toBe(1)
    expect(s.holes[1].multiplier).toBe(1)
  })
})

describe('내기 스킵 홀', () => {
  it('스킵 홀은 정산 없음 + 배판 리셋 + 트리거 미발생', () => {
    const s = settle(cfg(), [
      hole(1, 4, [3, 4, 5, 6]), // p1 버디 → 다음홀 배판 예정
      hole(2, 4, [3, 4, 4, 4], { skipBetting: true }), // 스킵: 정산 없음, 버디도 무효
      hole(3, 4, [4, 5, 6, 7]),
    ])
    expect(s.holes[1].skipped).toBe(true)
    expect(s.holes[1].netByPlayer).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 })
    expect(s.holes[2].multiplier).toBe(1) // 배판이 스킵 홀에서 소멸
  })

  it('첫홀도 스킵 토글로 몸풀기 처리 가능', () => {
    const s = settle(cfg(), [
      hole(1, 4, [3, 4, 5, 6], { skipBetting: true }),
      hole(2, 4, [4, 5, 6, 7]),
    ])
    expect(s.holes[0].skipped).toBe(true)
    expect(s.holes[0].netByPlayer.p1).toBe(0)
    expect(s.holes[1].multiplier).toBe(1)
  })
})

describe('미입력 홀', () => {
  it('미입력 홀은 배판 이월을 끊지 않음', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [
      hole(1, 4, [3, 4, 5, 6]), // 버디 → 다음 친 홀 배판
      hole(2, 4, [0, 0, 0, 0]), // 미입력
      hole(3, 4, [4, 5, 4, 4]),
    ])
    expect(s.holes[1].played).toBe(false)
    expect(s.holes[2].multiplier).toBe(2)
  })
})

describe('보너스 (버디값/이글값)', () => {
  it('버디값은 나머지 전원이 지급', () => {
    const s = settle(cfg({ doubleRule: { onMajorityTie: false } }), [hole(1, 4, [3, 4, 4, 4])])
    const birdie = s.holes[0].transfers.filter((t) => t.reason === 'birdie')
    expect(birdie).toHaveLength(3)
    expect(birdie.every((t) => t.to === 'p1' && t.amount === 5000)).toBe(true)
  })

  it('이글값 지급 + 파3 홀인원은 이글 등급', () => {
    const net = netOf(cfg(), [hole(1, 3, [1, 3, 3, 3])])
    // 3명 동타(3,3,3) → 당홀 ×2. 타수차: 각자 2타 × 5000 × 2 = 20000
    // 이글값 10000 × 배수2(bonusAffected) = 20000씩
    expect(net.p1).toBe(3 * 20000 + 3 * 20000)
    expectSumZero(net)
  })

  it('배판 시 보너스 배수 미적용 옵션', () => {
    const s = settle(cfg({ doubleRule: { bonusAffected: false, onMajorityTie: false } }), [
      hole(1, 4, [4, 4, 4, 4]), // 전원 동타 → 다음홀 배판
      hole(2, 4, [3, 4, 4, 4]),
    ])
    const birdie = s.holes[1].transfers.filter((t) => t.reason === 'birdie')
    expect(birdie.every((t) => t.amount === 5000)).toBe(true) // 배수 없이 원래 금액
    const stroke = s.holes[1].transfers.filter((t) => t.reason === 'stroke')
    expect(stroke.every((t) => t.amount === 10000)).toBe(true) // 타수차는 ×2
  })
})

describe('니어리스트', () => {
  it('정액 모드: 수령자가 나머지 각자에게서 받음', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false, onAllTie: false } }), [
      hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1' }),
    ])
    expect(net).toEqual({ p1: 15000, p2: -5000, p3: -5000, p4: -5000 })
  })

  it('1타 차감 모드: 정산용 타수에서만 차감', () => {
    const net = netOf(
      cfg({ nearest: { mode: 'strokeMinus' }, doubleRule: { onMajorityTie: false, onAllTie: false } }),
      [hole(1, 3, [3, 3, 3, 3], { nearestWinner: 'p1' })],
    )
    // eff: p1=2, 나머지 3 → 각자 1타 × 5000
    expect(net).toEqual({ p1: 15000, p2: -5000, p3: -5000, p4: -5000 })
  })

  it('파 세이브 조건: 니어 수령자가 보기면 무효', () => {
    const c = cfg({
      nearest: { requireParSave: true },
      doubleRule: { onMajorityTie: false, onAllTie: false },
    })
    const net = netOf(c, [hole(1, 3, [3, 4, 3, 3], { nearestWinner: 'p2' })])
    // 니어 무효 → 타수차만: p2가 각자에게 5000씩
    expect(net).toEqual({ p1: 5000, p2: -15000, p3: 5000, p4: 5000 })
  })

  it('파4에서는 니어 없음', () => {
    const net = netOf(cfg({ doubleRule: { onAllTie: false } }), [
      hole(1, 4, [4, 4, 4, 4], { nearestWinner: 'p1' }),
    ])
    expect(net.p1).toBe(0)
  })
})

describe('롱기스트', () => {
  it('켜면 파5에서 정액 지급', () => {
    const net = netOf(
      cfg({ longest: { enabled: true, amount: 3000 }, doubleRule: { onAllTie: false } }),
      [hole(1, 5, [5, 5, 5, 5], { longestWinner: 'p3' })],
    )
    expect(net).toEqual({ p1: -3000, p2: -3000, p3: 9000, p4: -3000 })
  })
})

describe('양파(더블파)', () => {
  it('양파 이상은 항상 더블파로 컷해서 정산', () => {
    const net = netOf(cfg({ doubleRule: { onMajorityTie: false } }), [hole(1, 4, [4, 12, 4, 4])])
    // p2 → 8로 컷: 4타차 × 5000 × 3명 = -60000 (3명 동타는 꺼서 민판)
    expect(net.p2).toBe(-60000)
  })

  it('양파자 배판 면제: 배판 홀에서 양파자가 낀 쌍은 민판', () => {
    const s = settle(cfg({ doubleRule: { doubleParExempt: true, onMajorityTie: false } }), [
      hole(1, 4, [3, 4, 4, 4]), // p1 버디 → 다음홀 ×2
      hole(2, 4, [4, 8, 5, 5]), // p2 양파
    ])
    expect(s.holes[1].multiplier).toBe(2)
    const t = s.holes[1].transfers
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

describe('배수 미리보기 (previewMultiplier)', () => {
  it('전홀 버디 후 미입력 홀 → ×2, 수동 콜 추가 → ×4', () => {
    const holes = [hole(1, 4, [3, 4, 5, 6]), hole(2, 4, [0, 0, 0, 0])]
    expect(previewMultiplier(cfg(), holes, 2)).toBe(2)
    const withCall = [holes[0], { ...holes[1], manualDouble: true }]
    expect(previewMultiplier(cfg(), withCall, 2)).toBe(4)
  })

  it('스킵 예정 홀은 항상 ×1', () => {
    const holes = [hole(1, 4, [3, 4, 5, 6]), hole(2, 4, [0, 0, 0, 0], { skipBetting: true })]
    expect(previewMultiplier(cfg(), holes, 2)).toBe(1)
  })
})

describe('불변식·정산 요약', () => {
  it('복합 라운드에서 전체 손익 합은 항상 0', () => {
    const c = cfg({
      handicaps: { p4: 2 },
      longest: { enabled: true, amount: 5000 },
    })
    const s = settle(c, [
      hole(1, 4, [4, 5, 3, 6]),
      hole(2, 5, [5, 6, 7, 4], { longestWinner: 'p2' }),
      hole(3, 3, [2, 3, 4, 6], { nearestWinner: 'p1' }),
      hole(4, 4, [4, 4, 4, 4], { skipBetting: true }),
      hole(5, 4, [8, 7, 3, 4], { manualDouble: true }),
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
