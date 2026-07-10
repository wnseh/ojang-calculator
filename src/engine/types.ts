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

export interface NearestRule {
  enabled: boolean
  mode: NearestMode
  amount: number
  /** 니어 수령자가 그 홀 파 이상 못 하면 무효 */
  requireParSave: boolean
}

export interface LongestRule {
  enabled: boolean
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
  nearest: NearestRule
  longest: LongestRule
  /** 1인 최대 손실 상한. null = 없음 */
  houseLimit: number | null
}

export interface HoleResult {
  holeNo: number
  par: 3 | 4 | 5
  /** playerId → gross 타수. 미입력 플레이어는 키 없음 */
  strokes: Record<string, number>
  /** 파3 니어 수령자 (없으면 null/undefined) */
  nearestWinner?: string | null
  /** 파5 롱기 수령자 */
  longestWinner?: string | null
  /** 이 홀 내기 제외 (스코어만 기록) */
  skipBetting?: boolean
  /** 수동 배판 콜 */
  manualDouble?: boolean
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
  /** 하우스 리밋 초과 등 경고 */
  warnings: string[]
}
