import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' — GitHub Pages 등 서브경로 배포에서도 동작하도록 상대 경로 사용
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '오장 내기 정산 계산기',
        short_name: '오장',
        description: '골프 오장 내기 자동 정산',
        lang: 'ko',
        theme_color: '#14532d',
        background_color: '#f6f5f1',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
