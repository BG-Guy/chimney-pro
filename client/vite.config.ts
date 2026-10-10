import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/chimney-pro/',
  // The PDF worker (src/pdfWorker.ts) is an ES module — pdf.js's worker is one.
  worker: { format: 'es' },
})
