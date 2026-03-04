import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext" // ⭐️ Vercel 빌드 에러를 완벽하게 막아주는 핵심 줄입니다!
  }
})