// A herbalist at home, at work all day (npcs.ts spawns them, npcRoutine.ts
// runs their steps like anyone's): round from the cauldron (stirring it)
// to the worktable (grinding, chopping), the drying rack (turning the
// bundles) and the potion shelf; and while the hero's by their counter,
// behind it, to trade (E: herbalistShop.ts). As the smith does (npcs/keeperWork.ts).
// At night, abed, as the villagers are (ABED): their shop shut, the hero at
// the counter not heard (a pox seen to all the same: hero/pox.ts).

import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import { TOWARD_BACK, TOWARD_LEFT, keeperCalled, keeperSteps, type KeeperDay } from '../npcs/keeperWork';
import { START_MINUTES, between } from '../clock';

// Their day (npcs/keeperWork.ts): their counter, their round, and where they stand to work a piece: the tile before
// it, kept free (herbalistLayout.ts), facing it; on the left wall, beside it, facing the wall.
const HERBALIST: KeeperDay = {
  counter: 'herbCounter',
  round: [
    { at: 'cauldron', for: 5 },
    { at: 'herbTable', for: 6 },
    { at: 'dryingRack', for: 3 },
    { at: 'cauldron', for: 4 },
    { at: 'potionShelf', for: 2.5 },
  ],
  spot: (piece) =>
    piece.wall === 'left'
      ? { x: piece.x + piece.w, z: piece.z + (piece.d - 1) / 2, face: TOWARD_LEFT }
      : { x: piece.x + (piece.w - 1) / 2, z: piece.z + piece.d, face: TOWARD_BACK },
};

const ABED: [number, number] = [23, 6]; // the hours they're in bed (the villagers', npcRoutine.ts)
const ABED_FOR = 60; // seconds in it at a time, before they look at the clock again (an hour on the clock: a minute a second)

// Whether a herbalist's abed at `minutes` on the clock (clock.ts).
export const herbalistAbed = (minutes = START_MINUTES): boolean => between(minutes, ...ABED);

// Their next steps, for as long as the house stands: to bed at night, else their work.
export function herbalistSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  if (!herbalistAbed(world.minutes)) return keeperSteps(npc, world, HERBALIST);
  npc.stop++; // (up at dawn: walked to their work from the bed, not set down at it)
  return [{ kind: 'settle', for: ABED_FOR, at: 'bed' }];
}
export const herbalistCalled = (npc: Npc, world: NpcWorld): boolean => !herbalistAbed(world.minutes) && keeperCalled(npc, world, HERBALIST); // (the hero at their counter: their work put down; not their bed)
