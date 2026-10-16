// The map drawn (the M window: controller/atlas/mapWindow.ts; the corner map: view/hud/minimap.ts), as a parchment
// map is inked: blank vellum where the hero's never been; where they have, the country washed in (meadow, woods,
// heath, marsh, hills, water, fields: model/atlas/chart.ts), the higher ground paler; the roads in red-brown ink; each
// village a little house and its name; the ruins and the landmarks seen; the places come upon (a crypt's cross, a cave's
// arch, a stronghold's tower, a camp's tent: mapMarks.ts), struck through once cleared; pins for what's to be done; the hero a red arrowhead. Each chunk's wash
// painted once (a pixel a cell) and kept, painted again only once more of it's been seen or its chart's come.

import type { GameModel } from '../../model/GameModel';
import { CHART_CELL, CHART_CELLS, groundOf, heightOf, type Chart, type Ground } from '../../model/atlas/chart';
import { CELL, CHUNK } from '../../model/atlas/fog';
import type { Landmark, MapPin, Place } from '../../model/atlas/atlas';
import { villageName } from '../../model/villages/villageNames';
import { difficulty, zoneLevel, type Difficulty } from '../../model/enemies/enemyLevels';
import { spawnOf } from '../../model/map/grid';
import { atRim, compass, screenFacing, toMap, toScreen, TURN } from './mapView';
import { GROUND } from '../meshes/terrain/biomeGround';
import { inkLand } from './mapInk';
import { drawMark, MARK_NAME } from './mapMarks';

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
// Each ground's wash: the country's the game's own ground (biomeGround.ts) under a parchment tint, the woods a shade
// darker (their trees inked over them); the water a clear blue, inked at its shore.
const TINT = 0.3; // of the vellum over the game's colours
const rgbOf = (hex: number, dark = 1): [number, number, number] =>
  [hex >> 16, (hex >> 8) & 255, hex & 255].map((c, i) => Math.round((c * (1 - TINT) + [236, 220, 180][i] * TINT) * dark)) as [number, number, number];
const WASH: Record<Ground, [number, number, number]> = {
  none: [236, 220, 180],
  meadow: rgbOf(GROUND.meadow),
  forest: rgbOf(GROUND.forest, 0.82),
  heath: rgbOf(GROUND.heath),
  marsh: rgbOf(GROUND.marsh),
  hills: rgbOf(GROUND.hills),
  water: rgbOf(0x5a9ad0),
  field: [218, 192, 118],
  square: [186, 136, 92],
};
const SHORE: [number, number, number] = [44, 78, 112]; // water at its edge: inked

// A cell's wash, its ground at its height (higher, paler; the water level).
export function washColour(ground: Ground, height: number): [number, number, number] {
  const lift = ground === 'water' ? 1 : 0.9 + 0.05 * height;
  return WASH[ground].map((c) => Math.min(255, Math.round(c * lift))) as [number, number, number];
}
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
      let rgb = chart ? washColour(ground, heightOf(cell)) : UNCHARTED;
      if (chart && ground === 'water' && shore(chart, i, k)) rgb = SHORE;
      const p = (k * CHART_CELLS + i) * 4; // (x across, z down)
      [image.data[p], image.data[p + 1], image.data[p + 2]] = rgb;
      image.data[p + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  kept.set(n, { canvas, seen: fog.version(cx, cz), charted: !!chart });
  return canvas;
}

// A cell's ground as washed in: water, fields and a square as they are; the country, the kind most of the 5 x 5 round
// it are (the country's borders are dithered tile by tile: inked, they'd speckle).
const COUNTRY: readonly Ground[] = ['meadow', 'forest', 'heath', 'marsh', 'hills'];
const tally = new Uint8Array(16);
function settled(chart: Chart, i: number, k: number): Ground {
  const own = groundOf(chart.cells[i * CHART_CELLS + k]);
  if (!COUNTRY.includes(own)) return own;
  tally.fill(0);
  let [best, most] = [own, 0];
  for (let a = Math.max(0, i - 2); a <= Math.min(CHART_CELLS - 1, i + 2); a++) {
    for (let b = Math.max(0, k - 2); b <= Math.min(CHART_CELLS - 1, k + 2); b++) {
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
  namePx?: number; // the villages' names' size (12; the corner map's, smaller)
  mark?: number; // the marks' and pins' size (1; the corner map's, smaller, a place's drawn whole within its frame or not at all)
  pins: readonly MapPin[];
  places: readonly Place[];
  landmarks?: readonly Landmark[];
  corner?: Corner; // the corner map's (minimap.ts): its colours stronger, the hero ringed, no compass (it's on the frame)
}

// What the corner map shows besides: the foes near (red dots), and the gold "!" and "?" over those with a quest to give or
// take ('waiting': a grey "?").
export interface Corner {
  foes: ReadonlyArray<{ x: number; z: number }>;
  asks: ReadonlyArray<{ x: number; z: number; mark: 'offer' | 'waiting' | 'ready' }>;
}

// The map as `look` sees it, on `ctx` (its canvas `width` by `height` CSS pixels, already scaled to the screen).
export function paintMap(ctx: CanvasRenderingContext2D, model: GameModel, look: MapLook, width: number, height: number, paint: MapPaint): void {
  const { atlas } = model;
  const { scale } = look;
  const at = (x: number, z: number) => toScreen(look, width, height, x, z); // (turned as the game's camera: mapView.ts)
  ctx.fillStyle = VELLUM;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height) / 2 / scale; // (the land in view, turned: all within this of the middle)
  const [x0, x1] = [look.x - reach, look.x + reach];
  const [z0, z1] = [look.z - reach, look.z + reach];
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
  ctx.imageSmoothingEnabled = scale < 2; // (soft as a wash; close up, its cells, crisp)
  ctx.save();
  if (paint.corner) ctx.filter = 'saturate(1.25) contrast(1.1)'; // (the wash, small against the game's ground, stronger)
  ctx.translate(...at(c0 * CHUNK, d0 * CHUNK));
  ctx.rotate(TURN);
  ctx.drawImage(sheet, 0, 0, sheet.width * CHART_CELL * scale, sheet.height * CHART_CELL * scale);
  ctx.restore();
  const seen = (x: number, z: number) => atlas.fog.seen(x, z);
  inkLand(ctx, charts, seen, at, { x0, z0, x1, z1 }, scale); // (the woods' trees, the hills' hatching, the fields' furrows)
  // The roads, where they've been seen.
  ctx.strokeStyle = ROAD;
  ctx.lineWidth = Math.max(1.5, Math.min(4, scale * 1.2));
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const chart of charts) {
    for (const way of chart.ways) {
      for (let i = 2; i < way.length; i += 2) {
        const [ax, az, bx, bz] = [way[i - 2], way[i - 1], way[i], way[i + 1]];
        if (!seen(ax, az) || !seen(bx, bz)) continue;
        ctx.moveTo(...at(ax + 0.5, az + 0.5));
        ctx.lineTo(...at(bx + 0.5, bz + 0.5));
      }
    }
  }
  ctx.stroke();
  const font = (px: number, weight = 600) => `${weight} ${px}px 'Fredoka', system-ui, sans-serif`;
  // What's drawn where (marks, then names as they're written): a name that would cross any is left out, so none is
  // written over another, a mark or a pin.
  const taken: Array<[number, number, number, number]> = [];
  const take = (x0: number, y0: number, x1: number, y1: number) => taken.push([x0, y0, x1, y1]);
  const free = (x0: number, y0: number, x1: number, y1: number) => !taken.some(([a, b, c, d]) => x0 < c && x1 > a && y0 < d && y1 > b);
  const label = (text: string, x: number, y: number, px: number, ink = NAME) => {
    ctx.font = font(px);
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(236, 220, 180, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = ink;
    ctx.fillText(text, x, y);
  };
  // The marks first: the ruins and landmarks seen, the villages (a house), the places come upon (struck through once
  // cleared), the pins' heads.
  const m = paint.mark ?? 1;
  const sized = (x: number, y: number, draw: (x: number, y: number) => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(m, m);
    draw(0, 0);
    ctx.restore();
  };
  for (const r of charts.flatMap((chart) => chart.ruins.filter((r) => seen(r.x, r.z)))) {
    const [x, y] = at(r.x + r.w / 2, r.z + r.d / 2);
    sized(x, y, (x, y) => drawMark(ctx, 'ruin', x, y));
    take(x - 8 * m, y - 7 * m, x + 8 * m, y + 5 * m);
  }
  for (const l of paint.landmarks ?? []) {
    const [x, y] = at(l.x + 0.5, l.z + 0.5);
    if (x < -10 || y < -10 || x > width + 10 || y > height + 10) continue;
    sized(x, y, (x, y) => drawMark(ctx, l.kind, x, y));
    take(x - 7 * m, y - 7 * m, x + 7 * m, y + 6 * m);
  }
  const villages = charts.flatMap((chart) => chart.villages.filter((v) => seen(v.x, v.z)));
  for (const v of villages) {
    const [x, y] = at(v.x + 0.5, v.z + 0.5);
    sized(x, y, (x, y) => drawMark(ctx, v.town ? 'town' : 'village', x, y));
    take(x - 7 * m, y - (v.town ? 20 : 8) * m, x + 7 * m, y + 5 * m);
  }
  const rim = paint.mark ? 10 * m : -20; // (the corner map's whole within its frame; the map's, cut by its edge)
  const places = paint.places.filter((p) => {
    const [x, y] = at(p.x + 0.5, p.z + 0.5);
    return x > rim && y > rim && x < width - rim && y < height - rim;
  });
  for (const place of places) {
    const [x, y] = at(place.x + 0.5, place.z + 0.5);
    sized(x, y, (x, y) => {
      drawMark(ctx, place.kind, x, y); // (not kept from the villages' names: one may run over it, a place's may not)
      if (!place.cleared) return;
      ctx.strokeStyle = '#b02a24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 6);
      ctx.lineTo(x + 8, y - 8);
      ctx.stroke();
    });
  }
  for (const pin of paint.pins) {
    const [x, y] = at(pin.x + 0.5, pin.z + 0.5);
    take(x - 6 * m, y - 18 * m, x + 6 * m, y);
  }
  if (paint.corner) take(width / 2 - 10, height / 2 - 10, width / 2 + 10, height / 2 + 10); // (the hero's ring: no name over it)
  for (const ask of paint.corner?.asks ?? []) {
    const [x, y] = at(ask.x + 0.5, ask.z + 0.5);
    take(x - 4, y - 12, x + 4, y + 2);
  }
  // Then the names, under their marks: the villages' (and their levels, in how dangerous they are to the hero), nearest
  // the middle first; drawn in a little, the places'.
  if (paint.names) {
    const spawn = spawnOf(model.size);
    const middle = (p: { x: number; z: number }) => Math.hypot(p.x - look.x, p.z - look.z);
    for (const v of [...villages].sort((a, b) => middle(a) - middle(b))) {
      const [name, level] = [`${villageName(v, model.seed)} · `, zoneLevel(spawn, v)];
      const px = paint.namePx ?? 12;
      ctx.font = font(px);
      const [wide, all] = [ctx.measureText(name).width, ctx.measureText(`${name}${level}`).width];
      const [x, vy] = at(v.x + 0.5, v.z + 0.5);
      const y = [6 + px, -12].map((dy) => vy + dy).find((y) => free(x - all / 2 - 2, y - px + 1, x + all / 2 + 2, y + 3)); // (under its house, else over it)
      if (y === undefined) continue;
      take(x - all / 2 - 2, y - px + 1, x + all / 2 + 2, y + 3);
      label(name, x - all / 2 + wide / 2, y, px);
      label(String(level), x - all / 2 + wide + ctx.measureText(String(level)).width / 2, y, px, DANGER_INK[difficulty(level, model.hero.level)]);
    }
    for (const place of places) {
      const [x, y] = at(place.x + 0.5, place.z + 0.5);
      take(x - 8 * m, y - 9 * m, x + 8 * m, y + 7 * m);
    }
    for (const place of scale >= 2 ? places : []) {
      const [x, py] = at(place.x + 0.5, place.z + 0.5);
      const y = py + 17;
      ctx.font = font(11);
      const half = ctx.measureText(place.name).width / 2 + 2;
      if (!free(x - half, y - 10, x + half, y + 3)) continue;
      take(x - half, y - 10, x + half, y + 3);
      label(place.name, x, y, 11);
    }
  }
  const inView = (x: number, y: number) => x > 4 && y > 4 && x < width - 4 && y < height - 4;
  for (const foe of paint.corner?.foes ?? []) {
    const [x, y] = at(foe.x, foe.z);
    if (!inView(x, y)) continue;
    ctx.fillStyle = '#d4281c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const pin of paint.pins) {
    const [x, y] = atRim(...at(pin.x + 0.5, pin.z + 0.5), width, height);
    sized(x, y, (x, y) => drawPin(ctx, pin, x, y));
  }
  for (const ask of paint.corner?.asks ?? []) {
    const [x, y] = at(ask.x + 0.5, ask.z + 0.5);
    if (!inView(x, y - 6)) continue;
    ctx.font = font(14, 800);
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(ask.mark === 'offer' ? '!' : '?', x, y);
    ctx.fillStyle = ask.mark === 'waiting' ? '#b8b0a0' : '#ffc83a';
    ctx.fillText(ask.mark === 'offer' ? '!' : '?', x, y);
  }
  const [hx, hz] = [model.inside?.entrance.x ?? model.hero.x, model.inside?.entrance.z ?? model.hero.z];
  hero(ctx, ...(paint.corner ? ([width / 2, height / 2] as const) : at(hx, hz)), screenFacing(model.hero.facing), !!paint.corner);
  if (!paint.corner) compass(ctx, width - 16, 30, INK);
}

// A pin: a coloured head on a short stem (one off the map's edge already held at the edge: mapView.ts atRim).
function drawPin(ctx: CanvasRenderingContext2D, pin: MapPin, px: number, py: number): void {
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

// The hero: a red arrowhead pointing the way they face (`ringed`, on a pale disc: the corner map's, no mark of a place).
function hero(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, ringed = false): void {
  if (ringed) {
    ctx.fillStyle = '#fff4d8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  const [dx, dy] = [Math.sin(facing), Math.cos(facing)]; // (on the screen: x across, y down)
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
  const [tx, tz] = toMap(look, width, height, x, y);
  const reach = 12 / look.scale;
  const near = (p: { x: number; z: number }) => Math.hypot(p.x + 0.5 - tx, p.z + 0.5 - tz) <= reach;
  const pin = paint.pins.find((p) => {
    const [px, py] = toScreen(look, width, height, p.x + 0.5, p.z + 0.5);
    return Math.hypot(px - x, py - 12 - y) <= 12; // (its head, drawn over it on the screen)
  });
  if (pin) return pin.label;
  const place = paint.places.find(near);
  if (place) return `${place.name} · level ${place.level}${place.cleared ? ' · cleared' : ''}`;
  for (let cx = Math.floor((tx - reach) / CHUNK); cx <= Math.floor((tx + reach) / CHUNK); cx++) {
    for (let cz = Math.floor((tz - reach) / CHUNK); cz <= Math.floor((tz + reach) / CHUNK); cz++) {
      const v = model.atlas.chart(cx, cz)?.villages.find((v) => near(v) && model.atlas.fog.seen(v.x, v.z));
      if (v) return `${villageName(v, model.seed)} · level ${zoneLevel(spawnOf(model.size), v)}`;
      const ruin = model.atlas.chart(cx, cz)?.ruins.find((r) => Math.hypot(r.x + r.w / 2 - tx, r.z + r.d / 2 - tz) <= reach && model.atlas.fog.seen(r.x, r.z));
      if (ruin) return MARK_NAME.ruin;
    }
  }
  const landmark = paint.landmarks?.find(near);
  return landmark ? MARK_NAME[landmark.kind] : null;
}
