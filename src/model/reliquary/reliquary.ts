// The reliquary under the cathedral: the cathedral town's own dungeon (one to a world, as the town is), its way down a
// stair inside the Minster (placed by the town: registerReliquary, `stair` the room it's in and where; or a door out
// of doors, as a crypt's, with none), the same hand-shaped plan in every world
// (reliquaryPlan.ts), its props (reliquaryProps.ts), its dead and the Gilded Deacon (reliquaryFoes.ts). A kind of
// dungeon as a crypt is (dungeons/dungeonTypes.ts): gone into as a room is, its stair up at its door; what's slain
// in it kept by its key in the save. Barred till the story opens it (the Minster's stair kept locked till Sister Agnes
// gives up the key: model.story.saint.open, read as it's found; always open where there's no such story).

const BARRED = { title: 'The ossuary door is barred', line: 'Sister Agnes keeps the key.' };
type Game = { story?: unknown };
const storyBars = (game: Game): typeof BARRED | null => {
  const saint = (game.story as { saint?: { open?: boolean } } | undefined)?.saint;
  return saint && !saint.open ? BARRED : null;
};

import type { Entrance, Room } from '../interiors/interiors';
import type { DungeonKind, DungeonPlace } from '../dungeons/dungeonTypes';
import { isFloor } from '../dungeons/floorPlan';
import { reliquaryPlan, type ReliquaryPlan } from './reliquaryPlan';
import { reliquaryProps, type ReliquaryProp } from './reliquaryProps';
import { ReliquaryRun, reliquaryPosts } from './reliquaryFoes';

export const RELIQUARY_NAME = "the bishop's ossuary"; // (the story's name for it too)
export const RELIQUARY_LEVEL = 13; // (the cathedral town's at about 12: a level past it)

export interface ReliquaryInside {
  plan: ReliquaryPlan;
  props: ReliquaryProp[];
  place: DungeonPlace;
  room: Room; // as a room: its plan's bounds, the stair up at its door
  barred: (game: Game) => { title: string; line: string } | null; // what's told at its door while it's barred, or null: open
  stair?: Stair; // the way down from a room (the Minster's), if it's not a door out of doors
}

// A stair down from inside a building: the room's way in (`of`), and the stair's middle in its room tiles.
export interface Stair {
  of: Entrance;
  x: number;
  z: number;
}
export const STAIR_REACH = 1.6; // tiles from the stair's middle the hero can go down it
const stairs = new Map<Entrance, { to: Entrance; stair: Stair }>(); // by the room it's in

const insides = new WeakMap<Entrance, ReliquaryInside>();

// The reliquary down this way in (the cathedral town's, placed with it): `at` the town's spot (its key in the save),
// its name and level if not the usual.
export function registerReliquary(entrance: Entrance, at: { x: number; z: number }, more: { name?: string; level?: number; barred?: ReliquaryInside['barred']; stair?: Stair } = {}): void {
  const plan = reliquaryPlan();
  const place: DungeonPlace = { kind: 'reliquary', name: more.name ?? RELIQUARY_NAME, level: more.level ?? RELIQUARY_LEVEL, key: `reliquary:${at.x},${at.z}` };
  insides.set(entrance, { plan, props: reliquaryProps(), place, room: { width: plan.width, depth: plan.depth, door: plan.door, floor: 'flagstones', wall: 'stone' }, barred: more.barred ?? storyBars, stair: more.stair });
  if (more.stair) stairs.set(more.stair.of, { to: entrance, stair: more.stair });
}

// The way down from inside the room gone in by `room` (its stair in reach of `hero`), or null.
export function stairDown(room: Entrance, hero: { x: number; z: number }): Entrance | null {
  const down = stairs.get(room);
  return down && Math.hypot(hero.x - down.stair.x, hero.z - down.stair.z) <= STAIR_REACH ? down.to : null;
}

// The stair the reliquary down `entrance` was gone down by (to come back up it), or null: a door out of doors.
export const stairUp = (entrance: Entrance): Stair | null => insides.get(entrance)?.stair ?? null;

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
  barred: (entrance, game) => insides.get(entrance)?.barred(game) ?? null,
};
