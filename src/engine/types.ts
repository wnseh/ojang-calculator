export interface Player {
  id: string
  name: string
}

/** 니어 보상: 정액 지급 / 해당 홀 정산용 타수 1타 차감 */
export type NearestMode = 'cash' | 'strokeMinus'

/**
 * 배판 옵션. 배수 자체는 자동 판정 없이 홀에서 직접 선택한다 (HoleResult.multiplier).
 * 트리거 관련 필드는 구버전 기록(자동 배판) 호환용으로만 남아 있다.
 */
export interface DoubleRule {
  /** 배판 시 버디값·니어값·롱기값도 배수 적용 */
  bonusAffected: boolean
  /** 배판 홀에서 양파 친 사람이 낀 쌍은 민판(×1) 정산 */
  doubleParExempt: boolean
  /** @deprecated 구버전 자동 배판: 버디 시 다음홀 배판 */
  onBirdie?: boolean
  /** @deprecated 구버전 자동 배판: 양파·양파직전 시 다음홀 배판 */
  onBigNumber?: boolean
  /** @deprecated 구버전 자동 배판: (인원-1)명 동타 시 당홀 배판 */
  onMajorityTie?: boolean
  /** @deprecated 구버전 자동 배판: 전원 동타 시 다음홀 배판 */
  onAllTie?: boolean
  /** @deprecated 구버전 자동 배판: 수동 배판 콜 허용 */
  allowManualCall?: boolean
  /** @deprecated 구버전 자동 배판: 배수 상한 (이 필드의 존재 = 구버전 기록) */
  maxMultiplier?: number
  /** @deprecated 구버전 자동 배판: 조건 중첩 곱연산 */
  stacking?: boolean
}

/** @deprecated 구버전 기록 호환용 — 새 라운드는 홀별 NearestHoleRule 사용 */
export interface NearestRule {
  enabled: boolean
  mode: NearestMode
  amount: number
  /** 니어 수령자가 그 홀 파 이상 못 하면 무효 */
  requireParSave: boolean
}

/** @deprecated 구버전 기록 호환용 — 새 라운드는 홀별 LongestHoleRule 사용 */
export interface LongestRule {
  enabled: boolean
  amount: number
}

/** 파3 홀에서 그때그때 정하는 니어 조건 */
export interface NearestHoleRule {
  mode: NearestMode
  amount: number
  /** 니어 수령자가 그 홀 파 이상 못 하면 무효 */
  requireParSave: boolean
}

/** 파5 홀에서 그때그때 정하는 롱기 조건 */
export interface LongestHoleRule {
  amount: number
}

export interface RuleConfig {
  players: Player[]
  /** 타당 금액 (오장 = 5,000) */
  strokeValue: number
  birdieBonus: number
  eagleBonus: number
  albatrossBonus: number
  /**
   * 플레이어별 받는 핸디 타수 (playerId → 타수).
   * 쌍별 차이가 자동 적용된다: 핸디 h인 사람은 핸디 g(<h)인 사람에게서 (h-g) × 타당을 받는다.
   * 라운드 시작부터 누적 손익에 즉시 반영.
   */
  handicaps: Record<string, number>
  doubleRule: DoubleRule
  /** @deprecated 구버전 기록 호환용 폴백 — 새 라운드에는 없음 */
  nearest?: NearestRule
  /** @deprecated 구버전 기록 호환용 폴백 — 새 라운드에는 없음 */
  longest?: LongestRule
  /** 1인 최대 손실 상한. null = 없음 */
  houseLimit: number | null
}

export interface HoleResult {
  holeNo: number
  par: 3 | 4 | 5
  /** playerId → gross 타수. 미입력 플레이어는 키 없음 */
  strokes: Record<string, number>
  /** 이 홀의 니어 조건 — undefined: 미정(구버전 config 폴백), null: 이 홀 니어 없음 */
  nearestRule?: NearestHoleRule | null
  /** 파3 니어 수령자 (없으면 null/undefined) */
  nearestWinner?: string | null
  /** 이 홀의 롱기 조건 — undefined: 미정(구버전 config 폴백), null: 이 홀 롱기 없음 */
  longestRule?: LongestHoleRule | null
  /** 파5 롱기 수령자 */
  longestWinner?: string | null
  /** 이 홀 내기 제외 (스코어만 기록) */
  skipBetting?: boolean
  /** 이 홀의 배수 — 홀에서 직접 선택 (×1=민판, ×2=배판, ×4, ×8, …). 기본 1 */
  multiplier?: number
  /** @deprecated 구버전 자동 배판: 수동 배판 콜 */
  manualDouble?: boolean
  /** @deprecated 구버전 자동 배판: 상한 변경 (이 홀부터 적용) */
  capOverride?: number
}

export type TransferReason = 'stroke' | 'birdie' | 'eagle' | 'albatross' | 'nearest' | 'longest' | 'handicap'

export interface Transfer {
  from: string
  to: string
  amount: number
  reason: TransferReason
}

export interface HoleSettlement {
  holeNo: number
  /** 정산에 반영됐는지 (전원 타수 입력 완료) */
  played: boolean
  /** 내기 제외 홀 */
  skipped: boolean
  /** 이 홀에 적용된 배수 (스킵/미입력이면 1) */
  multiplier: number
  transfers: Transfer[]
  /** 이 홀에서의 플레이어별 손익 */
  netByPlayer: Record<string, number>
}

export interface Settlement {
  holes: HoleSettlement[]
  handicapTransfers: Transfer[]
  /** 누적 손익 (핸디 포함) */
  netByPlayer: Record<string, number>
  /** 송금 횟수를 최소화한 최종 송금 목록 */
  minimalTransfers: { from: string; to: string; amount: number }[]
  /** 하우스 리밋 초과 등 경고 */
  warnings: string[]
}
