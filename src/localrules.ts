/** 로컬룰 프리셋 — 확인용 체크리스트. 정산에는 영향 없음 */
export interface LocalRulePreset {
  id: string
  text: string
}

const PRESETS_KEY = 'ojang-localrules-v1'

/** 최초 실행 시 시드되는 기본 프리셋 — 이후에는 사용자가 수정/삭제한 목록이 유지된다 */
const DEFAULT_RULES = [
  '도로 구제 — 인드롭',
  '도로 구제 — 공 위치에 따라 드롭',
  '도로 구제 — 골프장 로컬룰 준수',
  '티샷 OB — 로컬티(특설티) 사용',
  '티샷 OB — 로컬티 없으면 두 번째로 멀리 친 사람 옆 드롭',
  '티샷 OB — 나간 선상에서 드롭',
  '페어웨이 디봇 자국 — 빼고 치기',
  '벙커 발자국 위 — 정리 후 플레이스',
  '언플레이어블 간소화 — 나무 뒤·맨땅 등 한 클럽 무벌타 구제',
]

export function loadRulePresets(): LocalRulePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // 손상 시 기본값으로 재시드
  }
  const seeded = DEFAULT_RULES.map((text, i) => ({ id: `d${i}`, text }))
  saveRulePresets(seeded)
  return seeded
}

export function saveRulePresets(presets: LocalRulePreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    // 저장 실패는 무시
  }
}
