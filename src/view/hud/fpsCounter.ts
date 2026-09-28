// On-screen performance readout: frames per second, plus the last frame's
// draw calls, triangles and render resolution. The game loop reports each
// frame it runs (so an uncapped loop is measured, not the display refresh),
// and the label refreshes twice a second so the numbers are readable.

import type { RenderStats } from '../GameView';

const REFRESH_SECONDS = 0.5;

// Returns the function to call once per rendered frame.
export function createFpsCounter(label: HTMLElement, stats: () => RenderStats): () => void {
  let frames = 0;
  let windowStart = performance.now();
  return () => {
    frames++;
    const now = performance.now();
    const elapsed = (now - windowStart) / 1000;
    if (elapsed < REFRESH_SECONDS) return;
    const { drawCalls, triangles, pixelRatio } = stats();
    label.textContent =
      `fps: ${Math.round(frames / elapsed)} · ${drawCalls} draws · ` +
      `${(triangles / 1e6).toFixed(2)}M tris · ${pixelRatio}x res`;
    frames = 0;
    windowStart = now;
  };
}
