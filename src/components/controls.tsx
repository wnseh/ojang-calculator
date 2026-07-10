import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="row-control">{children}</div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MoneyInput({
  value,
  onChange,
  step = 1000,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div className="money-input">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <span>원</span>
    </div>
  )
}
