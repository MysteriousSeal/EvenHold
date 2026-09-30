// Each world as its seed made it, kept in the browser (IndexedDB), so going
// back to a world skips making it again (the longest part of loading). Kept
// packed into flat arrays (heights, water, what covers the ground: a byte a
// tile; trees and bushes as numbers), the last few worlds played only. Each
// is kept under a fingerprint of the code that makes worlds: change any of
// it, and every kept world is made afresh (and the old ones dropped).

import type { Bush, BushKind, Surface, Tree, TreeKind, World } from '../model/types';
import type { MapSize } from '../model/grid';

// The code that makes a world (worldgen/, ruins, camps, the constants, the grid, randomness), as text: its
// fingerprint, worked out live while developing (so a change shows at once); the built game has it worked out already (vite.config.ts).
const MAKERS = import.meta.glob(['../model/worldgen/*.ts', '../model/ruins/*.ts', '../model/camps/*.ts', '../model/constants.ts', '../model/grid.ts', '../util/random.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

declare const __WORLD_VERSION__: string;
export const WORLD_VERSION = import.meta.env.DEV
  ? fnv(
      Object.keys(MAKERS)
        .sort()
        .map((k) => `${k}\n${MAKERS[k]}`)
        .join('\n'),
    )
  : __WORLD_VERSION__;

const SURFACES: Surface[] = ['natural', 'path', 'plaza', 'field'];
const TREE_KINDS: TreeKind[] = ['oak', 'pine', 'birch'];
const BUSH_KINDS: BushKind[] = ['leafy', 'berry', 'flowering'];

export interface PackedWorld {
  version: string;
  width: number;
  depth: number;
  tiles: Uint8Array; // a byte a tile (x * depth + z): its height (bits 0-3), water (bit 4), what covers it (bits 5-6)
  trees: Uint16Array; // three numbers each: x, z, and tier | kind << 4 | shape << 6 | turns << 12
  bushes: Uint16Array; // likewise
  rest: Pick<World, 'trails' | 'villages' | 'houses' | 'buildings' | 'fields' | 'ruins' | 'camps'>;
}

// Trees and bushes: x, z, and their tier, kind, shape and turn packed in one number.
function packThings<T extends { x: number; z: number; groundTier: number; kind: string; shape: number; quarterTurns: number }>(things: readonly T[], kinds: readonly string[]): Uint16Array {
  const out = new Uint16Array(things.length * 3);
  things.forEach((t, i) => {
    out[i * 3] = t.x;
    out[i * 3 + 1] = t.z;
    out[i * 3 + 2] = t.groundTier | (kinds.indexOf(t.kind) << 4) | (t.shape << 6) | (t.quarterTurns << 12);
  });
  return out;
}

function unpackThings<K extends string>(packed: Uint16Array, kinds: readonly K[]): Array<{ x: number; z: number; groundTier: number; kind: K; shape: number; quarterTurns: number }> {
  const out = new Array(packed.length / 3);
  for (let i = 0; i < out.length; i++) {
    const m = packed[i * 3 + 2];
    out[i] = { x: packed[i * 3], z: packed[i * 3 + 1], groundTier: m & 15, kind: kinds[(m >> 4) & 3], shape: (m >> 6) & 63, quarterTurns: (m >> 12) & 3 };
  }
  return out;
}

export function packWorld(world: World): PackedWorld {
  const { width, depth } = world.size;
  const tiles = new Uint8Array(width * depth);
  for (let x = 0; x < width; x++) {
    const [h, lake, surface] = [world.heightMap[x], world.lakeMap[x], world.surfaceMap[x]];
    for (let z = 0; z < depth; z++) tiles[x * depth + z] = h[z] | (lake[z] ? 16 : 0) | (SURFACES.indexOf(surface[z]) << 5);
  }
  const { trails, villages, houses, buildings, fields, ruins, camps } = world;
  return { version: WORLD_VERSION, width, depth, tiles, trees: packThings(world.trees, TREE_KINDS), bushes: packThings(world.bushes, BUSH_KINDS), rest: { trails, villages, houses, buildings, fields, ruins, camps } };
}

export function unpackWorld(packed: PackedWorld): World {
  const { width, depth, tiles } = packed;
  const heightMap: number[][] = new Array(width);
  const lakeMap: boolean[][] = new Array(width);
  const surfaceMap: Surface[][] = new Array(width);
  for (let x = 0; x < width; x++) {
    const [h, lake, surface] = [new Array<number>(depth), new Array<boolean>(depth), new Array<Surface>(depth)];
    for (let z = 0; z < depth; z++) {
      const t = tiles[x * depth + z];
      h[z] = t & 15;
      lake[z] = (t & 16) !== 0;
      surface[z] = SURFACES[t >> 5];
    }
    [heightMap[x], lakeMap[x], surfaceMap[x]] = [h, lake, surface];
  }
  return { size: { width, depth }, heightMap, lakeMap, surfaceMap, ...packed.rest, trees: unpackThings(packed.trees, TREE_KINDS) as Tree[], bushes: unpackThings(packed.bushes, BUSH_KINDS) as Bush[] };
}

const DB = 'evenhold';
const STORE = 'worlds';
const KEEP = 3; // worlds kept, the latest played
const keyOf = (seed: number, size: MapSize) => `${seed}:${size.width}x${size.depth}`;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

const done = <T>(request: IDBRequest<T>): Promise<T | null> =>
  new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

// The world kept for `seed` at `size`, if there's one made by today's code; else null.
export async function loadWorld(seed: number, size: MapSize): Promise<World | null> {
  try {
    const db = await open();
    if (!db) return null;
    const kept = (await done(db.transaction(STORE).objectStore(STORE).get(keyOf(seed, size)))) as { packed: PackedWorld } | null;
    db.close();
    return kept && kept.packed.version === WORLD_VERSION && kept.packed.width === size.width && kept.packed.depth === size.depth ? unpackWorld(kept.packed) : null;
  } catch {
    return null; // (storage refused, or something odd kept: the world's just made)
  }
}

// Keeps `world` for next time, the oldest dropped past KEEP (and any made by older code).
export async function keepWorld(seed: number, size: MapSize, world: World): Promise<void> {
  try {
    const db = await open();
    if (!db) return;
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await done(store.put({ packed: packWorld(world), at: Date.now() }, keyOf(seed, size)));
    const keys = ((await done(store.getAllKeys())) ?? []) as string[];
    const all = ((await done(store.getAll())) ?? []) as Array<{ packed: PackedWorld; at: number }>;
    const byAge = keys.map((key, i) => ({ key, at: all[i].at, stale: all[i].packed.version !== WORLD_VERSION })).sort((a, b) => b.at - a.at);
    for (const [i, { key, stale }] of byAge.entries()) if (stale || i >= KEEP) store.delete(key);
    db.close();
  } catch {
    // (storage full or refused: next time it's just made again)
  }
}
