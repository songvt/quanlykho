import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'development' && basicSsl()].filter(Boolean),
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', '@reduxjs/toolkit', 'react-redux'],
          'ui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'xlsx': ['xlsx'],
          'exceljs': ['exceljs'],
          'common-utils': ['file-saver', 'html5-qrcode']
        }
      }
    }
  }
}))
