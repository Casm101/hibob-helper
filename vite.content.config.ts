import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// The content script is injected as a classic script (both via the manifest's
// content_scripts entry and chrome.scripting.executeScript files:), so it must
// be a single self-contained file with no ESM imports of sibling chunks.
// Building it as its own single-entry bundle inlines all its static imports.
// This runs after the main build (popup + background) with emptyOutDir: false
// so it only adds contentScript.js to dist/.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        contentScript: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: 'contentScript.js',
        inlineDynamicImports: true,
      },
    },
  },
})
