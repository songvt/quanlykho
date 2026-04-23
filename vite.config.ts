import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(), 
    mode === 'development' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Quản Lý Kho GGS',
        short_name: 'QL Kho',
        description: 'Hệ thống Quản lý Kho GGS',
        theme_color: '#0b3d2b',
        background_color: '#f1f5f9',
        display: 'standalone',
        icons: []
      }
    })
  ].filter(Boolean),
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
          'exceljs': ['exceljs'],
          'common-utils': ['file-saver', 'html5-qrcode']
        }
      }
    }
  }
}))
