import { useState } from 'react'
import { defaultConfig, defaultPlayers } from '../engine/defaults'
import type { RuleConfig } from '../engine/types'
import { MoneyInput, Row, Section, Segmented, Toggle } from './controls'

export function SetupScreen({
  onStart,
  onShowHistory,
}: {
  onStart: (config: RuleConfig) => void
  onShowHistory: () => void
}) {
  const [config, setConfig] = useState<RuleConfig>(() => defaultConfig())

  const set = (patch: Partial<RuleConfig>) => setConfig((c) => ({ ...c, ...patch }))
  const setDouble = (patch: Partial<RuleConfig['doubleRule']>) =>
    setConfig((c) => ({ ...c, doubleRule: { ...c.doubleRule, ...patch } }))
  const setNearest = (patch: Partial<RuleConfig['nearest']>) =>
    setConfig((c) => ({ ...c, nearest: { ...c.nearest, ...patch } }))
  const setLongest = (patch: Partial<RuleConfig['longest']>) =>
    setConfig((c) => ({ ...c, longest: { ...c.longest, ...patch } }))

  const setPlayerCount = (n: number) =>
    setConfig((c) => {
      const base = defaultPlayers(n)
      const players = base.map((p, i) => c.players[i] ?? p)
      const ids = new Set(players.map((p) => p.id))
      const handicaps: Record<string, number> = {}
      for (const [id, v] of Object.entries(c.handicaps)) if (ids.has(id)) handicaps[id] = v
      return { ...c, players, handicaps }
    })

  const setPlayerName = (id: string, name: string) =>
    setConfig((c) => ({
      ...c,
      players: c.players.map((p) => (p.id === id ? { ...p, name } : p)),
    }))

  const start = () => {
    const players = config.players.map((p, i) => ({
      ...p,
      name: p.name.trim() || `플레이어${i + 1}`,
    }))
    onStart({ ...config, players })
  }

  return (
    <div className="screen">
      <header className="app-header">
        <h1>⛳ 오장 계산기</h1>
        <button type="button" className="btn-secondary header-btn" onClick={onShowHistory}>
          지난 라운드
        </button>
        <span className="subtitle">라운드 시작 전 룰을 확인하세요</span>
      </header>

      <Section title="플레이어">
        <Row label="인원">
          <Segmented
            value={config.players.length}
            options={[
              { value: 3, label: '3명' },
              { value: 4, label: '4명' },
            ]}
            onChange={setPlayerCount}
          />
        </Row>
        {config.players.map((p, i) => (
          <Row key={p.id} label={`${i + 1}번`}>
            <input
              className="name-input"
              value={p.name}
              placeholder={`플레이어${i + 1}`}
              onChange={(e) => setPlayerName(p.id, e.target.value)}
            />
          </Row>
        ))}
      </Section>

      <Section title="금액">
        <Row label="타당 금액">
          <MoneyInput value={config.strokeValue} onChange={(v) => set({ strokeValue: v })} />
        </Row>
        <Row label="버디값">
          <MoneyInput value={config.birdieBonus} onChange={(v) => set({ birdieBonus: v })} />
        </Row>
        <Row label="이글값">
          <MoneyInput value={config.eagleBonus} onChange={(v) => set({ eagleBonus: v })} />
        </Row>
        <Row label="알바/홀인원값">
          <MoneyInput value={config.albatrossBonus} onChange={(v) => set({ albatrossBonus: v })} />
        </Row>
      </Section>

      <Section title="배판 조건">
        <Toggle
          checked={config.doubleRule.onBirdie}
          onChange={(v) => setDouble({ onBirdie: v })}
          label="버디 → 다음홀 배판"
        />
        <Toggle
          checked={config.doubleRule.onBigNumber}
          onChange={(v) => setDouble({ onBigNumber: v })}
          label="양파·양파직전 → 다음홀 배판"
          hint="파3 더블보기 / 파4 트리플 / 파5 쿼드 이상"
        />
        <Toggle
          checked={config.doubleRule.onMajorityTie}
          onChange={(v) => setDouble({ onMajorityTie: v })}
          label={`${config.players.length - 1}명 동타 → 당홀 배판`}
          hint={config.players.length === 4 ? '4인: 3명 동타 시' : '3인: 2명 동타 시'}
        />
        <Toggle
          checked={config.doubleRule.onAllTie}
          onChange={(v) => setDouble({ onAllTie: v })}
          label="전원 동타 → 다음홀 배판"
        />
        <Toggle
          checked={config.doubleRule.allowManualCall}
          onChange={(v) => setDouble({ allowManualCall: v })}
          label="수동 배판 콜 허용"
          hint="묻고 더블"
        />
        <Row label="배판 상한">
          <Segmented
            value={config.doubleRule.maxMultiplier}
            options={[
              { value: 2, label: '×2' },
              { value: 4, label: '×4' },
              { value: 8, label: '×8' },
              { value: 0, label: '무제한' },
            ]}
            onChange={(v) => setDouble({ maxMultiplier: v })}
          />
        </Row>
        <Toggle
          checked={config.doubleRule.stacking}
          onChange={(v) => setDouble({ stacking: v })}
          label="조건 중첩 시 곱연산"
          hint="트리거 2개면 ×4 (끄면 항상 ×2)"
        />
        <Toggle
          checked={config.doubleRule.bonusAffected}
          onChange={(v) => setDouble({ bonusAffected: v })}
          label="배판 시 버디값·니어값도 배수"
        />
        <Toggle
          checked={config.doubleRule.doubleParExempt}
          onChange={(v) => setDouble({ doubleParExempt: v })}
          label="양파자 배판 면제"
          hint="배판 홀에서 양파 친 사람이 낀 쌍은 민판"
        />
      </Section>

      <Section title="니어리스트 (파3)">
        <Toggle
          checked={config.nearest.enabled}
          onChange={(v) => setNearest({ enabled: v })}
          label="니어 포함"
        />
        {config.nearest.enabled && (
          <>
            <Row label="보상 방식">
              <Segmented
                value={config.nearest.mode}
                options={[
                  { value: 'cash', label: '정액 지급' },
                  { value: 'strokeMinus', label: '1타 차감' },
                ]}
                onChange={(v) => setNearest({ mode: v })}
              />
            </Row>
            {config.nearest.mode === 'cash' && (
              <Row label="니어 금액">
                <MoneyInput value={config.nearest.amount} onChange={(v) => setNearest({ amount: v })} />
              </Row>
            )}
            <Toggle
              checked={config.nearest.requireParSave}
              onChange={(v) => setNearest({ requireParSave: v })}
              label="파 세이브 못하면 무효"
            />
          </>
        )}
      </Section>

      <Section title="롱기스트 (파5)">
        <Toggle
          checked={config.longest.enabled}
          onChange={(v) => setLongest({ enabled: v })}
          label="롱기 포함"
        />
        {config.longest.enabled && (
          <Row label="롱기 금액">
            <MoneyInput value={config.longest.amount} onChange={(v) => setLongest({ amount: v })} />
          </Row>
        )}
      </Section>

      <Section title="핸디 (받는 타수)">
        {config.players.map((p) => (
          <Row key={p.id} label={p.name}>
            <div className="money-input">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={config.handicaps[p.id] ?? 0}
                onChange={(e) =>
                  set({
                    handicaps: {
                      ...config.handicaps,
                      [p.id]: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
              <span>타</span>
            </div>
          </Row>
        ))}
        <p className="hint">
          각자 받는 핸디 타수만 적으면 쌍별 차이가 자동 적용됩니다. 예) 나 0타, 상대 10타 →
          내가 상대에게 10타 × 타당 금액을 주는 것으로 라운드 시작부터 누적 손익에 반영.
        </p>
      </Section>

      <Section title="기타">
        <Row label="손실 상한">
          <MoneyInput
            value={config.houseLimit ?? 0}
            onChange={(v) => set({ houseLimit: v > 0 ? v : null })}
            step={10000}
          />
        </Row>
        <p className="hint">0이면 상한 없음. 도달 시 경고만 표시합니다.</p>
      </Section>

      <button type="button" className="btn-primary btn-big" onClick={start}>
        라운드 시작
      </button>
    </div>
  )
}
