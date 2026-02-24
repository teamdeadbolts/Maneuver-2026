import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // same as "--host" flag
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.io',
    ],
  },
  resolve: {
    alias: {
      "@/core": path.resolve(__dirname, "./src/core"),
      "@/game": path.resolve(__dirname, "./src/game-template"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
