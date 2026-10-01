// What the crypt tests look at in a crypt's plan (model/crypts/cryptLayout.ts).
import { cellKey, flood } from '../../src/model/map/grid';
import { isFloor, type CryptPlan } from '../../src/model/crypts/cryptLayout';
import type { CryptProp } from '../../src/model/crypts/cryptProps';

// The tiles solid props stand on.
export function solidTiles(props: readonly CryptProp[]): Set<string> {
  const solid = new Set<string>();
  for (const p of props) if (p.solid) for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) solid.add(cellKey(x, z));
  return solid;
}

// The floor reached from the foot of the stairs, round `solid` tiles.
export const floorReached = (plan: CryptPlan, solid: ReadonlySet<string> = new Set()): Set<string> =>
  flood([[plan.door, plan.depth - 1]], (x, z) => isFloor(plan, x, z) && !solid.has(cellKey(x, z)));

// How many tiles of rock are joined to the rock round the crypt (all of it, if no island stands alone).
export function rockJoined(plan: CryptPlan): number {
  const rock = (x: number, z: number) => x >= 0 && z >= 0 && x < plan.width && z < plan.depth && !isFloor(plan, x, z);
  const edges: Array<[number, number]> = [];
  for (let x = 0; x < plan.width; x++) edges.push([x, 0], [x, plan.depth - 1]);
  for (let z = 0; z < plan.depth; z++) edges.push([0, z], [plan.width - 1, z]);
  return flood(edges, rock).size;
}
