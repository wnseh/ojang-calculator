import { useState } from 'react'
import { applyTheme, currentTheme, type Theme } from '../theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
