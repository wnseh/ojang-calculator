export const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`

export const signWon = (n: number) =>
  n > 0 ? `+${n.toLocaleString('ko-KR')}` : n.toLocaleString('ko-KR')

export function scoreLabel(strokes: number, par: number): string {
  if (strokes === 1) return '홀인원'
  if (strokes >= par * 2) return '양파'
  const d = strokes - par
  if (d <= -3) return '알바트로스'
  if (d === -2) return '이글'
  if (d === -1) return '버디'
  if (d === 0) return '파'
  if (d === 1) return '보기'
  if (d === 2) return '더블'
  if (d === 3) return '트리플'
  return `+${d}`
}

/** 스코어 색상 클래스: 언더파/파/오버파/대량 실점 */
export function scoreClass(strokes: number, par: number): string {
  const d = strokes - par
  if (d < 0) return 'sc-under'
  if (d === 0) return 'sc-even'
  if (d <= 2) return 'sc-over'
  return 'sc-big'
}
