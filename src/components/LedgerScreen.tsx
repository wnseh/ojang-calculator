import { useState, type Dispatch } from 'react'
import { isHoleComplete } from '../engine/settlement'
import { buildShareText } from '../engine/share'
import type { Settlement } from '../engine/types'
import { scoreClass, signWon } from '../format'
import { addToHistory, updateInHistory } from '../history'
import type { Action, AppState } from '../store'
import { ThemeToggle } from './ThemeToggle'

export function LedgerScreen({
  state,
  dispatch,
  settlement,
}: {
  state: AppState
  dispatch: Dispatch<Action>
  settlement: Settlement
}) {
  const config = state.config!
  const [copied, setCopied] = useState(false)
  const playedHoles = state.holes.filter((h) => isHoleComplete(config, h))
  const name = (id: string) => config.players.find((p) => p.id === id)?.name ?? id

  const place = [state.club, state.course].filter(Boolean).join(' · ')

  const copyShareText = async () => {
    const text = buildShareText(
      config,
      state.holes,
      settlement,
      state.startedAt ?? new Date().toISOString().slice(0, 10),
      state.memo,
      place || undefined,
    )
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API 실패 시(비HTTPS 등) 텍스트 선택 방식으로 폴백
      window.prompt('아래 내용을 복사하세요', text)
    }
  }

  const editing = state.editingHistoryId != null

  const newRound = () => {
    const msg = editing
      ? '수정을 취소할까요? 원본 기록은 그대로 유지됩니다.'
      : '현재 라운드를 저장하지 않고 지우고 새 라운드를 시작할까요?'
    if (window.confirm(msg)) {
      dispatch({ type: 'NEW_ROUND' })
    }
  }

  const finishRound = () => {
    if (playedHoles.length === 0) {
      window.alert('입력된 홀이 없어 저장할 내용이 없습니다.')
      return
    }
    const msg = editing
      ? '수정한 내용을 원래 라운드 기록에 저장할까요?'
      : '라운드를 종료하고 지난 라운드에 보관할까요?'
    if (!window.confirm(msg)) return
    const entry = {
      id: state.editingHistoryId ?? `${Date.now()}`,
      date: state.startedAt ?? new Date().toISOString().slice(0, 10),
      config,
      holes: state.holes,
      memo: state.memo,
      club: state.club,
      course: state.course,
    }
    if (editing) updateInHistory(entry)
    else addToHistory(entry)
    dispatch({ type: 'FINISH_ROUND' })
  }

  return (
    <div className="screen">
      <header className="app-header">
        <h1>정산표</h1>
        <button
          type="button"
          className="btn-secondary header-btn"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'play' })}
        >
          ← 홀 입력
        </button>
        <ThemeToggle />
        {place && <span className="subtitle">{place}</span>}
      </header>

      {settlement.warnings.map((w) => (
        <div className="warning-banner" key={w}>
          ⚠️ {w}
        </div>
      ))}

      <section className="card">
        <h2>최종 손익</h2>
        <div className="net-grid big">
          {config.players.map((p) => {
            const v = settlement.netByPlayer[p.id] ?? 0
            return (
              <div key={p.id} className="net-cell">
                <span className="net-name">{p.name}</span>
                <span className={`net-value ${v > 0 ? 'plus' : v < 0 ? 'minus' : ''}`}>
                  {signWon(v)}원
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2>송금 (최소 횟수)</h2>
        {settlement.minimalTransfers.length === 0 ? (
          <p className="hint">주고받을 돈이 없습니다.</p>
        ) : (
          <ul className="transfer-list">
            {settlement.minimalTransfers.map((t, i) => (
              <li key={i}>
                <b>{name(t.from)}</b> → <b>{name(t.to)}</b>
                <span className="transfer-amount">{t.amount.toLocaleString('ko-KR')}원</span>
              </li>
            ))}
          </ul>
        )}
        {settlement.handicapTransfers.length > 0 && (
          <p className="hint">
            핸디 포함:{' '}
            {settlement.handicapTransfers
              .map((t) => `${name(t.from)}→${name(t.to)} ${t.amount.toLocaleString('ko-KR')}원`)
              .join(', ')}
          </p>
        )}
        <button type="button" className="btn-primary" onClick={copyShareText}>
          {copied ? '✓ 복사됨' : '공유 텍스트 복사'}
        </button>
      </section>

      <section className="card">
        <h2>홀별 기록</h2>
        {playedHoles.length === 0 ? (
          <p className="hint">아직 입력된 홀이 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>홀</th>
                  <th>파</th>
                  {config.players.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                  <th>배수</th>
                </tr>
              </thead>
              <tbody>
                {playedHoles.map((h) => {
                  const hs = settlement.holes.find((s) => s.holeNo === h.holeNo)
                  return (
                    <tr key={h.holeNo} className={hs?.skipped ? 'row-skip' : ''}>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => {
                            dispatch({ type: 'GO_HOLE', holeNo: h.holeNo })
                            dispatch({ type: 'SET_SCREEN', screen: 'play' })
                          }}
                        >
                          {h.holeNo}
                        </button>
                      </td>
                      <td>{h.par}</td>
                      {config.players.map((p) => {
                        const s = h.strokes[p.id]
                        const net = hs?.netByPlayer[p.id] ?? 0
                        return (
                          <td key={p.id}>
                            <span className={`cell-score ${scoreClass(s, h.par)}`}>{s}</span>
                            {!hs?.skipped && net !== 0 && (
                              <span className={`cell-net ${net > 0 ? 'plus' : 'minus'}`}>
                                {signWon(net / 1000)}k
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td>
                        {hs?.skipped ? (
                          <span className="badge badge-skip">제외</span>
                        ) : hs && hs.multiplier > 1 ? (
                          <span className="badge badge-double">×{hs.multiplier}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>뒷정산 메모</h2>
        <textarea
          className="memo-input"
          placeholder="예) 캐디피는 1등이, 밥값은 2등이"
          value={state.memo}
          onChange={(e) => dispatch({ type: 'SET_MEMO', memo: e.target.value })}
        />
      </section>

      <button type="button" className="btn-primary btn-finish" onClick={finishRound}>
        {editing ? '수정 완료 · 기록 갱신' : '라운드 종료 · 지난 라운드에 저장'}
      </button>
      <button type="button" className="btn-danger" onClick={newRound}>
        {editing ? '수정 취소 (원본 유지)' : '저장 없이 새 라운드 (기록 삭제)'}
      </button>
    </div>
  )
}
