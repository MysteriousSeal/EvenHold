// The reliquary under the cathedral: the cathedral town's own dungeon (one to a world, as the town is), its way down a
// door in the cathedral town (placed by the town: registerReliquary), the same hand-shaped plan in every world
// (reliquaryPlan.ts), its props (reliquaryProps.ts), its dead and the Gilded Deacon (reliquaryFoes.ts). A kind of
// dungeon as a crypt is (dungeons/dungeonTypes.ts): gone into as a room is, its stair up at its door; what's slain
// in it kept by its key in the save. Barred, if the story says so (`barred`: what's told at its door), till then.

import type { Entrance, Room } from '../interiors/interiors';
import type { DungeonKind, DungeonPlace } from '../dungeons/dungeonTypes';
import { isFloor } from '../dungeons/floorPlan';
import { reliquaryPlan, type ReliquaryPlan } from './reliquaryPlan';
import { reliquaryProps, type ReliquaryProp } from './reliquaryProps';
import { ReliquaryRun, reliquaryPosts } from './reliquaryFoes';

export const RELIQUARY_NAME = "the bishop's ossuary";
export const RELIQUARY_LEVEL = 13; // (the cathedral town's at about 12: a level past it)

export interface ReliquaryInside {
  plan: ReliquaryPlan;
  props: ReliquaryProp[];
  place: DungeonPlace;
  room: Room; // as a room: its plan's bounds, the stair up at its door
  barred?: () => { title: string; line: string } | null; // what's told at its door while it's barred (the story's), or null: open
}

const insides = new WeakMap<Entrance, ReliquaryInside>();

// The reliquary down this way in (the cathedral town's, placed with it): `at` the town's spot (its key in the save),
// its name and level if not the usual.
export function registerReliquary(entrance: Entrance, at: { x: number; z: number }, more: { name?: string; level?: number; barred?: ReliquaryInside['barred'] } = {}): void {
  const plan = reliquaryPlan();
  const place: DungeonPlace = { kind: 'reliquary', name: more.name ?? RELIQUARY_NAME, level: more.level ?? RELIQUARY_LEVEL, key: `reliquary:${at.x},${at.z}` };
  insides.set(entrance, { plan, props: reliquaryProps(), place, room: { width: plan.width, depth: plan.depth, door: plan.door, floor: 'flagstones', wall: 'stone' }, barred: more.barred });
}

export function reliquaryInside(entrance: Entrance): ReliquaryInside {
  const inside = insides.get(entrance);
  if (!inside) throw new Error('no reliquary there');
  return inside;
}

// Whether a walker of half-width r at (x, z) (room tiles) would be in the rock, or in something solid.
export function reliquaryBlocks(inside: Pick<ReliquaryInside, 'plan' | 'props'>, x: number, z: number, r: number): boolean {
  for (const [cx, cz] of [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]]) if (!isFloor(inside.plan, Math.round(cx), Math.round(cz))) return true;
  return inside.props.some((p) => p.solid && x + r > p.x - 0.5 && x - r < p.x + p.w - 0.5 && z + r > p.z - 0.5 && z - r < p.z + p.d - 0.5);
}

export const RELIQUARY_DUNGEON: DungeonKind = {
  place: (entrance) => insides.get(entrance)?.place ?? null,
  room: (_seed, entrance) => reliquaryInside(entrance).room,
  blocks: (_seed, entrance) => {
    const inside = reliquaryInside(entrance);
    return (x, z, r) => reliquaryBlocks(inside, x, z, r);
  },
  foeCount: (_seed, entrance) => reliquaryPosts(reliquaryInside(entrance)).length,
  run: (seed, entrance, slain, hero, hooks) => new ReliquaryRun(seed, reliquaryInside(entrance), slain, hero, hooks),
  barred: (entrance) => insides.get(entrance)?.barred?.() ?? null,
};
