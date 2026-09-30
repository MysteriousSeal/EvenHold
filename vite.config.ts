import { defineConfig } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';

// The fingerprint of the code that makes worlds, worked out at build time for
// the built game (controller/storage/worldCache.ts works it out live while developing).
// The same files, the same way.
const MAKERS = ['src/model/worldgen', 'src/model/ruins', 'src/model/camps']
  .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`))
  .concat(['src/model/constants.ts', 'src/model/map/grid.ts', 'src/util/random.ts']);
export function worldVersion(): string {
  const text = MAKERS.map((path) => ({ key: path.replace(/^src\/(model|util)\//, (_, dir) => (dir === 'util' ? '../../util/' : '../../model/')), path }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ key, path }) => `${key}\n${readFileSync(path, 'utf8')}`)
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

export default defineConfig({
  define: { __WORLD_VERSION__: JSON.stringify(worldVersion()) },
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
