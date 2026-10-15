// The map drawn (the M window: controller/atlas/mapWindow.ts; the corner map: view/hud/minimap.ts), as a parchment
// map is inked: blank vellum where the hero's never been; where they have, the country washed in (meadow, woods,
// heath, marsh, hills, water, fields: model/atlas/chart.ts), the higher ground paler; the roads in red-brown ink; each
// village a little house and its name; the places come upon (a crypt's cross, a cave's arch, a stronghold's tower, a
// camp's tent), struck through once cleared; pins for what's to be done; the hero a red arrowhead. Each chunk's wash
// painted once (a pixel a cell) and kept, painted again only once more of it's been seen or its chart's come.

import type { GameModel } from '../../model/GameModel';
import { CHART_CELL, CHART_CELLS, groundOf, heightOf, type Chart, type Ground } from '../../model/atlas/chart';
import { CELL, CHUNK } from '../../model/atlas/fog';
import type { MapPin, Place } from '../../model/atlas/atlas';
import { villageName } from '../../model/villages/villageNames';
import { difficulty, zoneLevel, type Difficulty } from '../../model/enemies/enemyLevels';
import { spawnOf } from '../../model/map/grid';

// Where the map's looking: the tile at its middle, and how many pixels a tile.
export interface MapLook {
  x: number;
  z: number;
  scale: number;
}

export const INK = '#2e1f14';
export const VELLUM = '#ecdcb4'; // where nothing's been seen
const ROAD = '#8a3d22';
const NAME = '#3a2416';
const DANGER_INK: Record<Difficulty, string> = { trivial: '#8a8478', even: NAME, tough: '#a07810', hard: '#c0581a', deadly: '#b02a24' }; // (a village's level, as the game's dangers are inked: darker, on parchment)
const WASH: Record<Ground, [number, number, number]> = {
  none: [236, 220, 180],
  meadow: [203, 199, 134],
  forest: [122, 140, 84],
  heath: [178, 150, 132],
  marsh: [140, 158, 118],
  hills: [184, 160, 120],
  water: [136, 172, 170],
  field: [218, 192, 118],
  square: [186, 136, 92],
};
const SHORE: [number, number, number] = [96, 136, 140]; // water at its edge
const UNCHARTED: [number, number, number] = [222, 206, 166]; // seen, its chart still coming
const PIN_INK: Record<MapPin['kind'], string> = { quest: '#e8b030', story: '#3dbdb8', bounty: '#b02a24', board: '#ffd98a', purse: '#ffd35a' };

// The picture the washes in view are laid out on (one a model, as large as asked).
const sheets = new WeakMap<GameModel, HTMLCanvasElement>();
function sheetOf(model: GameModel, width: number, height: number): HTMLCanvasElement {
  const sheet = sheets.get(model) ?? document.createElement('canvas');
  sheets.set(model, sheet);
  if (sheet.width !== width || sheet.height !== height) [sheet.width, sheet.height] = [width, height];
  return sheet;
}

interface Wash {
  canvas: HTMLCanvasElement;
  seen: number; // the fog's version painted
  charted: boolean;
}
const washes = new WeakMap<GameModel, Map<number, Wash>>();

// Chunk (cx, cz)'s wash (a pixel a cell; transparent where unseen), painted again if more's been seen or its chart's come.
function washOf(model: GameModel, cx: number, cz: number, chart: Chart | null): HTMLCanvasElement | null {
  const { fog } = model.atlas;
  const bits = fog.bits(cx, cz);
  if (!bits) return null;
  let kept = washes.get(model);
  if (!kept) washes.set(model, (kept = new Map()));
  const n = fog.chunkOf(cx, cz);
  const was = kept.get(n);
  if (was && was.seen === fog.version(cx, cz) && was.charted === !!chart) return was.canvas;
  const canvas = was?.canvas ?? document.createElement('canvas');
  canvas.width = canvas.height = CHART_CELLS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(CHART_CELLS, CHART_CELLS);
  const per = CELL / CHART_CELL; // chart cells to a fog cell's side
  const fogCells = CHUNK / CELL;
  for (let i = 0; i < CHART_CELLS; i++) {
    for (let k = 0; k < CHART_CELLS; k++) {
      const f = Math.floor(i / per) * fogCells + Math.floor(k / per);
      if (!(bits[f >> 3] & (1 << (f & 7)))) continue;
      const cell = chart?.cells[i * CHART_CELLS + k] ?? 0;
      const ground = chart ? settled(chart, i, k) : 'none';
      let rgb = chart ? WASH[ground] : UNCHARTED;
      if (chart && ground === 'water' && shore(chart, i, k)) rgb = SHORE;
      const lift = chart && ground !== 'water' ? 0.9 + 0.05 * heightOf(cell) : 1; // (higher, paler)
      const p = (k * CHART_CELLS + i) * 4; // (x across, z down)
      image.data[p] = Math.min(255, rgb[0] * lift);
      image.data[p + 1] = Math.min(255, rgb[1] * lift);
      image.data[p + 2] = Math.min(255, rgb[2] * lift);
      image.data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  kept.set(n, { canvas, seen: fog.version(cx, cz), charted: !!chart });
  return canvas;
}

// A cell's ground as washed in: water, fields and a square as they are; the country, the kind most of the 3 x 3 round
// it are (the country's borders are dithered tile by tile: inked, they'd speckle).
const COUNTRY: readonly Ground[] = ['meadow', 'forest', 'heath', 'marsh', 'hills'];
const tally = new Uint8Array(16);
function settled(chart: Chart, i: number, k: number): Ground {
  const own = groundOf(chart.cells[i * CHART_CELLS + k]);
  if (!COUNTRY.includes(own)) return own;
  tally.fill(0);
  let [best, most] = [own, 0];
  for (let a = Math.max(0, i - 1); a <= Math.min(CHART_CELLS - 1, i + 1); a++) {
    for (let b = Math.max(0, k - 1); b <= Math.min(CHART_CELLS - 1, k + 1); b++) {
      const cell = chart.cells[a * CHART_CELLS + b];
      const g = groundOf(cell);
      if (!COUNTRY.includes(g)) continue;
      const n = ++tally[cell & 15];
      if (n > most || (n === most && g === own)) [best, most] = [g, n];
    }
  }
  return best;
}

// Whether a water cell has dry land beside it.
function shore(chart: Chart, i: number, k: number): boolean {
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const [u, v] = [i + a, k + b];
    if (u < 0 || v < 0 || u >= CHART_CELLS || v >= CHART_CELLS) continue;
    const g = groundOf(chart.cells[u * CHART_CELLS + v]);
    if (g !== 'water' && g !== 'none') return true;
  }
  return false;
}

export interface MapPaint {
  names: boolean; // villages' and places' names written
  pins: readonly MapPin[];
  places: readonly Place[];
}

// The map as `look` sees it, on `ctx` (its canvas `width` by `height` CSS pixels, already scaled to the screen).
export function paintMap(ctx: CanvasRenderingContext2D, model: GameModel, look: MapLook, width: number, height: number, paint: MapPaint): void {
  const { atlas } = model;
  const { scale } = look;
  const sx = (x: number) => (x - look.x) * scale + width / 2;
  const sz = (z: number) => (z - look.z) * scale + height / 2;
  ctx.fillStyle = VELLUM;
  ctx.fillRect(0, 0, width, height);
  const [x0, x1] = [look.x - width / 2 / scale, look.x + width / 2 / scale];
  const [z0, z1] = [look.z - height / 2 / scale, look.z + height / 2 / scale];
  const charts: Chart[] = [];
  // The chunks' washes in view laid side by side a pixel a cell (one picture: drawn smooth, no seam between them), then
  // drawn over the map at its scale.
  const [c0, c1] = [Math.max(0, Math.floor(x0 / CHUNK)), Math.floor(x1 / CHUNK)];
  const [d0, d1] = [Math.max(0, Math.floor(z0 / CHUNK)), Math.floor(z1 / CHUNK)];
  const sheet = sheetOf(model, (c1 - c0 + 1) * CHART_CELLS, (d1 - d0 + 1) * CHART_CELLS);
  const out = sheet.getContext('2d');
  if (!out) return;
  out.clearRect(0, 0, sheet.width, sheet.height);
  for (let cx = c0; cx <= c1; cx++) {
    for (let cz = d0; cz <= d1; cz++) {
      if (!atlas.fog.bits(cx, cz)) continue;
      const chart = atlas.chart(cx, cz);
      if (chart) charts.push(chart);
      const wash = washOf(model, cx, cz, chart);
      if (wash) out.drawImage(wash, (cx - c0) * CHART_CELLS, (cz - d0) * CHART_CELLS);
    }
  }
  ctx.imageSmoothingEnabled = scale < 3; // (soft as a wash; close up, its cells)
  ctx.drawImage(sheet, sx(c0 * CHUNK), sz(d0 * CHUNK), sheet.width * CHART_CELL * scale, sheet.height * CHART_CELL * scale);
  const seen = (x: number, z: number) => atlas.fog.seen(x, z);
  // The roads, where they've been seen.
  ctx.strokeStyle = ROAD;
  ctx.lineWidth = Math.max(1, Math.min(3, scale * 0.9));
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const chart of charts) {
    for (const way of chart.ways) {
      for (let i = 2; i < way.length; i += 2) {
        const [ax, az, bx, bz] = [way[i - 2], way[i - 1], way[i], way[i + 1]];
        if (!seen(ax, az) || !seen(bx, bz)) continue;
        ctx.moveTo(sx(ax + 0.5), sz(az + 0.5));
        ctx.lineTo(sx(bx + 0.5), sz(bz + 0.5));
      }
    }
  }
  ctx.stroke();
  const font = (px: number, weight = 600) => `${weight} ${px}px 'Fredoka', system-ui, sans-serif`;
  const label = (text: string, x: number, y: number, px: number, ink = NAME) => {
    ctx.font = font(px);
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(236, 220, 180, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = ink;
    ctx.fillText(text, x, y);
  };
  // The villages seen: a house, its name (and level) under it.
  const spawn = spawnOf(model.size);
  for (const chart of charts) {
    for (const v of chart.villages) {
      if (!seen(v.x, v.z)) continue;
      const [x, y] = [sx(v.x + 0.5), sz(v.z + 0.5)];
      house(ctx, x, y);
      if (!paint.names) continue;
      const [name, level] = [`${villageName(v, model.seed)} · `, zoneLevel(spawn, v)];
      ctx.font = font(12);
      const [wide, all] = [ctx.measureText(name).width, ctx.measureText(`${name}${level}`).width];
      label(name, x - all / 2 + wide / 2, y + 18, 12);
      label(String(level), x - all / 2 + wide + ctx.measureText(String(level)).width / 2, y + 18, 12, DANGER_INK[difficulty(level, model.hero.level)]); // (its level, in how dangerous it is to them)
    }
  }
  // The places come upon.
  for (const place of paint.places) {
    const [x, y] = [sx(place.x + 0.5), sz(place.z + 0.5)];
    if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
    glyph(ctx, place.kind, x, y);
    if (place.cleared) {
      ctx.strokeStyle = '#b02a24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 6);
      ctx.lineTo(x + 8, y - 8);
      ctx.stroke();
    }
    if (paint.names && scale >= 2.5) label(place.name, x, y + 17, 11); // (close up: the villages' names first)
  }
  for (const pin of paint.pins) drawPin(ctx, pin, sx(pin.x + 0.5), sz(pin.z + 0.5), width, height);
  hero(ctx, sx(model.inside?.entrance.x ?? model.hero.x), sz(model.inside?.entrance.z ?? model.hero.z), model.hero.facing);
}

// A village: a little house, its roof red-brown.
function house(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#f2e6c8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 5, y - 2, 10, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a4502f';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 1);
  ctx.lineTo(x, y - 8);
  ctx.lineTo(x + 7, y - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// A place's mark, in ink: a crypt's cross, a cave's arch, a stronghold's tower, a camp's tent.
function glyph(ctx: CanvasRenderingContext2D, kind: Place['kind'], x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#5a4632';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (kind === 'crypt') {
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 7);
    ctx.moveTo(x - 5, y - 3);
    ctx.lineTo(x + 5, y - 3);
    ctx.stroke();
  } else if (kind === 'cave') {
    ctx.moveTo(x - 8, y + 6);
    ctx.quadraticCurveTo(x, y - 14, x + 8, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'stronghold') {
    ctx.rect(x - 5, y - 6, 10, 12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (const dx of [-5, -1, 3]) ctx.rect(x + dx, y - 9, 2, 3);
    ctx.fill();
  } else {
    ctx.moveTo(x - 7, y + 5);
    ctx.lineTo(x, y - 7);
    ctx.lineTo(x + 7, y + 5);
    ctx.closePath();
    ctx.fillStyle = '#c8a070';
    ctx.fill();
    ctx.stroke();
  }
}

// A pin: a coloured head on a short stem; one off the map's edge, held at the edge.
function drawPin(ctx: CanvasRenderingContext2D, pin: MapPin, x: number, y: number, width: number, height: number): void {
  const [px, py] = [Math.min(width - 8, Math.max(8, x)), Math.min(height - 4, Math.max(16, y))];
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, py - 9);
  ctx.stroke();
  ctx.fillStyle = PIN_INK[pin.kind];
  ctx.beginPath();
  ctx.arc(px, py - 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (pin.kind === 'bounty') {
    ctx.fillStyle = '#f2e6c8';
    ctx.fillRect(px - 1, py - 15, 2, 4); // (a nail of a mark: wanted)
  }
}

// The hero: a red arrowhead pointing the way they face.
function hero(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number): void {
  const [dx, dy] = [Math.sin(facing), Math.cos(facing)]; // (x across, z down)
  const point = (along: number, aside: number) => [x + dx * along - dy * aside, y + dy * along + dx * aside] as const;
  ctx.fillStyle = '#c8321e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(...point(9, 0));
  ctx.lineTo(...point(-6, 6));
  ctx.lineTo(...point(-2, 0));
  ctx.lineTo(...point(-6, -6));
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

// What's under (x, y) on the map as drawn: the nearest pin, place or village within reach, in words.
export function nameAt(model: GameModel, look: MapLook, width: number, height: number, paint: MapPaint, x: number, y: number): string | null {
  const tx = (x - width / 2) / look.scale + look.x;
  const tz = (y - height / 2) / look.scale + look.z;
  const reach = 12 / look.scale;
  const near = (p: { x: number; z: number }) => Math.hypot(p.x + 0.5 - tx, p.z + 0.5 - tz) <= reach;
  const pin = paint.pins.find((p) => Math.hypot(p.x + 0.5 - tx, p.z + 0.5 - tz + 12 / look.scale) <= reach);
  if (pin) return pin.label;
  const place = paint.places.find(near);
  if (place) return `${place.name} · level ${place.level}${place.cleared ? ' · cleared' : ''}`;
  for (let cx = Math.floor((tx - reach) / CHUNK); cx <= Math.floor((tx + reach) / CHUNK); cx++) {
    for (let cz = Math.floor((tz - reach) / CHUNK); cz <= Math.floor((tz + reach) / CHUNK); cz++) {
      const v = model.atlas.chart(cx, cz)?.villages.find((v) => near(v) && model.atlas.fog.seen(v.x, v.z));
      if (v) return `${villageName(v, model.seed)} · level ${zoneLevel(spawnOf(model.size), v)}`;
    }
  }
  return null;
}
