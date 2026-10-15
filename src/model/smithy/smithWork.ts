// The smith, at work in his smithy by day (npcs.ts spawns him, npcRoutine.ts
// runs his steps like anyone's): round from the forge to the anvil (hammering
// what's hot, sparks flying), the trough (quenching it) and the grindstone;
// and while the hero's by his counter, behind it, to trade (E: smithShop.ts).
// Of a night, as villagers keep, his work put down and the shop shut, home to
// his house in the village (npcs.ts: a villager's), abed; back come morning.
// (No house: resting in the smithy.)

import type { Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Entrance } from '../interiors/interiors';
import { doorTile } from '../npcs/npcPlaces';
import { START_MINUTES, between } from '../clock';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import { TOWARD_BACK, TOWARD_DOOR, keeperCalled, keeperSteps, type KeeperDay } from '../npcs/keeperWork';

// His day (npcs/keeperWork.ts): his counter, his round, and the spot he stands on to work at a piece (the tile
// before it, kept free for him), facing the back wall (the forge, and what stands before it).
const SMITH: KeeperDay = {
  counter: 'smithCounter',
  round: [
    { at: 'forge', for: 3 },
    { at: 'anvil', for: 5 },
    { at: 'trough', for: 1.6 },
    { at: 'anvil', for: 4 },
    { at: 'grindstone', for: 3.5 },
  ],
  spot: (piece) =>
    piece.kind === 'forge'
      ? { x: piece.x + (piece.w - 1) / 2, z: piece.z + 1, face: TOWARD_BACK } // before the fire, in the row kept free there
      : piece.kind === 'anvil'
        ? { x: piece.x, z: piece.z - 1, face: TOWARD_DOOR } // behind it (the tile kept free there: smithyLayout.ts), across it from the hero at its front
        : { x: piece.x, z: piece.z + piece.d, face: TOWARD_BACK },
  near: 1.2, // (at its front: not the hero just come in at the door, a step from it, nor at work at his anvil)
};
// His day while the hero stands at his anvil (to forge at it themselves: skills/smithing.ts): his work there left
// for the forge, trough and grindstone, not walked into them.
const ANVIL_TAKEN: KeeperDay = { ...SMITH, round: SMITH.round.filter((job) => job.at !== 'anvil') };
const AT_ANVIL = 1.2; // tiles from his spot before the anvil the hero has it

// His spot before the anvil, if the hero has it.
function anvilTaken(npc: Npc, world: NpcWorld): { x: number; z: number } | null {
  const anvil = world.inside?.entrance === npc.home ? layoutOf(world.seed, npc.home).furniture.find((f) => f.kind === 'anvil') : undefined;
  const spot = anvil && SMITH.spot(anvil);
  return spot && Math.hypot(world.hero.x - spot.x, world.hero.z - spot.z) < AT_ANVIL ? spot : null;
}
const dayOf = (npc: Npc, world: NpcWorld): KeeperDay => (anvilTaken(npc, world) ? ANVIL_TAKEN : SMITH);
// Whether he's at the anvil, or on his way, with the hero come to it.
const toAnvil = (npc: Npc, world: NpcWorld): boolean => {
  const spot = anvilTaken(npc, world);
  return !!spot && (npc.steps.some((s) => s.kind === 'go' && Math.hypot(s.to.x - spot.x, s.to.z - spot.z) < 0.1) || (npc.steps[0]?.kind === 'work' && Math.hypot(npc.x - spot.x, npc.z - spot.z) < 0.6));
};

// Whether it's his night (villagers' hours: npcRoutine.ts NIGHT): the forge cold, the shop shut.
const NIGHT = { from: 23, till: 6 };
const NIGHT_REST = 90; // seconds abed at a time (an hour and a half), then a look at the clock
export const smithAsleep = (minutes: number): boolean => between(minutes, NIGHT.from, NIGHT.till);

// Out of where he is and into `to`, if he's not in it already.
const goTo = (npc: Npc, world: NpcWorld, to: Entrance): NpcStep[] =>
  npc.where === to ? [] : [...(npc.where ? [{ kind: 'go', to: doorTile(world.seed, npc.where) } as NpcStep, { kind: 'exit' } as NpcStep] : []), { kind: 'go', to }, { kind: 'enter', entrance: to }];

// His next steps, for as long as the smithy stands: of a night, home and abed; by day, back to the smithy, at work.
export function smithSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  if (smithAsleep(world.minutes ?? START_MINUTES)) return [...goTo(npc, world, npc.house ?? npc.home), { kind: 'settle', for: NIGHT_REST, at: 'bed' }];
  const back = goTo(npc, world, npc.home);
  return back.length ? back : keeperSteps(npc, world, dayOf(npc, world));
}
export const smithCalled = (npc: Npc, world: NpcWorld): boolean => !smithAsleep(world.minutes ?? START_MINUTES) && (keeperCalled(npc, world, SMITH) || toAnvil(npc, world)); // (the hero at his counter: his work put down; at his anvil: his work there)

// Whether a smith is hammering at his anvil (sparks), or quenching at his trough (steam), right now.
export function smithWorking(npc: Npc, at: Furniture): boolean {
  if (npc.role !== 'smith' || !npc.working) return false;
  const spot = SMITH.spot(at);
  return Math.hypot(npc.x - spot.x, npc.z - spot.z) < 0.6;
}
