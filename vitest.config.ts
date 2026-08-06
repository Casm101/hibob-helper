import { defineConfig } from 'vitest/config'

// Separate from the extension build configs (vite.config.ts / vite.content.config.ts)
// which define multi-entry Chrome-extension bundles. Tests default to jsdom so
// selector-resolution helpers can run against DOM fixtures.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
