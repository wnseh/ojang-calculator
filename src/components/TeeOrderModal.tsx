import { useEffect, useState } from 'react'
import type { Player } from '../engine/types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function TeeOrderModal({
  players,
  onApply,
  onClose,
}: {
  players: Player[]
  onApply: (orderIds: string[]) => void
  onClose: () => void
}) {
  const [order, setOrder] = useState<Player[]>(players)
  const [rolling, setRolling] = useState(true)
  const [round, setRound] = useState(0) // 다시 뽑기 시 증가 → 애니메이션 재시작

  useEffect(() => {
    setRolling(true)
    const iv = setInterval(() => setOrder((o) => shuffle(o)), 110)
    const to = setTimeout(() => {
      clearInterval(iv)
      setOrder((o) => shuffle(o))
      setRolling(false)
    }, 2300)
    return () => {
      clearInterval(iv)
      clearTimeout(to)
    }
  }, [round])

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <div className="modal-title">
          {rolling ? <span className="drumroll">🥁 두구두구두구두구...</span> : '⛳ 첫 티샷 순서입니다!'}
        </div>
        <ul className={`tee-list ${rolling ? 'rolling' : 'settled'}`} key={rolling ? 'r' : `s${round}`}>
          {order.map((p, i) => (
            <li key={p.id}>
              <span className="tee-rank">{i + 1}</span>
              {p.name}
              {!rolling && i === 0 && ' 🏌️'}
            </li>
          ))}
        </ul>
        {!rolling && (
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setRound((r) => r + 1)}>
              🎲 다시
            </button>
            <button type="button" className="btn-primary" onClick={() => onApply(order.map((p) => p.id))}>
              이 순서로 시작!
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
