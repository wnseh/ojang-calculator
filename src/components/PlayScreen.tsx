import type { Dispatch } from 'react'
import { isHoleComplete, previewMultiplier } from '../engine/settlement'
import type { Settlement } from '../engine/types'
import { scoreClass, scoreLabel, signWon } from '../format'
import type { Action, AppState } from '../store'
import { Toggle } from './controls'

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
  const hole = state.holes.find((h) => h.holeNo === state.currentHole)
  if (!hole) return null

  const complete = isHoleComplete(config, hole)
  const holeStat = settlement.holes.find((h) => h.holeNo === hole.holeNo)
  const skipped = !!holeStat?.skipped || !!hole.skipBetting
  const mult = previewMultiplier(config, state.holes, hole.holeNo)

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
      </header>

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

        <button
          type="button"
          className="btn-secondary"
          onClick={() => config.players.forEach((p) => setStroke(p.id, hole.par))}
        >
          전원 파
        </button>
      </section>

      {config.nearest.enabled && hole.par === 3 && (
        <section className="card">
          <h2>니어리스트</h2>
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${!hole.nearestWinner ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_NEAREST', holeNo: hole.holeNo, playerId: null })}
            >
              없음
            </button>
            {config.players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${hole.nearestWinner === p.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_NEAREST', holeNo: hole.holeNo, playerId: p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {config.longest.enabled && hole.par === 5 && (
        <section className="card">
          <h2>롱기스트</h2>
          <div className="chip-group">
            <button
              type="button"
              className={`chip ${!hole.longestWinner ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'SET_LONGEST', holeNo: hole.holeNo, playerId: null })}
            >
              없음
            </button>
            {config.players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${hole.longestWinner === p.id ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_LONGEST', holeNo: hole.holeNo, playerId: p.id })}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <Toggle
          checked={!!hole.skipBetting}
          onChange={() => dispatch({ type: 'TOGGLE_SKIP', holeNo: hole.holeNo })}
          label="이 홀 내기 제외"
          hint="스코어만 기록하고 정산에서 뺍니다 (배판도 리셋)"
        />
        {config.doubleRule.allowManualCall && !skipped && (
          <Toggle
            checked={!!hole.manualDouble}
            onChange={() => dispatch({ type: 'TOGGLE_MANUAL_DOUBLE', holeNo: hole.holeNo })}
            label="묻고 더블 (수동 배판)"
          />
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
