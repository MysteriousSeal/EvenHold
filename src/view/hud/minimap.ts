// The corner map, top right beside the clock: the land round the hero as the map draws it (view/atlas/mapPaint.ts),
// the hero at its middle, north up (a little N over its top), no names; pins off its edge held at the edge, so each
// points the way to its goal. Drawn ten times a second at most. On or off from the map window, kept in the browser
// between visits.

import './minimap.css';
import type { GameModel } from '../../model/GameModel';
import { mapPins } from '../../model/atlas/mapPins';
import { paintMap } from '../atlas/mapPaint';

const SIZE = 150; // CSS pixels a side
const SCALE = 1.1; // pixels a tile
const EVERY = 100; // milliseconds between drawings
const STORE = 'evenhold.minimap';

export function createMinimap(model: GameModel): { update(): void; on: boolean; toggle(): void } {
  const root = document.createElement('div');
  root.className = 'minimap';
  const canvas = document.createElement('canvas');
  const north = document.createElement('b');
  north.textContent = 'N';
  root.append(canvas, north);
  document.body.append(root);
  let on = true;
  try {
    on = localStorage.getItem(STORE) !== 'off';
  } catch {
    // (no storage: on, this visit)
  }
  let last = 0;
  const api = {
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
      paintMap(ctx, model, { x: at.x, z: at.z, scale: SCALE }, SIZE, SIZE, { names: false, pins: mapPins(model), places: model.atlas.places() });
    },
  };
  return api;
}
