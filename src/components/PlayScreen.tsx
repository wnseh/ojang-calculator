import { useEffect, useState, type Dispatch } from 'react'
import { BASE_LONGEST_RULE, BASE_NEAREST_RULE } from '../engine/defaults'
import { isHoleComplete } from '../engine/settlement'
import type { Settlement } from '../engine/types'
import { scoreClass, scoreLabel, signWon } from '../format'
import type { Action, AppState } from '../store'
import { MoneyInput, Row, Segmented, Toggle } from './controls'
import { OrderSheet } from './OrderSheet'
import { ThemeToggle } from './ThemeToggle'

export function PlayScreen({
  state,
  dispatch,
  settlement,
}: {
  state: AppState
  dispatch: Dispatch<Action>
  settlement: Settlement
}) {
  const config = state.config!
  const [showOrder, setShowOrder] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const hole = state.holes.find((h) => h.holeNo === state.currentHole)

  // 파3/파5 홀에 처음 들어오면, 이전 홀에서 정한 니어/롱기 조건을 디폴트로 깔아준다
  useEffect(() => {
    if (!hole) return
    if (hole.par === 3 && hole.nearestRule === undefined) {
      const prior = [...state.holes].reverse().find((h) => h.holeNo !== hole.holeNo && h.nearestRule)
      if (prior?.nearestRule) {
        dispatch({ type: 'SET_NEAREST_RULE', holeNo: hole.holeNo, rule: { ...prior.nearestRule } })
      }
    }
    if (hole.par === 5 && hole.longestRule === undefined) {
      const prior = [...state.holes].reverse().find((h) => h.holeNo !== hole.holeNo && h.longestRule)
      if (prior?.longestRule) {
        dispatch({ type: 'SET_LONGEST_RULE', holeNo: hole.holeNo, rule: { ...prior.longestRule } })
      }
    }
  }, [state.currentHole, hole, state.holes, dispatch])

  if (!hole) return null

  const complete = isHoleComplete(config, hole)
  const holeStat = settlement.holes.find((h) => h.holeNo === hole.holeNo)
  const skipped = !!holeStat?.skipped || !!hole.skipBetting
  const mult = hole.multiplier ?? 1

  const setStroke = (playerId: string, strokes: number) =>
    dispatch({ type: 'SET_STROKE', holeNo: hole.holeNo, playerId, strokes })

  const badge = skipped ? (
    <span className="badge badge-skip">내기 제외</span>
  ) : mult > 1 ? (
    <span className="badge badge-double">배판 ×{mult}</span>
  ) : (
    <span className="badge badge-normal">민판</span>
  )

  return (
    <div className="screen has-footer">
      <header className="app-header">
        <h1>{hole.holeNo}번 홀</h1>
        {badge}
        {state.editingHistoryId != null && <span className="badge badge-edit">기록 수정 중</span>}
        <button
          type="button"
          className="btn-secondary header-btn"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'ledger' })}
        >
          정산표
        </button>
        {state.localRules.length > 0 && (
          <button
            type="button"
            className="theme-toggle"
            aria-label="로컬룰 보기"
            onClick={() => setShowRules(true)}
          >
            ⓘ
          </button>
        )}
        <ThemeToggle />
      </header>

      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowRules(false)}
              aria-label="닫기"
            >
              ✕
            </button>
            <div className="modal-title">오늘의 로컬룰</div>
            <ul className="rules-view">
              {state.localRules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <nav className="hole-nav">
        {state.holes.map((h) => {
          const done = isHoleComplete(config, h)
          const cls = [
            'hole-chip',
            h.holeNo === state.currentHole ? 'current' : '',
            done ? 'done' : '',
            h.skipBetting ? 'skip' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={h.holeNo}
              type="button"
              className={cls}
              onClick={() => dispatch({ type: 'GO_HOLE', holeNo: h.holeNo })}
            >
              {h.holeNo}
            </button>
          )
        })}
      </nav>

      <section className="card">
        <div className="row">
          <span className="row-label">파</span>
          <div className="segmented">
            {([3, 4, 5] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={hole.par === p ? 'active' : ''}
                onClick={() => dispatch({ type: 'SET_PAR', holeNo: hole.holeNo, par: p })}
              >
                파{p}
              </button>
            ))}
          </div>
        </div>

        {config.players.map((p) => {
          const s = hole.strokes[p.id]
          const display = s ?? hole.par
          return (
            <div className="score-row" key={p.id}>
              <div className="score-name">
                <span>{p.name}</span>
                {s != null && (
                  <span className={`score-tag ${scoreClass(s, hole.par)}`}>
                    {scoreLabel(s, hole.par)}
                  </span>
                )}
              </div>
              <div className="stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={s != null && s <= 1}
                  onClick={() => setStroke(p.id, (s ?? hole.par) - 1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className={`stepper-value ${s == null ? 'unset' : ''}`}
                  onClick={() => setStroke(p.id, hole.par)}
                  title="탭하면 파로 입력"
                >
                  {display}
                </button>
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={s != null && s >= hole.par * 2}
                  onClick={() => setStroke(p.id, (s ?? hole.par) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}

        <div className="card-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => config.players.forEach((p) => setStroke(p.id, hole.par))}
          >
            전원 파
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowOrder(true)}>
            순서 변경
          </button>
        </div>
      </section>

      {showOrder && (
        <OrderSheet
          players={config.players}
          onApply={(order) => dispatch({ type: 'REORDER_PLAYERS', order })}
          onClose={() => setShowOrder(false)}
        />
      )}

      {hole.par === 3 && (
        <section className="card">
          <h2>니어리스트 — 이 홀</h2>
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${!hole.nearestRule ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_NEAREST_RULE', holeNo: hole.holeNo, rule: null })}
            >
              니어 없음
            </button>
            <button
              type="button"
              className={`chip ${hole.nearestRule ? 'active' : ''}`}
              onClick={() =>
                !hole.nearestRule &&
                dispatch({
                  type: 'SET_NEAREST_RULE',
                  holeNo: hole.holeNo,
                  rule: { ...BASE_NEAREST_RULE },
                })
              }
            >
              니어 있음
            </button>
          </div>
          {hole.nearestRule && (
            <>
              <Row label="보상 방식">
                <Segmented
                  value={hole.nearestRule.mode}
                  options={[
                    { value: 'cash', label: '정액 지급' },
                    { value: 'strokeMinus', label: '1타 차감' },
                  ]}
                  onChange={(v) =>
                    dispatch({
                      type: 'SET_NEAREST_RULE',
                      holeNo: hole.holeNo,
                      rule: { ...hole.nearestRule!, mode: v },
                    })
                  }
                />
              </Row>
              {hole.nearestRule.mode === 'cash' && (
                <Row label="니어 금액">
                  <MoneyInput
                    value={hole.nearestRule.amount}
                    onChange={(v) =>
                      dispatch({
                        type: 'SET_NEAREST_RULE',
                        holeNo: hole.holeNo,
                        rule: { ...hole.nearestRule!, amount: v },
                      })
                    }
                  />
                </Row>
              )}
              <Toggle
                checked={hole.nearestRule.requireParSave}
                onChange={(v) =>
                  dispatch({
                    type: 'SET_NEAREST_RULE',
                    holeNo: hole.holeNo,
                    rule: { ...hole.nearestRule!, requireParSave: v },
                  })
                }
                label="파 세이브 못하면 무효"
              />
              <p className="hint">니어 받은 사람:</p>
              <div className="chip-group">
                <button
                  type="button"
                  className={`chip ${!hole.nearestWinner ? 'active' : ''}`}
                  onClick={() =>
                    dispatch({ type: 'SET_NEAREST', holeNo: hole.holeNo, playerId: null })
                  }
                >
                  미정
                </button>
                {config.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip ${hole.nearestWinner === p.id ? 'active' : ''}`}
                    onClick={() =>
                      dispatch({ type: 'SET_NEAREST', holeNo: hole.holeNo, playerId: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="hint">여기서 정한 조건이 다음 파3에도 디폴트로 적용됩니다.</p>
        </section>
      )}

      {hole.par === 5 && (
        <section className="card">
          <h2>롱기스트 — 이 홀</h2>
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${!hole.longestRule ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_LONGEST_RULE', holeNo: hole.holeNo, rule: null })}
            >
              롱기 없음
            </button>
            <button
              type="button"
              className={`chip ${hole.longestRule ? 'active' : ''}`}
              onClick={() =>
                !hole.longestRule &&
                dispatch({
                  type: 'SET_LONGEST_RULE',
                  holeNo: hole.holeNo,
                  rule: { ...BASE_LONGEST_RULE },
                })
              }
            >
              롱기 있음
            </button>
          </div>
          {hole.longestRule && (
            <>
              <Row label="롱기 금액">
                <MoneyInput
                  value={hole.longestRule.amount}
                  onChange={(v) =>
                    dispatch({
                      type: 'SET_LONGEST_RULE',
                      holeNo: hole.holeNo,
                      rule: { amount: v },
                    })
                  }
                />
              </Row>
              <p className="hint">롱기 받은 사람:</p>
              <div className="chip-group">
                <button
                  type="button"
                  className={`chip ${!hole.longestWinner ? 'active' : ''}`}
                  onClick={() =>
                    dispatch({ type: 'SET_LONGEST', holeNo: hole.holeNo, playerId: null })
                  }
                >
                  미정
                </button>
                {config.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`chip ${hole.longestWinner === p.id ? 'active' : ''}`}
                    onClick={() =>
                      dispatch({ type: 'SET_LONGEST', holeNo: hole.holeNo, playerId: p.id })
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="hint">여기서 정한 조건이 다음 파5에도 디폴트로 적용됩니다.</p>
        </section>
      )}

      <section className="card">
        <Toggle
          checked={!!hole.skipBetting}
          onChange={() => dispatch({ type: 'TOGGLE_SKIP', holeNo: hole.holeNo })}
          label="이 홀 내기 제외"
          hint="스코어만 기록하고 정산에서 뺍니다 (배판도 리셋)"
        />
        {!skipped && (
          <>
            <Row label="이 홀 배수">
              <div className="stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={mult <= 1}
                  onClick={() =>
                    dispatch({
                      type: 'SET_MULTIPLIER',
                      holeNo: hole.holeNo,
                      multiplier: Math.max(1, mult / 2),
                    })
                  }
                >
                  ½
                </button>
                <span className={`stepper-value ${mult > 1 ? 'mult-on' : ''}`}>×{mult}</span>
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() =>
                    dispatch({ type: 'SET_MULTIPLIER', holeNo: hole.holeNo, multiplier: mult * 2 })
                  }
                >
                  ×2
                </button>
              </div>
            </Row>
            <p className="hint">
              배판이면 ×2, 배배판이면 ×4 … 홀마다 직접 정합니다. 기본은 민판(×1).
            </p>
          </>
        )}
      </section>

      {complete && holeStat && (
        <section className="card">
          <h2>{skipped ? '이 홀 내기 제외 · 누적 손익' : '이 홀 손익 · 누적 손익'}</h2>
          <div className="net-grid">
            {config.players.map((p) => {
              const v = holeStat.netByPlayer[p.id] ?? 0
              const total = settlement.netByPlayer[p.id] ?? 0
              return (
                <div key={p.id} className="net-cell">
                  <span className="net-name">{p.name}</span>
                  {!skipped && (
                    <span className={`net-value ${v > 0 ? 'plus' : v < 0 ? 'minus' : ''}`}>
                      {signWon(v)}
                    </span>
                  )}
                  <span className="net-total">
                    누적{' '}
                    <b className={total > 0 ? 'plus' : total < 0 ? 'minus' : ''}>{signWon(total)}</b>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <footer className="play-footer">
        <div className="net-strip">
          {config.players.map((p) => {
            const v = settlement.netByPlayer[p.id] ?? 0
            return (
              <span key={p.id} className="net-strip-item">
                {p.name}{' '}
                <b className={v > 0 ? 'plus' : v < 0 ? 'minus' : ''}>{signWon(v)}</b>
              </span>
            )
          })}
        </div>
        <div className="footer-nav">
          <button
            type="button"
            className="btn-secondary"
            disabled={state.currentHole <= 1}
            onClick={() => dispatch({ type: 'GO_HOLE', holeNo: state.currentHole - 1 })}
          >
            ← 이전
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={state.currentHole >= 18}
            onClick={() => dispatch({ type: 'GO_HOLE', holeNo: state.currentHole + 1 })}
          >
            다음 홀 →
          </button>
        </div>
      </footer>
    </div>
  )
}
