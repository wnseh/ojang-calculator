import { useMemo, useRef, useState, type Dispatch } from 'react'
import { isHoleComplete, settle } from '../engine/settlement'
import { buildShareText } from '../engine/share'
import { scoreClass, signWon } from '../format'
import {
  aggregateTotals,
  buildExportPayload,
  importHistory,
  listHistory,
  removeFromHistory,
  type HistoryEntry,
} from '../history'
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
          {(entry.localRules?.length ?? 0) > 0 && (
            <ul className="rules-view small">
              {entry.localRules!.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

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
  const [backupMsg, setBackupMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const totals = useMemo(() => aggregateTotals(entries), [entries])

  const doExport = () => {
    const today = new Date().toISOString().slice(0, 10)
    const payload = buildExportPayload(new Date().toISOString())
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ojang-backup-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupMsg(`${payload.entries.length}개 라운드를 파일로 내보냈습니다.`)
  }

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      const result = importHistory(json)
      setEntries(result.entries)
      setBackupMsg(
        `${result.imported}개 라운드를 가져왔습니다.` +
          (result.skipped > 0 ? ` (이미 있는 ${result.skipped}개는 제외)` : ''),
      )
    } catch {
      setBackupMsg('가져오기 실패 — 올바른 오장 백업 파일이 아닙니다.')
    }
  }

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
      localRules: entry.localRules ?? [],
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

      <section className="card">
        <h2>백업 / 기기 이전</h2>
        <div className="history-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={entries.length === 0}
            onClick={doExport}
          >
            📤 내보내기 (JSON)
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            📥 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={onImportFile}
          />
        </div>
        {backupMsg && <p className="hint">{backupMsg}</p>}
        <p className="hint">
          내보낸 파일을 카톡 "나에게 보내기" 등으로 보관해두면 폰을 바꾸거나 주소가 바뀌어도
          가져오기로 복원할 수 있습니다. 가져오기는 기존 기록에 합쳐지며 같은 라운드는 중복
          저장되지 않습니다.
        </p>
      </section>
    </div>
  )
}
