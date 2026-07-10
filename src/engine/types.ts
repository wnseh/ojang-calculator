export interface Player {
  id: string
  name: string
}

/** 니어 보상: 정액 지급 / 해당 홀 정산용 타수 1타 차감 */
export type NearestMode = 'cash' | 'strokeMinus'

export interface DoubleRule {
  /** 버디 이상 시 다음홀 배판 */
  onBirdie: boolean
  /** 양파·양파직전(파3 더블보기, 파4 트리플, 파5 쿼드) 시 다음홀 배판 */
  onBigNumber: boolean
  /** (인원-1)명 동타 시 당홀 배판 — 4인이면 3명 동타, 3인이면 2명 동타 */
  onMajorityTie: boolean
  /** 전원 동타 시 다음홀 배판 */
  onAllTie: boolean
  /** 수동 배판 콜("묻고 더블") 허용 */
  allowManualCall: boolean
  /** 배수 상한: 2 | 4 | 8, 0 = 무제한 */
  maxMultiplier: number
  /** 조건 중첩 시 곱연산 (트리거 2개 → ×4). 끄면 트리거 유무만 판단해 ×2 */
  stacking: boolean
  /** 배판 시 버디값·니어값·롱기값도 배수 적용 */
  bonusAffected: boolean
  /** 배판 홀에서 양파 친 사람이 낀 쌍은 민판(×1) 정산 */
  doubleParExempt: boolean
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
  /** 수동 배판 콜 */
  manualDouble?: boolean
  /**
   * 배판 상한 변경 — 이 홀부터 라운드 끝까지 적용 (2/4/8, 0=무제한).
   * undefined면 이전 홀의 변경값 또는 시작 시 정한 상한을 따른다.
   */
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
  /** 다음(아직 안 친) 홀에 이월된 트리거로 계산한 배수 */
  nextMultiplier: number
  /** 다음 홀로 이월된 트리거 수 (배수 미리보기용) */
  nextTriggers: number
  /** 하우스 리밋 초과 등 경고 */
  warnings: string[]
}
