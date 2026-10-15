// The corner map, top right beside the clock: the land round the hero as the map draws it (view/atlas/mapPaint.ts),
// the hero at its middle, turned as the game's view is (its compass for north), the villages' names small; pins off its
// edge held at its rim, so each points the way to its goal on the screen. Its own chunk charted at once if no chart's come
// (never blank as a game starts). Drawn ten times a second at most; clicked, the whole map. On or off from the map
// window, kept in the browser between visits.

import './minimap.css';
import type { GameModel } from '../../model/GameModel';
import { mapPins } from '../../model/atlas/mapPins';
import { paintMap } from '../atlas/mapPaint';
import { CHUNK } from '../../model/atlas/fog';

const SIZE = 150; // CSS pixels a side
const SCALE = 1.75; // pixels a tile (some 85 tiles across: a fresh hero's land seen, most of it)
const EVERY = 100; // milliseconds between drawings
const STORE = 'evenhold.minimap';

export function createMinimap(model: GameModel): { update(): void; on: boolean; toggle(): void; click: (() => void) | null } {
  const root = document.createElement('div');
  root.className = 'minimap';
  const canvas = document.createElement('canvas');
  root.append(canvas);
  document.body.append(root);
  root.addEventListener('click', () => api.click?.());
  let on = true;
  try {
    on = localStorage.getItem(STORE) !== 'off';
  } catch {
    // (no storage: on, this visit)
  }
  let last = 0;
  const api = {
    click: null as (() => void) | null, // (the map window's: open it)
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      try {
        localStorage.setItem(STORE, on ? 'on' : 'off');
      } catch {
        // (kept for this visit only)
      }
    },
    update() {
      root.hidden = !on;
      const now = performance.now();
      if (!on || now - last < EVERY) return;
      last = now;
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(SIZE * ratio)) canvas.width = canvas.height = Math.round(SIZE * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const at = model.inside?.entrance ?? model.hero;
      model.atlas.chartNow(Math.floor(at.x / CHUNK), Math.floor(at.z / CHUNK));
      paintMap(ctx, model, { x: at.x, z: at.z, scale: SCALE }, SIZE, SIZE, { names: true, namePx: 9, pins: mapPins(model), places: model.atlas.places() });
    },
  };
  return api;
}
