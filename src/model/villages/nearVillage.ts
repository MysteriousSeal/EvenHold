// What stands near a village (its houses, its inn and smithy, the villages next to it), found in a coarse grid of
// them rather than looked for among all of them: a village's notice board and benches (quests/noticeBoards.ts,
// benches.ts) are its own, worked out from what's round it, once (a streamed world's villages are known region by
// region, its lists growing as it's walked).

import type { Building, House, Village } from '../types';

const CELL = 16; // tiles a side of the grid's cells

interface Buckets {
  sizes: [number, number, number]; // how long each list was when bucketed (grown since: bucketed again)
  houses: Map<string, House[]>;
  buildings: Map<string, Building[]>;
  villages: Map<string, Village[]>;
}

const made = new WeakMap<readonly House[], Buckets>();

const bucket = <T extends { x: number; z: number }>(list: readonly T[]): Map<string, T[]> => {
  const cells = new Map<string, T[]>();
  for (const item of list) {
    const key = `${Math.floor(item.x / CELL)},${Math.floor(item.z / CELL)}`;
    const cell = cells.get(key);
    if (cell) cell.push(item);
    else cells.set(key, [item]);
  }
  return cells;
};

// The houses, buildings and villages within `reach` tiles (each way) of `village`, among `world`'s.
export function nearVillage(
  world: { villages: readonly Village[]; houses: readonly House[]; buildings: readonly Building[] },
  village: { x: number; z: number },
  reach: number,
): { villages: Village[]; houses: House[]; buildings: Building[] } {
  let buckets = made.get(world.houses);
  const sizes: [number, number, number] = [world.houses.length, world.buildings.length, world.villages.length];
  if (!buckets || buckets.sizes.some((n, i) => n !== sizes[i])) {
    buckets = { sizes, houses: bucket(world.houses), buildings: bucket(world.buildings), villages: bucket(world.villages) };
    made.set(world.houses, buckets);
  }
  const within = (p: { x: number; z: number }) => Math.abs(p.x - village.x) <= reach && Math.abs(p.z - village.z) <= reach;
  const gather = <T extends { x: number; z: number }>(cells: Map<string, T[]>): T[] => {
    const out: T[] = [];
    for (let cx = Math.floor((village.x - reach) / CELL); cx <= Math.floor((village.x + reach) / CELL); cx++) {
      for (let cz = Math.floor((village.z - reach) / CELL); cz <= Math.floor((village.z + reach) / CELL); cz++) for (const p of cells.get(`${cx},${cz}`) ?? []) if (within(p)) out.push(p);
    }
    return out;
  };
  return { villages: gather(buckets.villages), houses: gather(buckets.houses), buildings: gather(buckets.buildings) };
}
