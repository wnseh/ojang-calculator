import type { HoleResult, RuleConfig } from './engine/types'
import { settle } from './engine/settlement'

/** 종료된 라운드 보관 항목 — config/holes를 통째로 저장하고 정산은 볼 때마다 재계산 */
export interface HistoryEntry {
  id: string
  /** 라운드 날짜 (YYYY-MM-DD) */
  date: string
  config: RuleConfig
  holes: HoleResult[]
  memo: string
  /** 골프장 이름 (구버전 기록에는 없을 수 있음) */
  club?: string
  /** 시작 코스 */
  course?: string
}

const HISTORY_KEY = 'ojang-history-v1'
/** localStorage 용량 보호용 상한 — 초과 시 오래된 라운드부터 삭제 */
const MAX_ENTRIES = 200

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // 저장 실패는 무시
  }
}

/** 최신 라운드가 앞에 오도록 반환 */
export function addToHistory(entry: HistoryEntry): HistoryEntry[] {
  const entries = [...loadHistory(), entry]
  saveHistory(entries)
  return [...entries].reverse()
}

/** 같은 id의 항목을 갱신 (라운드 다시 열어 수정 후 저장) */
export function updateInHistory(entry: HistoryEntry): HistoryEntry[] {
  const entries = loadHistory().map((e) => (e.id === entry.id ? entry : e))
  saveHistory(entries)
  return [...entries].reverse()
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((e) => e.id !== id)
  saveHistory(entries)
  return [...entries].reverse()
}

export function listHistory(): HistoryEntry[] {
  return [...loadHistory()].reverse()
}

/* ---------- 백업 (내보내기/가져오기) ---------- */

export interface ExportPayload {
  app: 'ojang-calculator'
  version: 1
  exportedAt: string
  entries: HistoryEntry[]
}

export function buildExportPayload(exportedAt: string): ExportPayload {
  return { app: 'ojang-calculator', version: 1, exportedAt, entries: loadHistory() }
}

function isValidEntry(e: unknown): e is HistoryEntry {
  if (!e || typeof e !== 'object') return false
  const x = e as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.date === 'string' &&
    !!x.config &&
    typeof x.config === 'object' &&
    Array.isArray((x.config as Record<string, unknown>).players) &&
    Array.isArray(x.holes)
  )
}

/** 순수 병합 로직: 같은 id는 기존 기록 우선(중복 제외), 새 항목은 날짜순으로 끼워 넣음 */
export function mergeHistory(
  existing: HistoryEntry[],
  incoming: unknown,
): { merged: HistoryEntry[]; imported: number; skipped: number } {
  const payload = incoming as Partial<ExportPayload> | null
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entries)) {
    throw new Error('invalid payload')
  }
  const valid = payload.entries.filter(isValidEntry)
  if (valid.length === 0 && payload.entries.length > 0) throw new Error('invalid payload')

  const existingIds = new Set(existing.map((e) => e.id))
  const fresh = valid.filter((e) => !existingIds.has(e.id))
  const merged = [...existing, ...fresh].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
  return { merged, imported: fresh.length, skipped: valid.length - fresh.length }
}

/** 파일에서 읽은 payload를 저장소에 병합. 반환 목록은 최신순 */
export function importHistory(incoming: unknown): {
  entries: HistoryEntry[]
  imported: number
  skipped: number
} {
  const { merged, imported, skipped } = mergeHistory(loadHistory(), incoming)
  saveHistory(merged)
  return { entries: [...merged].reverse(), imported, skipped }
}

export interface PlayerTotal {
  name: string
  total: number
  rounds: number
}

/**
 * 이름 기준 누적 전적 (같은 이름 = 같은 사람으로 집계).
 * 순수 함수 — 테스트 가능하도록 entries를 인자로 받는다.
 */
export function aggregateTotals(entries: HistoryEntry[]): PlayerTotal[] {
  const map = new Map<string, PlayerTotal>()
  for (const e of entries) {
    const s = settle(e.config, e.holes)
    for (const p of e.config.players) {
      const key = p.name.trim()
      const cur = map.get(key) ?? { name: key, total: 0, rounds: 0 }
      cur.total += s.netByPlayer[p.id] ?? 0
      cur.rounds += 1
      map.set(key, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}
