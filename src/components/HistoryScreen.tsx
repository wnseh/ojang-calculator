import { useMemo, useState, type Dispatch } from 'react'
import { isHoleComplete, settle } from '../engine/settlement'
import { buildShareText } from '../engine/share'
import { scoreClass, signWon } from '../format'
import { aggregateTotals, listHistory, removeFromHistory, type HistoryEntry } from '../history'
import type { Action } from '../store'
import { ThemeToggle } from './ThemeToggle'

function EntryCard({
  entry,
  onDelete,
  onEdit,
}: {
  entry: HistoryEntry
  onDelete: (id: string) => void
  onEdit: (entry: HistoryEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const [showMoney, setShowMoney] = useState(false)
  const [copied, setCopied] = useState(false)
  const settlement = useMemo(() => settle(entry.config, entry.holes), [entry])
  const players = entry.config.players
  const playedHoles = entry.holes.filter((h) => isHoleComplete(entry.config, h))
  const place = [entry.club, entry.course].filter(Boolean).join(' · ')
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id
  const totalStrokes = (id: string) => playedHoles.reduce((a, h) => a + (h.strokes[id] ?? 0), 0)

  const copy = async () => {
    const text = buildShareText(
      entry.config,
      entry.holes,
      settlement,
      entry.date,
      entry.memo,
      place || undefined,
    )
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('아래 내용을 복사하세요', text)
    }
  }

  return (
    <section className="card">
      <button
        type="button"
        className="history-head"
        onClick={() => {
          setOpen(!open)
          if (open) setShowMoney(false)
        }}
      >
        <div>
          <b>{entry.date}</b>
          {place && <small className="hint-inline">{place}</small>}
          <small className="hint-inline">
            {playedHoles.length}홀 · {players.map((p) => p.name).join(', ')}
          </small>
        </div>
        <span className="chevron">{open ? '▾' : '▸'}</span>
      </button>

      {/* 기본 표시는 스코어(총타수)만 — 돈은 "오장 결과" 버튼으로 */}
      <div className="net-grid">
        {players.map((p) => (
          <div key={p.id} className="net-cell">
            <span className="net-name">{p.name}</span>
            <span className="score-total">
              {playedHoles.length > 0 ? `${totalStrokes(p.id)}타` : '—'}
            </span>
          </div>
        ))}
      </div>

      {open && (
        <div className="history-detail">
          {playedHoles.length > 0 && (
            <div className="table-scroll">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>홀</th>
                    <th>파</th>
                    {players.map((p) => (
                      <th key={p.id}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {playedHoles.map((h) => (
                    <tr key={h.holeNo} className={h.skipBetting ? 'row-skip' : ''}>
                      <td>{h.holeNo}</td>
                      <td>{h.par}</td>
                      {players.map((p) => (
                        <td key={p.id}>
                          <span className={`cell-score ${scoreClass(h.strokes[p.id], h.par)}`}>
                            {h.strokes[p.id]}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2}>계</td>
                    {players.map((p) => (
                      <td key={p.id}>
                        <span className="cell-score">{totalStrokes(p.id)}</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {entry.memo.trim() && <p className="hint">메모: {entry.memo}</p>}

          <div className="history-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowMoney(!showMoney)}
            >
              {showMoney ? '오장 결과 접기' : '💰 오장 결과'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => onEdit(entry)}>
              수정하기
            </button>
            <button type="button" className="btn-secondary" onClick={copy}>
              {copied ? '✓ 복사됨' : '공유 텍스트 복사'}
            </button>
            <button
              type="button"
              className="btn-secondary btn-delete"
              onClick={() => {
                if (window.confirm(`${entry.date} 라운드 기록을 삭제할까요?`)) onDelete(entry.id)
              }}
            >
              삭제
            </button>
          </div>

          {showMoney && (
            <div className="money-block">
              <h3>오장 결과</h3>
              <div className="net-grid">
                {players.map((p) => {
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
              {settlement.minimalTransfers.length > 0 && (
                <ul className="transfer-list">
                  {settlement.minimalTransfers.map((t, i) => (
                    <li key={i}>
                      <b>{name(t.from)}</b> → <b>{name(t.to)}</b>
                      <span className="transfer-amount">{t.amount.toLocaleString('ko-KR')}원</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function HistoryScreen({
  dispatch,
  hasActiveRound,
}: {
  dispatch: Dispatch<Action>
  hasActiveRound: boolean
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>(listHistory)
  const [totalsOpen, setTotalsOpen] = useState(false)
  const totals = useMemo(() => aggregateTotals(entries), [entries])

  const editEntry = (entry: HistoryEntry) => {
    if (
      hasActiveRound &&
      !window.confirm('진행 중인 라운드가 있습니다. 지우고 이 기록을 열까요?')
    )
      return
    dispatch({
      type: 'RESUME_ROUND',
      config: entry.config,
      holes: entry.holes,
      memo: entry.memo,
      startedAt: entry.date,
      historyId: entry.id,
      club: entry.club ?? '',
      course: entry.course ?? '',
    })
  }

  return (
    <div className="screen">
      <header className="app-header">
        <h1>지난 라운드</h1>
        <button
          type="button"
          className="btn-secondary header-btn"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: hasActiveRound ? 'play' : 'setup' })}
        >
          {hasActiveRound ? '← 라운드로' : '← 새 라운드'}
        </button>
        <ThemeToggle />
      </header>

      {entries.length === 0 ? (
        <section className="card">
          <p className="hint">
            아직 저장된 라운드가 없습니다. 정산표 화면에서 "라운드 종료"를 누르면 이곳에
            보관됩니다.
          </p>
        </section>
      ) : (
        <>
          {totals.length > 0 && (
            <section className="card">
              <button
                type="button"
                className="history-head"
                onClick={() => setTotalsOpen(!totalsOpen)}
              >
                <div>
                  <b>누적 전적</b>
                  <small className="hint-inline">{entries.length}라운드 · 이름 기준</small>
                </div>
                <span className="chevron">{totalsOpen ? '▾' : '▸'}</span>
              </button>
              {totalsOpen && (
                <>
                  <ul className="transfer-list">
                    {totals.map((t) => (
                      <li key={t.name}>
                        <b>{t.name}</b>
                        <small className="hint-inline">{t.rounds}회</small>
                        <span
                          className={`transfer-amount ${t.total > 0 ? 'plus' : t.total < 0 ? 'minus' : ''}`}
                        >
                          {signWon(t.total)}원
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="hint">
                    같은 이름은 같은 사람으로 집계합니다. 이 기기에만 저장된 기록입니다.
                  </p>
                </>
              )}
            </section>
          )}
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onDelete={(id) => setEntries(removeFromHistory(id))}
              onEdit={editEntry}
            />
          ))}
        </>
      )}
    </div>
  )
}
