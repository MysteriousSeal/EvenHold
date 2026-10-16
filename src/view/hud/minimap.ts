// The corner map, top right beside the clock: the land round the hero as the map draws it (view/atlas/mapPaint.ts),
// the hero ringed at its very middle, turned as the game's view is (north's arrow on its frame), the roads, the places'
// marks, the villages' names small, the foes near (red dots), the gold "!" and "?" of quests to give and take; pins off
// its edge held at its rim, so each points the way to its goal on the screen. Its own chunk charted at once if no chart's come
// (never blank as a game starts). Drawn ten times a second at most; clicked, the whole map. On or off from the map
// window, kept in the browser between visits.

import './minimap.css';
import type { GameModel } from '../../model/GameModel';
import { mapPins } from '../../model/atlas/mapPins';
import { paintMap } from '../atlas/mapPaint';
import { CHUNK } from '../../model/atlas/fog';
import { noticeBoards } from '../../model/quests/noticeBoards';
import { boardNumber } from '../../model/quests/quests';
import { CAMERA_YAW } from '../constants';
import type { Corner } from '../atlas/mapPaint';

const SIZE = 150; // CSS pixels a side
const SCALE = 1.75; // pixels a tile (some 85 tiles across: a fresh hero's land seen, most of it)
const EVERY = 100; // milliseconds between drawings
const STORE = 'evenhold.minimap';

export function createMinimap(model: GameModel): { update(): void; on: boolean; toggle(): void; click: (() => void) | null } {
  const root = document.createElement('div');
  root.className = 'minimap';
  const canvas = document.createElement('canvas');
  const north = document.createElement('span');
  north.className = 'minimap-north';
  north.innerHTML = `<i style="rotate: ${CAMERA_YAW}rad">➜</i>N`; // (north, on the screen: up turned by the camera)
  root.append(canvas, north);
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
      const hud = parseFloat(getComputedStyle(root).getPropertyValue('--hud-scale')) || 1; // (the HUD's scale: drawn at it, not stretched to it)
      const ratio = Math.max(1, window.devicePixelRatio || 1) * hud;
      const px = Math.round(SIZE * ratio);
      if (canvas.width !== px || canvas.height !== px) [canvas.width, canvas.height] = [px, px]; // (a new canvas is 300 by 150: both set)
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const at = model.inside?.entrance ?? model.hero;
      model.atlas.chartNow(Math.floor(at.x / CHUNK), Math.floor(at.z / CHUNK));
      const paint = { names: true, namePx: 9, mark: 0.6, pins: mapPins(model), places: model.atlas.places(), landmarks: model.atlas.landmarks(), corner: near(model) };
      paintMap(ctx, model, { x: at.x, z: at.z, scale: SCALE }, SIZE, SIZE, paint);
    },
  };
  return api;
}

// The foes alive out on the land, and the marks of quests: over each who has one to give or take, and over each notice
// board with one (questMarks.ts, as the game shows them).
function near(model: GameModel): Corner {
  const foes = model.enemies.filter((e) => e.hp > 0);
  const asks: Corner['asks'][number][] = model.story.asking.map(({ who, mark }) => {
    const at = 'where' in who && who.where ? who.where : who; // (one indoors: at their door)
    return { x: at.x, z: at.z, mark };
  });
  for (const [i, spot] of noticeBoards(model).entries()) {
    const board = boardNumber(model, i);
    if (model.quests.readyAt(board)) asks.push({ x: spot.x, z: spot.z, mark: 'ready' });
    else if (model.quests.available(board)) asks.push({ x: spot.x, z: spot.z, mark: 'offer' });
  }
  const at = new Map<string, Corner['asks'][number]>(); // (one mark a spot, a gold "?" over a "!" over a grey "?": a village's folk at one door)
  const rank = { ready: 2, offer: 1, waiting: 0 };
  for (const ask of asks) {
    const key = `${Math.round(ask.x / 3)},${Math.round(ask.z / 3)}`;
    const was = at.get(key);
    if (!was || rank[ask.mark] > rank[was.mark]) at.set(key, ask);
  }
  return { foes, asks: [...at.values()] };
}
