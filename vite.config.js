import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext" // Vercel 빌드 시 import.meta 에러를 방지하는 핵심 설정!
  }
})