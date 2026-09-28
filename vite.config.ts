import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // three.js is most of the bundle and changes far less often than game
        // code, so ship it as its own chunk: smaller app chunk, better caching.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
