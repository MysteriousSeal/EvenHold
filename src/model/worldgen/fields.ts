// Crop fields around villages: a few fenced wheat plots on flat, dry, open
// ground near each square, clear of trails, the square and each other by a
// tile. Runs after trails (so it never cuts one) and before trees and
// bushes (which then keep off the crops). Choices come from a per-village
// hash, not the world rng, so fields don't shift anything drawn after them.

import { NEIGHBORS_4, cellKey, inBounds, sizeOf } from '../grid';
import { hashCell, mulberry32, shuffle } from '../../util/random';
import type { Field, Surface, Village } from '../types';

const FIELDS_MIN = 2;
const FIELDS_MAX = 4; // inclusive
const REACH_MIN = 5; // plot tiles are this far (Chebyshev) from the well...
const REACH_MAX = 11; // ...up to this far
const FIELD_SALT = 31;

export function generateFields(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  blockedCells: ReadonlySet<string>,
  villages: Village[],
): Field[] {
  const size = sizeOf(heightMap);
  const fields: Field[] = [];
  const taken = new Set<string>(); // field tiles, to keep plots a tile apart

  // Free if open, dry grass on the village's tier, with nothing but grass
  // (or another tile of the same plot) around it.
  const free = (x: number, z: number, tier: number) =>
    inBounds(size, x, z) && !lakeMap[x][z] && surfaceMap[x][z] === 'natural' && heightMap[x][z] === tier && !blockedCells.has(cellKey(x, z));
  const clearAround = (x: number, z: number) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(size, nx, nz)) continue;
        if (surfaceMap[nx][nz] === 'path' || surfaceMap[nx][nz] === 'plaza' || taken.has(cellKey(nx, nz))) return false;
      }
    }
    return true;
  };

  for (const village of villages) {
    const rng = mulberry32(hashCell(village.x, village.z, FIELD_SALT));
    const wanted = FIELDS_MIN + Math.floor(rng() * (FIELDS_MAX - FIELDS_MIN + 1));
    // Candidate plots: every size and position in reach, tried in a
    // village-specific shuffled order.
    const candidates: Array<{ x0: number; z0: number; width: number; depth: number }> = [];
    for (const [short, long] of [
      [3, 3],
      [3, 4],
      [3, 5],
      [4, 4],
      [4, 5],
      [3, 6],
      [4, 6],
    ]) {
      for (const [width, depth] of short === long ? [[short, long]] : [[short, long], [long, short]]) {
        for (let x0 = village.x - REACH_MAX; x0 <= village.x + REACH_MAX - width + 1; x0++) {
          for (let z0 = village.z - REACH_MAX; z0 <= village.z + REACH_MAX - depth + 1; z0++) {
            const near = Math.max(
              Math.max(village.x - (x0 + width - 1), x0 - village.x, 0),
              Math.max(village.z - (z0 + depth - 1), z0 - village.z, 0),
            );
            if (near >= REACH_MIN) candidates.push({ x0, z0, width, depth });
          }
        }
      }
    }
    shuffle(candidates, rng);

    let placed = 0;
    for (const c of candidates) {
      if (placed >= wanted) break;
      const tiles: Array<[number, number]> = [];
      for (let x = c.x0; x < c.x0 + c.width; x++) for (let z = c.z0; z < c.z0 + c.depth; z++) tiles.push([x, z]);
      if (!tiles.every(([x, z]) => free(x, z, village.groundTier) && clearAround(x, z))) continue;

      for (const [x, z] of tiles) {
        surfaceMap[x][z] = 'field';
        taken.add(cellKey(x, z));
      }
      // The gate is the edge tile nearest the well; hay and tools go in the
      // corner diagonally across from it.
      const edge = tiles.filter(([x, z]) => x === c.x0 || z === c.z0 || x === c.x0 + c.width - 1 || z === c.z0 + c.depth - 1);
      const toWell = ([x, z]: [number, number]) => Math.hypot(x - village.x, z - village.z);
      const gate = edge.reduce((a, b) => (toWell(b) < toWell(a) ? b : a));
      const corner: [number, number] = [
        gate[0] - c.x0 < c.width / 2 ? c.x0 + c.width - 1 : c.x0,
        gate[1] - c.z0 < c.depth / 2 ? c.z0 + c.depth - 1 : c.z0,
      ];
      fields.push({ ...c, groundTier: village.groundTier, rowsAlongX: c.width >= c.depth, gate, corner });
      placed++;
    }
  }
  return fields;
}

// Where a field's fence runs: every tile edge on the field's border, as
// (tile, NEIGHBORS_4 side index), except around the gate tile, which is
// left open as the way in. Shared by the fence's collision and its mesh.
export function fenceEdges(field: Field): Array<{ x: number; z: number; side: number }> {
  const inside = (tx: number, tz: number) =>
    tx >= field.x0 && tx < field.x0 + field.width && tz >= field.z0 && tz < field.z0 + field.depth;
  const edges: Array<{ x: number; z: number; side: number }> = [];
  for (let x = field.x0; x < field.x0 + field.width; x++) {
    for (let z = field.z0; z < field.z0 + field.depth; z++) {
      if (x === field.gate[0] && z === field.gate[1]) continue;
      NEIGHBORS_4.forEach(([dx, dz], side) => {
        if (!inside(x + dx, z + dz)) edges.push({ x, z, side });
      });
    }
  }
  return edges;
}
