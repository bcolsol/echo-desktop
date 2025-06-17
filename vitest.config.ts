import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    root: __dirname,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    testTimeout: 1000 * 29,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})
