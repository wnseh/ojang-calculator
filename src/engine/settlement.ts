import type {
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

function zeroNet(config: RuleConfig): Record<string, number> {
  const net: Record<string, number> = {}
  for (const p of config.players) net[p.id] = 0
  return net
}

function isSkipped(hole: HoleResult): boolean {
  return !!hole.skipBetting
}

/** 홀의 정산용 타수 계산에 쓰는 공통 헬퍼 (양파 컷 + 니어 1타 차감) */
function resolveNearest(config: RuleConfig, hole: HoleResult) {
  const nearestRule =
    hole.nearestRule !== undefined
      ? hole.nearestRule
      : config.nearest?.enabled
        ? config.nearest
        : null
  const nearestValid =
    hole.par === 3 &&
    !!nearestRule &&
    !!hole.nearestWinner &&
    (!nearestRule.requireParSave || hole.strokes[hole.nearestWinner] <= hole.par)
  return { nearestRule, nearestValid }
}

function effStrokes(config: RuleConfig, hole: HoleResult): (id: string) => number {
  const dp = hole.par * 2
  const { nearestRule, nearestValid } = resolveNearest(config, hole)
  return (id: string) =>
    Math.min(hole.strokes[id], dp) -
    (nearestValid && nearestRule?.mode === 'strokeMinus' && id === hole.nearestWinner ? 1 : 0)
}

/** 구버전(자동 배판 트리거) 설정으로 저장된 라운드인지 */
function isLegacyConfig(config: RuleConfig): boolean {
  return typeof config.doubleRule.maxMultiplier === 'number'
}

/**
 * 구버전 기록 호환: 예전 자동 배판 로직(버디/양파/동타 트리거, 이월, 상한, 묻고 더블)으로
 * 홀별 배수를 계산한다. 새 라운드는 홀에서 배수를 직접 선택하므로 이 경로를 타지 않는다.
 */
function computeLegacyMultipliers(config: RuleConfig, holes: HoleResult[]): Map<number, number> {
  const rule = config.doubleRule
  const players = config.players
  const result = new Map<number, number>()
  let carry = 0
  let cap = rule.maxMultiplier ?? 0

  const fromTriggers = (triggers: number): number => {
    if (triggers <= 0) return 1
    let m = rule.stacking ? 2 ** triggers : 2
    if (cap > 0) m = Math.min(m, cap)
    return m
  }

  for (const hole of [...holes].sort((a, b) => a.holeNo - b.holeNo)) {
    if (hole.capOverride != null) cap = hole.capOverride
    const played = isHoleComplete(config, hole)
    if (!played) {
      result.set(hole.holeNo, 1)
      continue // 미입력 홀: 이월 유지
    }
    if (isSkipped(hole)) {
      carry = 0 // 스킵 홀에서 배판 리셋
      result.set(hole.holeNo, 1)
      continue
    }

    const eff = effStrokes(config, hole)
    const gross = (id: string) => hole.strokes[id]
    const dp = hole.par * 2

    let triggers = carry + (hole.manualDouble && rule.allowManualCall ? 1 : 0)
    if (rule.onMajorityTie && players.length >= 3) {
      const counts = new Map<number, number>()
      for (const p of players) counts.set(eff(p.id), (counts.get(eff(p.id)) ?? 0) + 1)
      if ([...counts.values()].includes(players.length - 1)) triggers++
    }
    result.set(hole.holeNo, fromTriggers(triggers))

    let nextCarry = 0
    if (rule.onBirdie) nextCarry += players.filter((p) => gross(p.id) - hole.par <= -1).length
    if (rule.onBigNumber) nextCarry += players.filter((p) => gross(p.id) >= dp - 1).length
    if (rule.onAllTie) {
      const vals = players.map((p) => eff(p.id))
      if (vals.every((v) => v === vals[0])) nextCarry++
    }
    carry = nextCarry
  }
  return result
}

/**
 * 정산 엔진 (순수 함수). 전체를 매번 재계산한다.
 * - 배수는 홀에서 직접 선택한 값(hole.multiplier, 기본 ×1)을 쓴다.
 *   구버전 기록(자동 배판 설정)은 예전 로직으로 배수를 복원해 호환.
 * - 미입력 홀/스킵 홀: 정산 없음
 */
export function settle(config: RuleConfig, holes: HoleResult[]): Settlement {
  const players = config.players
  const rule = config.doubleRule
  const holeSettlements: HoleSettlement[] = []
  const net = zeroNet(config)
  const legacy = isLegacyConfig(config) ? computeLegacyMultipliers(config, holes) : null

  const sorted = [...holes].sort((a, b) => a.holeNo - b.holeNo)

  for (const hole of sorted) {
    const skipped = isSkipped(hole)
    const played = isHoleComplete(config, hole)

    if (!played || skipped) {
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
    const { nearestRule, nearestValid } = resolveNearest(config, hole)
    const longestRule =
      hole.longestRule !== undefined
        ? hole.longestRule
        : config.longest?.enabled
          ? config.longest
          : null
    const eff = effStrokes(config, hole)

    // 이 홀의 배수: 직접 선택한 값 > 구버전 자동 계산 > ×1
    const mult = hole.multiplier ?? legacy?.get(hole.holeNo) ?? 1

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
    if (nearestValid && nearestRule?.mode === 'cash' && hole.nearestWinner) {
      for (const q of players)
        if (q.id !== hole.nearestWinner)
          push(q.id, hole.nearestWinner, nearestRule.amount * bonusMult, 'nearest')
    }
    if (longestRule && par === 5 && hole.longestWinner) {
      for (const q of players)
        if (q.id !== hole.longestWinner)
          push(q.id, hole.longestWinner, longestRule.amount * bonusMult, 'longest')
    }

    const holeNet = zeroNet(config)
    for (const t of transfers) {
      holeNet[t.from] -= t.amount
      holeNet[t.to] += t.amount
    }
    for (const p of players) net[p.id] += holeNet[p.id]

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
        warnings.push(
          `${p.name}님이 손실 상한(${config.houseLimit.toLocaleString('ko-KR')}원)에 도달했습니다.`,
        )
    }
  }

  return {
    holes: holeSettlements,
    handicapTransfers,
    netByPlayer: net,
    minimalTransfers: minimizeTransfers(net),
    warnings,
  }
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
