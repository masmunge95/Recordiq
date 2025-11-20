import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://semigeometric-astoundedly-myrtis.ngrok-free.dev', // IMPORTANT: Use your ngrok URL here
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://semigeometric-astoundedly-myrtis.ngrok-free.dev', // IMPORTANT: Use your ngrok URL here
        changeOrigin: true,
      },
    },
  },
})
