// On-screen performance readout: frames per second, plus the last frame's
// draw calls, triangles and render resolution, and how fast the hero's going
// (meters a second, two to a tile). The game loop reports each
// frame it runs (so an uncapped loop is measured, not the display refresh),
// and the label refreshes twice a second so the numbers are readable.

import type { RenderStats } from '../GameView';

const REFRESH_SECONDS = 0.5;
const METERS_PER_TILE = 2;
const JUMP = 2; // tiles moved in one frame that are a jump (a door, a teleport), not a step

// Returns the function to call once per rendered frame.
export function createFpsCounter(label: HTMLElement, stats: () => RenderStats, hero: { x: number; z: number }): () => void {
  let frames = 0;
  let windowStart = performance.now();
  let walked = 0; // tiles, this refresh
  let last = { x: hero.x, z: hero.z };
  return () => {
    frames++;
    const step = Math.hypot(hero.x - last.x, hero.z - last.z);
    if (step < JUMP) walked += step;
    last = { x: hero.x, z: hero.z };
    const now = performance.now();
    const elapsed = (now - windowStart) / 1000;
    if (elapsed < REFRESH_SECONDS) return;
    const { drawCalls, triangles, pixelRatio } = stats();
    label.textContent =
      `fps: ${Math.round(frames / elapsed)} · ${drawCalls} draws · ` +
      `${(triangles / 1e6).toFixed(2)}M tris · ${pixelRatio}x res · ` +
      `${((walked * METERS_PER_TILE) / elapsed).toFixed(1)} m/s`;
    frames = 0;
    walked = 0;
    windowStart = now;
  };
}
