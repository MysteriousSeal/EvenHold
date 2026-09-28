// How close the camera sits: a few set levels, picked in the pause menu or
// with the mouse wheel, remembered in the browser for next time. Kept to
// what the streamed-in world covers: the farthest never shows its edge.

export const ZOOM_LEVELS = [
  { name: 'Far', zoom: 0.8 },
  { name: 'Wide', zoom: 0.9 },
  { name: 'Normal', zoom: 1 },
  { name: 'Close', zoom: 1.25 },
  { name: 'Closest', zoom: 1.6 },
] as const;

const KEY = 'evenhold.zoom';
const NORMAL = 2;

// Stored per browser; unreadable (a private window, blocked storage) is just Normal.
function load(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw === null ? NaN : Number(raw);
    return Number.isInteger(saved) && saved >= 0 && saved < ZOOM_LEVELS.length ? saved : NORMAL;
  } catch {
    return NORMAL;
  }
}

let level = load();

export function zoomLevel(): (typeof ZOOM_LEVELS)[number] {
  return ZOOM_LEVELS[level];
}

// Steps closer (+1) or farther (-1), stopping at the ends, or going round
// from the closest back to the farthest when `wrap`.
export function stepZoom(step: number, wrap = false): void {
  const next = level + step;
  level = wrap ? (next + ZOOM_LEVELS.length) % ZOOM_LEVELS.length : Math.max(0, Math.min(ZOOM_LEVELS.length - 1, next));
  try {
    localStorage.setItem(KEY, String(level));
  } catch {
    // not remembered, then
  }
}
