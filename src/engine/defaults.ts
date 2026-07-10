import type { HoleResult, Player, RuleConfig } from './types'

export function defaultPlayers(count = 4): Player[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `플레이어${i + 1}` }))
}

export function defaultConfig(players: Player[] = defaultPlayers()): RuleConfig {
  return {
    players,
    strokeValue: 5000,
    birdieBonus: 5000,
    eagleBonus: 10000,
    albatrossBonus: 0,
    handicaps: {},
    doubleRule: {
      onBirdie: true,
      onBigNumber: true,
      onMajorityTie: true,
      onAllTie: true,
      allowManualCall: true,
      maxMultiplier: 4,
      stacking: true,
      bonusAffected: true,
      doubleParExempt: false,
    },
    // 니어/롱기는 라운드 전이 아니라 파3/파5 홀에서 그때그때 정한다 (HoleResult.nearestRule/longestRule)
    houseLimit: null,
  }
}

/** 파3에서 니어를 "있음"으로 켤 때의 기본 조건 */
export const BASE_NEAREST_RULE = { mode: 'cash' as const, amount: 5000, requireParSave: false }

/** 파5에서 롱기를 "있음"으로 켤 때의 기본 조건 */
export const BASE_LONGEST_RULE = { amount: 5000 }

/** 일반적인 파 배치(파4 10개, 파3 4개, 파5 4개)로 18홀 생성 */
export function emptyHoles(count = 18): HoleResult[] {
  const par3 = new Set([3, 6, 12, 16])
  const par5 = new Set([2, 9, 13, 18])
  return Array.from({ length: count }, (_, i) => {
    const no = i + 1
    const par: 3 | 4 | 5 = par3.has(no) ? 3 : par5.has(no) ? 5 : 4
    return { holeNo: no, par, strokes: {} }
  })
}
