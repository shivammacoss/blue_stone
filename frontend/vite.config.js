import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Treat .apk as a static asset so we can `import apkUrl from '.../bluestone_apk.apk?url'`
  // — keeps the APK in src/apk/ where the team manages it, while Vite bundles
  // it into dist/ with a hashed URL on build.
  assetsInclude: ['**/*.apk'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/website/src'),
    },
  },
})
