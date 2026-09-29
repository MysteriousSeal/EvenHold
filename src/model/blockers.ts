// What blocks the way in the world, gathered into its obstacles
// (obstacles.ts): buildings and wells, which fill their tiles; bushes, tree
// trunks, lamp posts and a field's corner (heaped with bales and tools),
// each with a footprint of its own; field fences along tile edges; and at
// the bandits' camps, their tents, props and palisades.

import {
  BUSH_COLLISION_HALF,
  CAMPFIRE_COLLISION_HALF,
  CAMP_PROP_COLLISION_HALF,
  FENCE_THICKNESS,
  FIELD_CORNER_COLLISION_HALF,
  LANTERN_COLLISION_HALF,
  PALISADE_THICKNESS,
  TREE_COLLISION_HALF,
} from './constants';
import { campPalisade, campPieces } from './enemies/enemies';
import type { MapSize } from './grid';
import { Obstacles } from './obstacles';
import type { Bush, Camp, Field, Tree, Village } from './types';
import { fenceEdges } from './worldgen/fields';
import { squareLanterns } from './worldgen/villages';
import { noticeBoards, type BoardWorld } from './quests/noticeBoards';
import { squareBenches, type BenchWorld } from './worldgen/benches';

const BOARD_COLLISION_HALF = 0.3;
const BENCH_COLLISION_HALF = 0.3;

export interface BlockerWorld extends BoardWorld, BenchWorld {
  size: MapSize;
  lakeMap: boolean[][];
  bushes: readonly Bush[];
  trees: readonly Tree[];
  villages: readonly Village[];
  fields: readonly Field[];
}

// The world's obstacles, but for the camps (placed later, round what's here).
// `solid`: the tiles buildings and wells fill (worldgen/world.ts solidCells).
export function worldObstacles(world: BlockerWorld, solid: Iterable<string>): Obstacles {
  const obstacles = new Obstacles(world.size, world.lakeMap, new Set(solid));
  for (const b of world.bushes) obstacles.addProp(b.x, b.z, BUSH_COLLISION_HALF);
  for (const t of world.trees) obstacles.addProp(t.x, t.z, TREE_COLLISION_HALF);
  for (const v of world.villages) for (const [x, z] of squareLanterns(v)) obstacles.addProp(x, z, LANTERN_COLLISION_HALF);
  for (const { x, z } of noticeBoards(world)) obstacles.addProp(x, z, BOARD_COLLISION_HALF); // the notice boards, by the inns
  for (const { x, z } of squareBenches(world)) obstacles.addProp(x, z, BENCH_COLLISION_HALF); // the benches round the squares
  for (const field of world.fields) {
    for (const { x, z, side } of fenceEdges(field)) obstacles.addFenceStrip(x, z, side, FENCE_THICKNESS);
    obstacles.addProp(field.corner[0], field.corner[1], FIELD_CORNER_COLLISION_HALF); // its hay bales and tools
  }
  return obstacles;
}

// The camps' blockers: tents fill their tile; the fire (too low to hide
// anyone), crates and rack a square in the middle of theirs; the palisade a
// strip along its edges. The loot pile and log seats don't block.
export function addCampObstacles(obstacles: Obstacles, camps: readonly Camp[]): void {
  for (const camp of camps) {
    for (const piece of campPieces(camp)) {
      if (piece.kind === 'tent') obstacles.addSolid(piece.x, piece.z);
      else if (piece.kind === 'fire') obstacles.addProp(piece.x, piece.z, CAMPFIRE_COLLISION_HALF, true);
      else if (piece.kind !== 'loot') obstacles.addProp(piece.x, piece.z, CAMP_PROP_COLLISION_HALF);
    }
    for (const edge of campPalisade(camp)) obstacles.addFenceStrip(edge.x, edge.z, edge.side, PALISADE_THICKNESS);
  }
}
