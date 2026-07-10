import { useRef, useState } from 'react'
import type { Player } from '../engine/types'

const ROW_HEIGHT = 62 // .order-item 높이 56 + 간격 6 — CSS와 맞춰야 함

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr]
  const [item] = a.splice(from, 1)
  a.splice(to, 0, item)
  return a
}

/** 라운드 중 플레이어 순서를 드래그로 바꾸는 시트 */
export function OrderSheet({
  players,
  onApply,
  onClose,
}: {
  players: Player[]
  onApply: (orderIds: string[]) => void
  onClose: () => void
}) {
  const [order, setOrder] = useState<Player[]>(players)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const onPointerDown = (e: React.PointerEvent, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragIdx(idx)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdx == null || !listRef.current) return
    const rect = listRef.current.getBoundingClientRect()
    const target = Math.min(
      order.length - 1,
      Math.max(0, Math.floor((e.clientY - rect.top) / ROW_HEIGHT)),
    )
    if (target !== dragIdx) {
      setOrder((o) => move(o, dragIdx, target))
      setDragIdx(target)
    }
  }

  const onPointerUp = () => setDragIdx(null)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">플레이어 순서 변경</div>
        <ul className="order-list" ref={listRef}>
          {order.map((p, i) => (
            <li
              key={p.id}
              className={`order-item ${dragIdx === i ? 'dragging' : ''}`}
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <span className="drag-handle">⠿</span>
              {p.name}
              <span className="order-rank">{i + 1}번</span>
            </li>
          ))}
        </ul>
        <p className="hint">이름을 누른 채 위아래로 끌어서 순서를 바꾸세요. 정산에는 영향 없습니다.</p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onApply(order.map((p) => p.id))
              onClose()
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
