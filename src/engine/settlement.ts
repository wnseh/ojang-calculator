import type {
  DoubleRule,
  HoleResult,
  HoleSettlement,
  RuleConfig,
  Settlement,
  Transfer,
  TransferReason,
} from './types'

/** 전원 타수 입력 완료 여부 */
export function isHoleComplete(config: RuleConfig, hole: HoleResult): boolean {
  return config.players.every((p) => {
    const s = hole.strokes[p.id]
    return typeof s === 'number' && s > 0
  })
}

function multiplierFromTriggers(triggers: number, rule: DoubleRule): number {
  if (triggers <= 0) return 1
  let m = rule.stacking ? 2 ** triggers : 2
  if (rule.maxMultiplier > 0) m = Math.min(m, rule.maxMultiplier)
  return m
}

function zeroNet(config: RuleConfig): Record<string, number> {
  const net: Record<string, number> = {}
  for (const p of config.players) net[p.id] = 0
  return net
}

/** 홀 자체 조건(이월 제외)으로 발생하는 트리거 수. 동타 트리거는 스코어가 있어야 판정 가능 */
function staticTriggers(config: RuleConfig, hole: HoleResult): number {
  return hole.manualDouble && config.doubleRule.allowManualCall ? 1 : 0
}

function isSkipped(_config: RuleConfig, hole: HoleResult): boolean {
  return !!hole.skipBetting
}

/**
 * 정산 엔진 (순수 함수). 홀 순서대로 배판 상태를 굴리며 전체를 매번 재계산한다.
 * - 미입력 홀: 정산 없음, 이월 트리거는 유지 (아직 안 친 홀 취급)
 * - 스킵 홀: 정산 없음, 이월 트리거 소멸, 새 트리거 미발생
 */
export function settle(config: RuleConfig, holes: HoleResult[]): Settlement {
  const players = config.players
  const rule = config.doubleRule
  const holeSettlements: HoleSettlement[] = []
  const net = zeroNet(config)
  let carry = 0 // 다음 홀로 이월된 트리거 수

  const sorted = [...holes].sort((a, b) => a.holeNo - b.holeNo)

  for (const hole of sorted) {
    const skipped = isSkipped(config, hole)
    const played = isHoleComplete(config, hole)

    if (!played || skipped) {
      if (played && skipped) carry = 0 // 스킵 홀을 지나면 배판 리셋
      holeSettlements.push({
        holeNo: hole.holeNo,
        played,
        skipped,
        multiplier: 1,
        transfers: [],
        netByPlayer: zeroNet(config),
      })
      continue
    }

    const par = hole.par
    const dp = par * 2 // 양파(더블파)
    const gross = (id: string) => hole.strokes[id]
    // 오장에서 양파 이상은 없다 — 항상 더블파로 컷
    const cut = (id: string) => Math.min(gross(id), dp)

    const nearestValid =
      config.nearest.enabled &&
      par === 3 &&
      !!hole.nearestWinner &&
      (!config.nearest.requireParSave || gross(hole.nearestWinner) <= par)

    // 정산용 타수: 양파 컷 + 니어 1타 차감 모드
    const eff = (id: string) =>
      cut(id) -
      (nearestValid && config.nearest.mode === 'strokeMinus' && id === hole.nearestWinner ? 1 : 0)

    // 배수 결정: 이월 + 당홀(수동 콜 / (인원-1)명 동타)
    let triggers = carry + staticTriggers(config, hole)
    if (rule.onMajorityTie && players.length >= 3) {
      const counts = new Map<number, number>()
      for (const p of players) counts.set(eff(p.id), (counts.get(eff(p.id)) ?? 0) + 1)
      // 4인이면 3명 동타, 3인이면 2명 동타 (전원 동타는 별도 규칙)
      if ([...counts.values()].includes(players.length - 1)) triggers++
    }
    const mult = multiplierFromTriggers(triggers, rule)

    const transfers: Transfer[] = []
    const push = (from: string, to: string, amount: number, reason: TransferReason) => {
      if (amount > 0) transfers.push({ from, to, amount, reason })
    }

    // 1) 쌍별 타수차 정산
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i].id
        const b = players[j].id
        const diff = eff(a) - eff(b)
        if (diff === 0) continue
        let pairMult = mult
        if (rule.doubleParExempt && mult > 1 && (gross(a) >= dp || gross(b) >= dp)) pairMult = 1
        const amount = Math.abs(diff) * config.strokeValue * pairMult
        if (diff > 0) push(a, b, amount, 'stroke')
        else push(b, a, amount, 'stroke')
      }
    }

    // 2) 스코어 보너스 (gross 기준, 가장 높은 등급 하나만)
    const bonusMult = rule.bonusAffected ? mult : 1
    for (const p of players) {
      const rel = gross(p.id) - par
      let amount = 0
      let reason: TransferReason = 'birdie'
      if (rel <= -3) {
        amount = config.albatrossBonus
        reason = 'albatross'
      } else if (rel === -2) {
        amount = config.eagleBonus
        reason = 'eagle'
      } else if (rel === -1) {
        amount = config.birdieBonus
        reason = 'birdie'
      }
      if (amount > 0) {
        for (const q of players) if (q.id !== p.id) push(q.id, p.id, amount * bonusMult, reason)
      }
    }

    // 3) 니어 정액 / 롱기
    if (nearestValid && config.nearest.mode === 'cash' && hole.nearestWinner) {
      for (const q of players)
        if (q.id !== hole.nearestWinner)
          push(q.id, hole.nearestWinner, config.nearest.amount * bonusMult, 'nearest')
    }
    if (config.longest.enabled && par === 5 && hole.longestWinner) {
      for (const q of players)
        if (q.id !== hole.longestWinner)
          push(q.id, hole.longestWinner, config.longest.amount * bonusMult, 'longest')
    }

    const holeNet = zeroNet(config)
    for (const t of transfers) {
      holeNet[t.from] -= t.amount
      holeNet[t.to] += t.amount
    }
    for (const p of players) net[p.id] += holeNet[p.id]

    // 다음홀 이월 트리거 계산
    let nextCarry = 0
    if (rule.onBirdie) nextCarry += players.filter((p) => gross(p.id) - par <= -1).length
    if (rule.onBigNumber) nextCarry += players.filter((p) => gross(p.id) >= dp - 1).length
    if (rule.onAllTie) {
      const vals = players.map((p) => eff(p.id))
      if (vals.every((v) => v === vals[0])) nextCarry++
    }
    carry = nextCarry

    holeSettlements.push({
      holeNo: hole.holeNo,
      played: true,
      skipped: false,
      multiplier: mult,
      transfers,
      netByPlayer: holeNet,
    })
  }

  // 핸디: 플레이어별 받는 타수의 쌍별 차이 × 타당 — 라운드 시작부터 누적 손익에 반영
  const handicapTransfers: Transfer[] = []
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i].id
      const b = players[j].id
      const diff = (config.handicaps[b] ?? 0) - (config.handicaps[a] ?? 0)
      if (diff === 0) continue
      const amount = Math.abs(diff) * config.strokeValue
      // 핸디를 덜 받는 사람(고수)이 더 받는 사람에게 지급
      if (diff > 0) handicapTransfers.push({ from: a, to: b, amount, reason: 'handicap' })
      else handicapTransfers.push({ from: b, to: a, amount, reason: 'handicap' })
    }
  }
  for (const t of handicapTransfers) {
    net[t.from] -= t.amount
    net[t.to] += t.amount
  }

  const warnings: string[] = []
  if (config.houseLimit != null && config.houseLimit > 0) {
    for (const p of players) {
      if (net[p.id] <= -config.houseLimit)
        warnings.push(`${p.name}님이 손실 상한(${config.houseLimit.toLocaleString('ko-KR')}원)에 도달했습니다.`)
    }
  }

  return {
    holes: holeSettlements,
    handicapTransfers,
    netByPlayer: net,
    minimalTransfers: minimizeTransfers(net),
    nextMultiplier: multiplierFromTriggers(carry, rule),
    warnings,
  }
}

/**
 * 특정 홀에 적용될 배수 미리보기 (홀 입력 화면 뱃지용).
 * 스코어 미입력 홀은 이월 + 당홀 정적 조건(수동 콜/첫홀)만 반영 — 3명 동타는 입력 후 확정.
 */
export function previewMultiplier(config: RuleConfig, holes: HoleResult[], holeNo: number): number {
  const target = holes.find((h) => h.holeNo === holeNo)
  if (!target) return 1
  if (isSkipped(config, target)) return 1
  if (isHoleComplete(config, target)) {
    const s = settle(config, holes)
    return s.holes.find((h) => h.holeNo === holeNo)?.multiplier ?? 1
  }
  const prior = holes.filter((h) => h.holeNo < holeNo)
  const s = settle(config, prior)
  // nextMultiplier는 이월분만 반영하므로 트리거 수로 되돌린 뒤 당홀 정적 트리거를 더한다
  const rule = config.doubleRule
  const carryTriggers = s.nextMultiplier <= 1 ? 0 : Math.round(Math.log2(s.nextMultiplier))
  return multiplierFromTriggers(carryTriggers + staticTriggers(config, target), rule)
}

/** 누적 손익을 송금 횟수 최소로 상계 (그리디) */
export function minimizeTransfers(net: Record<string, number>): {
  from: string
  to: string
  amount: number
}[] {
  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v)
  const debtors = Object.entries(net)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((a, b) => b.v - a.v)

  const result: { from: string; to: string; amount: number }[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].v, debtors[di].v)
    if (pay > 0) result.push({ from: debtors[di].id, to: creditors[ci].id, amount: pay })
    creditors[ci].v -= pay
    debtors[di].v -= pay
    if (creditors[ci].v === 0) ci++
    if (debtors[di].v === 0) di++
  }
  return result
}
