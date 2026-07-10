import { describe, expect, it } from 'vitest'
import { defaultConfig, defaultPlayers } from './engine/defaults'
import { settle } from './engine/settlement'
import type { Action, AppState } from './store'
import { initialState, reducer } from './store'

/** UI가 쓰는 경로 그대로: 리듀서 액션을 순서대로 적용해 라운드를 시뮬레이션 */
function run(actions: Action[]): AppState {
  return actions.reduce(reducer, initialState)
}

function enterHole(
  holeNo: number,
  par: 3 | 4 | 5,
  strokes: number[],
  extra: Action[] = [],
): Action[] {
  const acts: Action[] = [{ type: 'SET_PAR', holeNo, par }]
  strokes.forEach((s, i) => acts.push({ type: 'SET_STROKE', holeNo, playerId: `p${i + 1}`, strokes: s }))
  return [...acts, ...extra]
}

describe('통합: 리듀서로 5홀 샘플 라운드 진행 (수기 계산 대조)', () => {
  it('전원동타 배판, 니어+버디, 스킵 리셋, 양파 시나리오', () => {
    const config = defaultConfig(defaultPlayers(4))
    const state = run([
      { type: 'START_ROUND', config, startedAt: '2026-07-10' },
      // 1번 홀: 전원 파 동타 → 돈 이동 없음, 다음홀 배판 예약
      ...enterHole(1, 4, [5, 5, 5, 5]),
      // 2번 홀: ×2 배판, [5,6,7,8]
      ...enterHole(2, 5, [5, 6, 7, 8]),
      // 3번 홀 파3: 니어 조건을 이 홀에서 정함 (정액 5천) + p1 버디+니어, 나머지 3명 동타 → 당홀 ×2
      ...enterHole(3, 3, [2, 3, 3, 3], [
        {
          type: 'SET_NEAREST_RULE',
          holeNo: 3,
          rule: { mode: 'cash', amount: 5000, requireParSave: false },
        },
        { type: 'SET_NEAREST', holeNo: 3, playerId: 'p1' },
      ]),
      // 4번 홀: 내기 제외 (p1 버디 배판 예약이 여기서 리셋)
      ...enterHole(4, 4, [4, 4, 4, 4], [{ type: 'TOGGLE_SKIP', holeNo: 4 }]),
      // 5번 홀: 민판 확인, p4 양파(컷 8)
      ...enterHole(5, 4, [4, 5, 6, 8]),
    ])

    const s = settle(state.config!, state.holes)

    // 홀별 배수: 1=민판, 2=배판, 3=당홀 3명 동타 배판, 4=스킵, 5=민판(스킵이 리셋)
    expect(s.holes[0].multiplier).toBe(1)
    expect(s.holes[1].multiplier).toBe(2)
    expect(s.holes[2].multiplier).toBe(2)
    expect(s.holes[3].skipped).toBe(true)
    expect(s.holes[4].multiplier).toBe(1)

    // 수기 계산:
    // 2번 홀(×2): p1 +60,000 / p2 +20,000 / p3 -20,000 / p4 -60,000
    expect(s.holes[1].netByPlayer).toEqual({ p1: 60000, p2: 20000, p3: -20000, p4: -60000 })
    // 3번 홀(×2): p1 = 타수차 30,000 + 버디값 30,000 + 니어 30,000 = +90,000
    expect(s.holes[2].netByPlayer).toEqual({ p1: 90000, p2: -30000, p3: -30000, p4: -30000 })
    // 5번 홀(민판): p4 양파 컷(8) 기준 정산
    expect(s.holes[4].netByPlayer).toEqual({ p1: 35000, p2: 15000, p3: -5000, p4: -45000 })

    // 누적: p1 +185,000 / p2 +5,000 / p3 -55,000 / p4 -135,000 (합 0)
    expect(s.netByPlayer).toEqual({ p1: 185000, p2: 5000, p3: -55000, p4: -135000 })
    expect(Object.values(s.netByPlayer).reduce((a, b) => a + b, 0)).toBe(0)

    // 5번 홀 p4 양파직전 이상 → 다음(6번) 홀 배판 예고
    expect(s.nextMultiplier).toBe(2)

    // 최소 송금: 지급 총액 = 채권 총액(190,000)
    const paid = s.minimalTransfers.reduce((a, t) => a + t.amount, 0)
    expect(paid).toBe(190000)
  })

  it('RESUME_ROUND로 히스토리 기록을 다시 열고 FINISH_ROUND로 정리', () => {
    const config = defaultConfig(defaultPlayers(4))
    const holes = run([
      { type: 'START_ROUND', config, startedAt: '2026-07-01' },
      ...enterHole(1, 4, [4, 5, 6, 7]),
    ]).holes

    const resumed = run([
      {
        type: 'RESUME_ROUND',
        config,
        holes,
        memo: '캐디피는 1등이',
        startedAt: '2026-07-01',
        historyId: 'h-1',
      },
    ])
    expect(resumed.screen).toBe('play')
    expect(resumed.editingHistoryId).toBe('h-1')
    expect(resumed.holes[0].strokes.p1).toBe(4)
    expect(resumed.memo).toBe('캐디피는 1등이')

    // 수정 중 스코어 변경 후 종료 → 히스토리 화면, 수정 상태 해제
    const finished = [
      { type: 'SET_STROKE', holeNo: 1, playerId: 'p1', strokes: 5 } as Action,
      { type: 'FINISH_ROUND' } as Action,
    ].reduce(reducer, resumed)
    expect(finished.screen).toBe('history')
    expect(finished.editingHistoryId).toBeNull()
    expect(finished.config).toBeNull()
  })

  it('REORDER_PLAYERS는 표시 순서만 바꾸고 정산은 동일', () => {
    const config = defaultConfig(defaultPlayers(4))
    const base = run([
      { type: 'START_ROUND', config, startedAt: '2026-07-10' },
      ...enterHole(1, 4, [4, 5, 3, 6]),
    ])
    expect(base.showTeeOrder).toBe(true) // 시작 직후 티샷 순서 팝업

    const before = settle(base.config!, base.holes).netByPlayer
    const reordered = [
      { type: 'REORDER_PLAYERS', order: ['p3', 'p1', 'p4', 'p2'] } as Action,
      { type: 'DISMISS_TEE_ORDER' } as Action,
    ].reduce(reducer, base)

    expect(reordered.config!.players.map((p) => p.id)).toEqual(['p3', 'p1', 'p4', 'p2'])
    expect(reordered.showTeeOrder).toBe(false)
    expect(settle(reordered.config!, reordered.holes).netByPlayer).toEqual(before)

    // 잘못된 순서 배열(누락)은 무시
    const invalid = reducer(reordered, { type: 'REORDER_PLAYERS', order: ['p1', 'p2'] })
    expect(invalid.config!.players.map((p) => p.id)).toEqual(['p3', 'p1', 'p4', 'p2'])
  })

  it('NEW_ROUND는 초기 상태로 되돌린다', () => {
    const config = defaultConfig(defaultPlayers(4))
    const state = run([
      { type: 'START_ROUND', config, startedAt: '2026-07-10' },
      ...enterHole(1, 4, [4, 5, 6, 7]),
      { type: 'NEW_ROUND' },
    ])
    expect(state).toEqual(initialState)
  })
})
