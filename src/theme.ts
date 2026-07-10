export type Theme = 'light' | 'dark'

const THEME_KEY = 'ojang-theme'

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 저장 실패는 무시
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#161513' : '#14532d')
}

/** 저장된 테마 → 없으면 시스템 설정 따라감. 렌더 전에 호출해 플래시 방지 */
export function initTheme(): Theme {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(THEME_KEY)
  } catch {
    // 접근 실패 시 시스템 설정 사용
  }
  const theme: Theme =
    stored === 'dark' || stored === 'light'
      ? stored
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  applyTheme(theme)
  return theme
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
