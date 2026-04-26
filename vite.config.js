import { defineConfig } from 'vite'

export default defineConfig({
  // VITE_BASE_URL is injected by the GitHub Pages workflow (actions/configure-pages).
  // Locally it is undefined, so the app is served from the root.
  base: process.env.VITE_BASE_URL ?? '/',

  server: {
    port: 5174,
    strictPort: true,
  },

  test: {
    environment: 'node',
    include: ['js/**/*.test.js'],
  },
})
