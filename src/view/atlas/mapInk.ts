// What's inked over the map's wash (mapPaint.ts), as a map-maker marks the country: the woods a scatter of little trees,
// the hills hatched (the higher, the more strokes), the fields striped. Put down on a grid of tiles some MARK_PX pixels
// apart at the map's scale (each nudged a little, by the tile: the same every time), only where it's been seen.

import { CHART_CELL, CHART_CELLS, groundOf, heightOf, type Chart } from '../../model/atlas/chart';
import { CHUNK } from '../../model/atlas/fog';
import { hashUnit } from '../../util/random';

const MARK_PX = 9; // pixels between marks
const TREE = '#35502a';
const TREE_INK = '#22301a';
const HATCH = 'rgba(46, 31, 20, 0.45)';
const FURROW = 'rgba(138, 100, 40, 0.7)';

// The marks over the tiles (x0..x1, z0..z1) on `ctx`, each tile at `at(x, z)` on the canvas, `scale` pixels a tile.
export function inkLand(
  ctx: CanvasRenderingContext2D,
  charts: readonly Chart[],
  seen: (x: number, z: number) => boolean,
  at: (x: number, z: number) => readonly [number, number],
  view: { x0: number; z0: number; x1: number; z1: number },
  scale: number,
): void {
  const byChunk = new Map(charts.map((c) => [`${c.cx},${c.cz}`, c]));
  const step = CHART_CELL * Math.max(1, Math.round(MARK_PX / scale / CHART_CELL));
  const size = Math.min(4, Math.max(2, scale * 1.6)); // (a mark's half-width in pixels)
  const [trees, hatches, furrows] = [new Path2D(), new Path2D(), new Path2D()];
  for (let x = Math.floor(view.x0 / step) * step; x <= view.x1; x += step) {
    for (let z = Math.floor(view.z0 / step) * step; z <= view.z1; z += step) {
      const [cx, cz] = [Math.floor(x / CHUNK), Math.floor(z / CHUNK)];
      const chart = byChunk.get(`${cx},${cz}`);
      if (!chart || !seen(x, z)) continue;
      const cell = chart.cells[Math.floor((x - cx * CHUNK) / CHART_CELL) * CHART_CELLS + Math.floor((z - cz * CHUNK) / CHART_CELL)];
      const ground = groundOf(cell);
      const nudge = (salt: number) => (hashUnit(x, z, salt) - 0.5) * step * 0.6;
      const [px, py] = at(x + step / 2 + nudge(1), z + step / 2 + nudge(2));
      if (ground === 'forest') {
        trees.moveTo(px, py - size * 1.4);
        trees.lineTo(px + size, py + size * 0.6);
        trees.lineTo(px - size, py + size * 0.6);
        trees.closePath();
      } else if (ground === 'hills') {
        const strokes = 1 + Math.floor(heightOf(cell) / 3);
        for (let s = 0; s < strokes; s++) {
          const dx = (s - (strokes - 1) / 2) * size * 0.8;
          hatches.moveTo(px + dx - size * 0.4, py + size * 0.6);
          hatches.lineTo(px + dx + size * 0.4, py - size * 0.6);
        }
      } else if (ground === 'field') {
        for (const dy of [-size * 0.6, 0, size * 0.6]) {
          furrows.moveTo(px - size, py + dy);
          furrows.lineTo(px + size, py + dy);
        }
      }
    }
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = HATCH;
  ctx.stroke(hatches);
  ctx.strokeStyle = FURROW;
  ctx.stroke(furrows);
  ctx.fillStyle = TREE;
  ctx.strokeStyle = TREE_INK;
  ctx.fill(trees);
  ctx.stroke(trees);
}
