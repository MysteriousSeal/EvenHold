// What the first arc leaves in the world, as its words say it does (quests/firstQuestsWake.ts, firstQuestsWatch.ts): in
// the chapel yard of the ruin nearest the start, a grave post with her name cut in it once the hero's gone up to stand
// by it (whereSheBurned), plated in iron with four nails once the smith's done it (herNameInIron); three candles burning
// blue by it once the watch is kept (candlesForTheWatch); a slab over the top step of its crypt's stairs once nothing comes
// up them (upHisStairs: "the smith put a slab over the top step anyway"); and the men in grey camped in the ashes of the
// bandits' camp (campedInTheAshes, till silverToTheWell is done): four hoods round its fire, their covered cart and two
// mules outside its gate. Read off how the quests stand, each time it's looked at.

import type { Ruin } from '../ruins/ruins';
import type { Crypt } from '../crypts/crypts';
import type { Camp } from '../camps/camps';

export type StoryPropKind = 'gravePost' | 'ironPost' | 'blueCandle' | 'stepSlab' | 'greyHood' | 'coveredCart' | 'mule';

export interface StoryProp {
  kind: StoryPropKind;
  x: number;
  z: number;
  facing?: number; // radians round the upright, its front (+Z) turned so
}

// Where the first arc's are: the ruin nearest the start, its crypt, the first village's camp.
export interface StoryPlaces {
  ruin: Ruin | null;
  crypt?: Crypt | null;
  camp?: Camp | null;
  isOpenTile?(x: number, z: number): boolean; // (the cart and mules on open ground: slid on out past what's in the way)
}

export interface StoryState {
  stateOf(id: string): 'locked' | 'offered' | 'taken' | 'done';
  did(id: string): boolean;
}

const FROM_ALTAR = 1.6; // tiles before the altar, toward the ruin's middle: the grave
const HOODS: ReadonlyArray<[number, number]> = [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]; // round the fire, (across, along the way in): clear of tents and crates
const CART_OUT = 4.6; // tiles from the camp's middle, out past its gate
const MULES_OUT = 1.3; // tiles on from the cart
const SLIDE = 6; // tiles on out the cart may go, for open ground
const MULE_APART = 0.36;
const CANDLES: ReadonlyArray<[number, number]> = [[-0.32, 0.28], [0.3, 0.3], [0.02, 0.42]]; // round the post's foot, before it

// The ruin's grave: before its altar (a chapel's), else at its middle.
export function graveOf(ruin: Ruin): { x: number; z: number } {
  const [mx, mz] = [ruin.x + (ruin.w - 1) / 2, ruin.z + (ruin.d - 1) / 2];
  const altar = ruin.pieces.find((p) => p.kind === 'altar');
  if (!altar) return { x: mx, z: mz };
  const d = Math.hypot(mx - altar.x, mz - altar.z) || 1;
  return { x: altar.x + ((mx - altar.x) / d) * FROM_ALTAR, z: altar.z + ((mz - altar.z) / d) * FROM_ALTAR };
}

export function storyProps(story: StoryState, { ruin, crypt = null, camp = null, isOpenTile = () => true }: StoryPlaces): StoryProp[] {
  const props: StoryProp[] = [];
  const where = story.stateOf('whereSheBurned');
  if (ruin && (where === 'taken' || where === 'done' || story.did('whereSheBurned'))) {
    // (no post till she's buried: the hero's sent up to it)
    const { x, z } = graveOf(ruin);
    props.push({ kind: story.did('herNameInIron') ? 'ironPost' : 'gravePost', x, z });
    if (story.did('candlesForTheWatch')) for (const [dx, dz] of CANDLES) props.push({ kind: 'blueCandle', x: x + dx, z: z + dz });
  }
  if (crypt && story.did('upHisStairs')) {
    const [a, b] = crypt.steps;
    props.push({ kind: 'stepSlab', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, facing: Math.atan2(b.x - a.x, b.z - a.z) + 0.12 }); // (across both, a touch askew)
  }
  const camped = story.stateOf('campedInTheAshes');
  if (camp && (camped === 'taken' || story.did('campedInTheAshes')) && !story.did('silverToTheWell')) {
    const len = Math.hypot(camp.way.x - camp.x, camp.way.z - camp.z) || 1;
    const [fx, fz] = [(camp.way.x - camp.x) / len, (camp.way.z - camp.z) / len]; // out through the gate
    const at = (across: number, along: number) => ({ x: camp.x + fx * along - fz * across, z: camp.z + fz * along + fx * across });
    for (const [a, b] of HOODS) {
      const p = at(a, b);
      props.push({ kind: 'greyHood', ...p, facing: Math.atan2(camp.x - p.x, camp.z - p.z) }); // (facing the fire)
    }
    const out = Math.atan2(fx, fz);
    const open = (p: { x: number; z: number }) => isOpenTile(Math.round(p.x), Math.round(p.z));
    const along = Array.from({ length: SLIDE + 1 }, (_, i) => CART_OUT + i).find((o) => [at(0, o), at(-MULE_APART, o + MULES_OUT), at(MULE_APART, o + MULES_OUT)].every(open));
    if (along !== undefined) {
      props.push({ kind: 'coveredCart', ...at(0, along), facing: out });
      for (const side of [-1, 1]) props.push({ kind: 'mule', ...at(side * MULE_APART, along + MULES_OUT), facing: out });
    }
  }
  return props;
}

// The first arc's places in the game: the ruin nearest the start, the crypt under it, the camp whose way in its first
// village's quests send the hero to.
export function firstArcPlaces(host: { story: { people: { ruin: Ruin | null; camp: { x: number; z: number } | null } | null }; crypts: readonly Crypt[]; camps: readonly Camp[]; isOpenTile(x: number, z: number): boolean }): StoryPlaces {
  const people = host.story.people;
  const ruin = people?.ruin ?? null;
  const way = people?.camp;
  return { ruin, crypt: (ruin && host.crypts.find((c) => c.ruin === ruin)) ?? null, camp: (way && host.camps.find((c) => c.way.x === way.x && c.way.z === way.z)) ?? null, isOpenTile: (x, z) => host.isOpenTile(x, z) };
}
