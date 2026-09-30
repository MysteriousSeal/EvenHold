// Bandit camps out in the open countryside: one a short walk from spawn (to
// meet early), and more scattered between the villages. Placed in world
// generation from hashes of the seed and where they'd stand (not the world
// rng), so each world's its own, before the trees, which are
// cleared from where they stand (worldgen/world.ts), as round the ruins.
// Each is a 5 x 5 patch of level grass: a fire in the middle, two tents and
// a weapon rack at the back, crates on one side, the loot pile on the other,
// a palisade round it all but for its way in (the middle of one side). Its
// bandits are placed with the other foes (enemies/enemies.ts).

import { CAMPFIRE_COLLISION_HALF, CAMP_PROP_COLLISION_HALF, PALISADE_THICKNESS, VILLAGE_OUTER_RADIUS } from '../constants';
import { spawnOf, type MapSize } from '../grid';
import type { Obstacles } from '../obstacles';
import type { Surface, Village } from '../types';
import type { ForestDensity } from '../worldgen/trees';
import { hashUnit } from '../../util/random';

export type CampPieceKind = 'fire' | 'tent' | 'rack' | 'crates' | 'loot' | 'palisade';

export interface CampPiece {
  kind: CampPieceKind;
  x: number; // its tile, in the world
  z: number;
  quarterTurns: number; // faces the camp's middle (local +Z); a palisade segment's: which edge of its tile (local -Z turned)
}

export interface Camp {
  x: number; // its middle (the fire)
  z: number;
  quarterTurns: number; // its way in faces local +Z, turned
  bandits: number; // how many camp there
  way: { x: number; z: number }; // the tile just outside its way in
  pieces: CampPiece[];
}

export interface CampWorld {
  seed: number;
  size: MapSize;
  heightMap: number[][];
  surfaceMap: Surface[][];
  villages: readonly Village[];
  forest: ForestDensity;
  isOpenTile(x: number, z: number): boolean;
}

const GRID = 26; // one candidate site per GRID x GRID tiles
const CHANCE = 0.4;
const OPEN_LAND = 0.15; // forest density under which it's open country
const CLEAR_OF_VILLAGES = 12;
const CLEAR_OF_SPAWN = 20;

// Where they stand: the one near spawn, then the rest.
export function placeCamps(world: CampWorld): Camp[] {
  const camps: Camp[] = [];
  const taken = new Set<string>();
  const spawn = spawnOf(world.size);
  // A camp takes the nearest good site within `reach` of its spot: a flat,
  // open 5 x 5 is rarely exactly where you'd like it.
  const near = (x: number, z: number, reach: number, bandits: number, salt: number) => {
    for (let r = 0; r <= reach; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const camp = site(world, x + dx, z + dz, bandits, world.seed + salt, taken);
          if (!camp) continue;
          camps.push(camp);
          for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) taken.add(`${camp.x + i},${camp.z + k}`); // and a tile round it
          return;
        }
      }
    }
  };
  near(Math.round(spawn.x - 9), Math.round(spawn.z + 9), 12, 3, 47);
  for (let gx = 0; gx * GRID < world.size.width; gx++) {
    for (let gz = 0; gz * GRID < world.size.depth; gz++) {
      const roll = (salt: number) => hashUnit(gx, gz, world.seed + salt);
      if (roll(52) >= CHANCE) continue;
      const x = Math.floor(gx * GRID + roll(53) * GRID);
      const z = Math.floor(gz * GRID + roll(54) * GRID);
      if (world.forest(x, z) >= OPEN_LAND) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < CLEAR_OF_SPAWN) continue;
      if (world.villages.some((v) => Math.hypot(v.x - x, v.z - z) < CLEAR_OF_VILLAGES + VILLAGE_OUTER_RADIUS)) continue;
      near(x, z, 5, roll(55) < 0.5 ? 4 : 2, 56);
    }
  }
  return camps;
}

// A camp at (cx, cz) if it's a level 5 x 5 of open grass, free of others, its
// way in onto open ground; else null.
function site(world: CampWorld, cx: number, cz: number, bandits: number, salt: number, taken: Set<string>): Camp | null {
  const tier = world.heightMap[cx]?.[cz];
  if (tier === undefined) return null; // off the map (sites near its far edge)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const [x, z] = [cx + dx, cz + dz];
      if (world.heightMap[x]?.[z] === undefined) return null; // off the map
      if (!world.isOpenTile(x, z) || taken.has(`${x},${z}`) || world.surfaceMap[x]?.[z] !== 'natural' || world.heightMap[x][z] !== tier) return null;
    }
  }
  const quarterTurns = Math.floor(hashUnit(cx, cz, salt + 9) * 4);
  const [wx, wz] = turn(0, 3, quarterTurns);
  const [ox, oz] = [cx + wx, cz + wz]; // just outside its way in: open ground, or no camp here
  if (world.heightMap[ox]?.[oz] === undefined || !world.isOpenTile(ox, oz) || taken.has(`${ox},${oz}`) || world.surfaceMap[ox][oz] !== 'natural') return null;
  return { x: cx, z: cz, quarterTurns, bandits, way: { x: cx + wx, z: cz + wz }, pieces: layOut(cx, cz, quarterTurns) };
}

// Turns a local camp offset by the camp's quarter turns (as three.js turns an
// instance: (x, z) -> (z, -x) per turn).
function turn(dx: number, dz: number, quarterTurns: number): [number, number] {
  let [x, z] = [dx, dz];
  for (let q = 0; q < quarterTurns; q++) [x, z] = [z, -x];
  return [x, z];
}

// Its pieces, local offsets before turning (way in at local +Z): the fire in
// the middle, two tents and the weapon rack along the back, crates on one side
// and the loot pile on the other.
const LAYOUT: Array<[CampPieceKind, number, number]> = [
  ['fire', 0, 0],
  ['tent', -1, -2],
  ['tent', 1, -2],
  ['rack', 0, -2],
  ['crates', -2, 0],
  ['loot', 2, 0],
];
// Quarter turns that bring a palisade segment (drawn on its tile's local -Z
// edge) to each side of its tile: +x, -x, +z, -z.
const EDGE_TURNS = [3, 1, 2, 0];

function layOut(cx: number, cz: number, quarterTurns: number): CampPiece[] {
  const pieces: CampPiece[] = LAYOUT.map(([kind, dx, dz]) => {
    const [ox, oz] = turn(dx, dz, quarterTurns);
    return { kind, x: cx + ox, z: cz + oz, quarterTurns };
  });
  // The palisade: every outer edge of the border tiles, but for the way in (the middle of the local +Z side).
  const [ex, ez] = turn(0, 2, quarterTurns);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx === ex && dz === ez) continue;
      const sides = [dx === 2, dx === -2, dz === 2, dz === -2];
      sides.forEach((edge, side) => edge && pieces.push({ kind: 'palisade', x: cx + dx, z: cz + dz, quarterTurns: EDGE_TURNS[side] }));
    }
  }
  return pieces;
}

// Which side of its tile a palisade segment stands on (NEIGHBORS_4 order: +x, -x, +z, -z).
export const palisadeSide = (piece: CampPiece): number => EDGE_TURNS.indexOf(piece.quarterTurns);

// What blocks: tents their tile; the fire (too low to hide anyone), crates
// and rack a square in the middle of theirs; the palisade a strip along its
// edge. The loot pile doesn't.
export function addCampObstacles(obstacles: Obstacles, camps: readonly Camp[]): void {
  for (const camp of camps) {
    for (const piece of camp.pieces) {
      if (piece.kind === 'tent') obstacles.addSolid(piece.x, piece.z);
      else if (piece.kind === 'fire') obstacles.addProp(piece.x, piece.z, CAMPFIRE_COLLISION_HALF, true);
      else if (piece.kind === 'palisade') obstacles.addFenceStrip(piece.x, piece.z, palisadeSide(piece), PALISADE_THICKNESS);
      else if (piece.kind !== 'loot') obstacles.addProp(piece.x, piece.z, CAMP_PROP_COLLISION_HALF);
    }
  }
}
