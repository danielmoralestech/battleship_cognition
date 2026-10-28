/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from /<repo-name>/
export default defineConfig({
  base: '/battleship_cognition/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
