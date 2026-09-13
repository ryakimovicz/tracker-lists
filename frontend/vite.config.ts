import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Trigger Vite full server restart (v0.9.7)
export default defineConfig({
  plugins: [react()],
})
