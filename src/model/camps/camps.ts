// Bandit camps out in the open countryside: one a short walk from spawn (to
// meet early), and more scattered between the villages. Placed in world
// generation from hashes of the seed and where they'd stand (not the world
// rng), so each world's its own, before the trees, which are
// cleared from where they stand (worldgen/world.ts), as round the ruins.
// Each is a 5 x 5 stockade on level grass: a fire in the middle; along the
// back two tents (a patched-hide one and a striped bell tent) either side of
// the banner and its weapon rack, a watchtower in one back corner and the
// woodpile in the other; stolen goods (crates, barrels) on one side, the loot
// on the other; a palisade round it all, and over its way in (the middle of
// one side) a gatehouse, torches lit on its posts. Each piece's look by its
// variant (from where it stands). Its bandits are placed with the other foes
// (enemies/enemies.ts).

import { CAMPFIRE_COLLISION_HALF, CAMP_PROP_COLLISION_HALF, PALISADE_THICKNESS, VILLAGE_OUTER_RADIUS } from '../constants';
import { spawnOf, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Village } from '../types';
import type { ForestDensity } from '../worldgen/trees';
import { hashUnit } from '../../util/random';
import { zoneLevel } from '../enemies/enemyLevels';
import type { Tiles } from '../map/tiles';

export type CampPieceKind = 'fire' | 'tent' | 'rack' | 'crates' | 'loot' | 'palisade' | 'gate' | 'tower' | 'woodpile';

export interface CampPiece {
  kind: CampPieceKind;
  x: number; // its tile, in the world
  z: number;
  quarterTurns: number; // faces the camp's middle (local +Z); a palisade segment's (and the gate's): which edge of its tile (local -Z turned)
  variant: number; // its look (0..3), from where it stands (a tent: 0 the hide one, 1 the bell tent)
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
  tiles: Tiles;
  villages: readonly Village[];
  forest: ForestDensity;
  isOpenTile(x: number, z: number): boolean;
  spawn?: { x: number; z: number }; // where the hero sets out, on its maps (a streamed world's region: off them, but the spawn's own); else the middle
}

const GRID = 26; // one candidate site per GRID x GRID tiles
const CHEST_HALF: [number, number] = [0.22, 0.16]; // the loot's chest (its lid back too), half across and half along, unturned
const CHANCE = 0.4;
const OPEN_LAND = 0.15; // forest density under which it's open country
const CLEAR_OF_VILLAGES = 12;
const CLEAR_OF_SPAWN = 20;
export const MIN_BANDITS = 3; // a camp's bandits, the one near spawn the fewest
export const MAX_BANDITS = 6;

// Where they stand: the one near spawn, then the rest.
export function placeCamps(world: CampWorld): Camp[] {
  const camps: Camp[] = [];
  const taken = new Set<string>();
  const spawn = world.spawn ?? spawnOf(world.size);
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
  near(Math.round(spawn.x - 9), Math.round(spawn.z + 9), 12, MIN_BANDITS, 47);
  for (let gx = 0; gx * GRID < world.size.width; gx++) {
    for (let gz = 0; gz * GRID < world.size.depth; gz++) {
      const roll = (salt: number) => hashUnit(gx, gz, world.seed + salt);
      if (roll(52) >= CHANCE) continue;
      const x = Math.floor(gx * GRID + roll(53) * GRID);
      const z = Math.floor(gz * GRID + roll(54) * GRID);
      if (world.forest(x, z) >= OPEN_LAND) continue;
      if (Math.hypot(x - spawn.x, z - spawn.z) < CLEAR_OF_SPAWN) continue;
      if (world.villages.some((v) => Math.hypot(v.x - x, v.z - z) < CLEAR_OF_VILLAGES + VILLAGE_OUTER_RADIUS)) continue;
      near(x, z, 5, MIN_BANDITS + Math.floor(roll(55) * (MAX_BANDITS - MIN_BANDITS + 1)), 56); // (as many as likely)
    }
  }
  return camps;
}

// A camp at (cx, cz) if it's a level 5 x 5 of open grass, free of others, its
// way in onto open ground; else null.
function site(world: CampWorld, cx: number, cz: number, bandits: number, salt: number, taken: Set<string>): Camp | null {
  const tier = world.tiles.has(cx, cz) ? world.tiles.height(cx, cz) : undefined;
  if (tier === undefined) return null; // off the map (sites near its far edge)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const [x, z] = [cx + dx, cz + dz];
      if (!world.tiles.has(x, z)) return null; // off the map
      if (!world.isOpenTile(x, z) || taken.has(`${x},${z}`) || world.tiles.surface(x, z) !== 'natural' || world.tiles.height(x, z) !== tier) return null;
    }
  }
  const quarterTurns = Math.floor(hashUnit(cx, cz, salt + 9) * 4);
  const [wx, wz] = turn(0, 3, quarterTurns);
  const [ox, oz] = [cx + wx, cz + wz]; // just outside its way in: open ground, or no camp here
  if (!world.tiles.has(ox, oz) || !world.isOpenTile(ox, oz) || taken.has(`${ox},${oz}`) || world.tiles.surface(ox, oz) !== 'natural') return null;
  return { x: cx, z: cz, quarterTurns, bandits, way: { x: cx + wx, z: cz + wz }, pieces: layOut(cx, cz, quarterTurns) };
}

// A camp's level: its ground's (enemies/enemyLevels.ts: zoneLevel), its bandits that or one either side, its chief one over.
export const campLevel = (camp: { x: number; z: number }, size: MapSize): number => zoneLevel(spawnOf(size), camp);

// The camp with a spot of it (its middle, by default; its gate's, its chest's) within `reach` of `at`, if any: those
// whose middle's far off passed over at a glance (a world has a thousand camps, looked for each frame).
export function campNear(camps: readonly Camp[], at: { x: number; z: number }, reach: number, spot: (camp: Camp) => { x: number; z: number } = (c) => c): Camp | null {
  const far = reach + 4; // (no spot of a camp is further than this from its middle and its reach)
  for (const camp of camps) {
    if (Math.abs(at.x - camp.x) > far || Math.abs(at.z - camp.z) > far) continue;
    const { x, z } = spot(camp);
    if (Math.hypot(at.x - x, at.z - z) < reach) return camp;
  }
  return null;
}

// The tiles a camp stands on, its stockade's five by five (its floor: hay strewn over it, no grass through it).
export const campTiles = (camp: { x: number; z: number }): Array<{ x: number; z: number }> =>
  Array.from({ length: 25 }, (_, i) => ({ x: camp.x + (i % 5) - 2, z: camp.z + Math.floor(i / 5) - 2 }));

// Turns a local camp offset by the camp's quarter turns (as three.js turns an
// instance: (x, z) -> (z, -x) per turn).
export function turn(dx: number, dz: number, quarterTurns: number): [number, number] {
  let [x, z] = [dx, dz];
  for (let q = 0; q < quarterTurns; q++) [x, z] = [z, -x];
  return [x, z];
}

// Its pieces, local offsets before turning (way in at local +Z), and each one's look: the fire in the middle; along
// the back the hide tent, the banner and weapon rack, the bell tent, the watchtower in the corner on one side and the
// woodpile in the other's; stolen goods on one side and the loot on the other.
const LAYOUT: Array<[CampPieceKind, number, number, number?]> = [
  ['fire', 0, 0],
  ['tent', -1, -2, 0],
  ['tent', 1, -2, 1],
  ['rack', 0, -2],
  ['tower', -2, -2],
  ['woodpile', 2, -2],
  ['crates', -2, 0],
  ['loot', 2, 0],
];
// Quarter turns that bring a palisade segment (drawn on its tile's local -Z
// edge) to each side of its tile: +x, -x, +z, -z.
const EDGE_TURNS = [3, 1, 2, 0];

function layOut(cx: number, cz: number, quarterTurns: number): CampPiece[] {
  const look = (x: number, z: number) => Math.floor(hashUnit(x, z, 74) * 4);
  const pieces: CampPiece[] = LAYOUT.map(([kind, dx, dz, variant]) => {
    const [ox, oz] = turn(dx, dz, quarterTurns);
    return { kind, x: cx + ox, z: cz + oz, quarterTurns, variant: variant ?? look(cx + ox, cz + oz) };
  });
  // The palisade: every outer edge of the border tiles, but for the way in (the middle of the local +Z side), where
  // the gatehouse stands on its outer edge.
  const [ex, ez] = turn(0, 2, quarterTurns);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const sides = [dx === 2, dx === -2, dz === 2, dz === -2];
      sides.forEach((edge, side) => {
        if (!edge) return;
        const [x, z] = [cx + dx, cz + dz];
        const gate = dx === ex && dz === ez;
        pieces.push({ kind: gate ? 'gate' : 'palisade', x, z, quarterTurns: EDGE_TURNS[side], variant: look(x * 3 + side, z) });
      });
    }
  }
  return pieces;
}

// Which side of its tile a palisade segment stands on (NEIGHBORS_4 order: +x, -x, +z, -z).
export const palisadeSide = (piece: CampPiece): number => EDGE_TURNS.indexOf(piece.quarterTurns);

// What blocks: tents and the watchtower their tile; the fire (too low to hide
// anyone), crates, rack and woodpile a square in the middle of theirs; the loot's
// open chest just itself (low: hiding no one; the gold spilt round it, the rug,
// walked over); the palisade a strip along its edge. The gatehouse doesn't (its
// posts stand where the palisade ends: the way in between them open).
export function addCampObstacles(obstacles: Obstacles, camps: readonly Camp[]): void {
  for (const camp of camps) {
    for (const piece of camp.pieces) {
      if (piece.kind === 'tent' || piece.kind === 'tower') obstacles.addSolid(piece.x, piece.z);
      else if (piece.kind === 'fire') obstacles.addProp(piece.x, piece.z, CAMPFIRE_COLLISION_HALF, true);
      else if (piece.kind === 'palisade') obstacles.addFenceStrip(piece.x, piece.z, palisadeSide(piece), PALISADE_THICKNESS);
      else if (piece.kind === 'loot') obstacles.addProp(piece.x, piece.z, ...(piece.quarterTurns % 2 ? [CHEST_HALF[1], true, CHEST_HALF[0]] : [CHEST_HALF[0], true, CHEST_HALF[1]]) as [number, boolean, number]);
      else if (piece.kind !== 'gate') obstacles.addProp(piece.x, piece.z, CAMP_PROP_COLLISION_HALF);
    }
  }
}
