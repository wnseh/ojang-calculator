import type { HoleResult, RuleConfig } from './engine/types'
import { emptyHoles } from './engine/defaults'

export type Screen = 'setup' | 'play' | 'ledger' | 'history'

export interface AppState {
  screen: Screen
  config: RuleConfig | null
  holes: HoleResult[]
  currentHole: number
  memo: string
  /** 라운드 시작 날짜 (공유 텍스트용) */
  startedAt: string | null
  /** 히스토리에서 다시 연 라운드면 해당 항목 id — 종료 시 새로 추가하지 않고 갱신 */
  editingHistoryId: string | null
  /** 라운드 시작 직후 티샷 순서 뽑기 팝업 표시 여부 */
  showTeeOrder: boolean
}

export const initialState: AppState = {
  screen: 'setup',
  config: null,
  holes: [],
  currentHole: 1,
  memo: '',
  startedAt: null,
  editingHistoryId: null,
  showTeeOrder: false,
}

export type Action =
  | { type: 'START_ROUND'; config: RuleConfig; startedAt: string }
  | {
      type: 'RESUME_ROUND'
      config: RuleConfig
      holes: HoleResult[]
      memo: string
      startedAt: string
      historyId: string
    }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'GO_HOLE'; holeNo: number }
  | { type: 'SET_PAR'; holeNo: number; par: 3 | 4 | 5 }
  | { type: 'SET_STROKE'; holeNo: number; playerId: string; strokes: number | null }
  | { type: 'SET_NEAREST'; holeNo: number; playerId: string | null }
  | { type: 'SET_LONGEST'; holeNo: number; playerId: string | null }
  | { type: 'TOGGLE_SKIP'; holeNo: number }
  | { type: 'TOGGLE_MANUAL_DOUBLE'; holeNo: number }
  | { type: 'SET_MEMO'; memo: string }
  | { type: 'REORDER_PLAYERS'; order: string[] }
  | { type: 'DISMISS_TEE_ORDER' }
  | { type: 'NEW_ROUND' }
  | { type: 'FINISH_ROUND' }

function updateHole(
  holes: HoleResult[],
  holeNo: number,
  fn: (h: HoleResult) => HoleResult,
): HoleResult[] {
  return holes.map((h) => (h.holeNo === holeNo ? fn(h) : h))
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'START_ROUND':
      return {
        screen: 'play',
        config: action.config,
        holes: emptyHoles(),
        currentHole: 1,
        memo: '',
        startedAt: action.startedAt,
        editingHistoryId: null,
        showTeeOrder: true,
      }
    case 'RESUME_ROUND':
      return {
        screen: 'play',
        config: action.config,
        holes: action.holes,
        currentHole: 1,
        memo: action.memo,
        startedAt: action.startedAt,
        editingHistoryId: action.historyId,
        showTeeOrder: false,
      }
    case 'SET_SCREEN':
      return { ...state, screen: action.screen }
    case 'GO_HOLE':
      return { ...state, currentHole: Math.min(18, Math.max(1, action.holeNo)) }
    case 'SET_PAR':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => {
          // 오장에서 양파 이상은 없음 — 파가 줄면 기존 타수도 양파로 컷
          const strokes: Record<string, number> = {}
          for (const [id, v] of Object.entries(h.strokes)) strokes[id] = Math.min(v, action.par * 2)
          return {
            ...h,
            par: action.par,
            strokes,
            // 파가 바뀌면 니어/롱기 대상 홀 여부도 바뀌므로 초기화
            nearestWinner: action.par === 3 ? h.nearestWinner : null,
            longestWinner: action.par === 5 ? h.longestWinner : null,
          }
        }),
      }
    case 'SET_STROKE':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => {
          const strokes = { ...h.strokes }
          if (action.strokes == null) delete strokes[action.playerId]
          // 최소 1타, 최대 양파(더블파)
          else strokes[action.playerId] = Math.min(h.par * 2, Math.max(1, action.strokes))
          return { ...h, strokes }
        }),
      }
    case 'SET_NEAREST':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => ({ ...h, nearestWinner: action.playerId })),
      }
    case 'SET_LONGEST':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => ({ ...h, longestWinner: action.playerId })),
      }
    case 'TOGGLE_SKIP':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => ({ ...h, skipBetting: !h.skipBetting })),
      }
    case 'TOGGLE_MANUAL_DOUBLE':
      return {
        ...state,
        holes: updateHole(state.holes, action.holeNo, (h) => ({ ...h, manualDouble: !h.manualDouble })),
      }
    case 'SET_MEMO':
      return { ...state, memo: action.memo }
    case 'REORDER_PLAYERS': {
      if (!state.config) return state
      const byId = new Map(state.config.players.map((p) => [p.id, p]))
      const players = action.order.flatMap((id) => byId.get(id) ?? [])
      // 순서 배열이 현재 플레이어와 정확히 일치할 때만 적용
      if (players.length !== state.config.players.length) return state
      return { ...state, config: { ...state.config, players } }
    }
    case 'DISMISS_TEE_ORDER':
      return { ...state, showTeeOrder: false }
    case 'NEW_ROUND':
      return initialState
    case 'FINISH_ROUND':
      // 히스토리 저장(부수효과)은 호출부에서 처리 — 여기서는 초기화 후 히스토리 화면으로
      return { ...initialState, screen: 'history' }
  }
}

const STORAGE_KEY = 'ojang-round-v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || typeof parsed !== 'object' || !('screen' in parsed)) return initialState
    return { ...initialState, ...parsed }
  } catch {
    return initialState
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 저장 실패(용량 등)는 무시 — 앱 동작에는 영향 없음
  }
}
