// A hedge-witch at home, at her work all day, as a herbalist is (herbalist/herbalistWork.ts; npcs/keeperWork.ts): round
// from the cauldron (muttering over it) to her table, the drying rack and the hearth; and while the hero's by her
// counter, behind it, to be asked (E: witchTeaching.ts). At night, abed as everyone is (23:00 to 06:00): her door
// open, no lesson heard.

import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import { TOWARD_BACK, TOWARD_LEFT, keeperCalled, keeperSteps, type KeeperDay } from '../npcs/keeperWork';
import { START_MINUTES, between } from '../clock';

const WITCH: KeeperDay = {
  counter: 'herbCounter',
  round: [
    { at: 'cauldron', for: 7 },
    { at: 'herbTable', for: 5 },
    { at: 'cauldron', for: 3 },
    { at: 'dryingRack', for: 3 },
  ],
  spot: (piece) =>
    piece.wall === 'left'
      ? { x: piece.x + piece.w, z: piece.z + (piece.d - 1) / 2, face: TOWARD_LEFT }
      : { x: piece.x + (piece.w - 1) / 2, z: piece.z + piece.d, face: TOWARD_BACK },
};

const ABED: [number, number] = [23, 6]; // the hours she's in bed (the villagers', npcRoutine.ts)
const ABED_FOR = 60; // seconds in it at a time, before she looks at the clock again

// Whether a hedge-witch is abed at `minutes` on the clock (clock.ts).
export const witchAbed = (minutes = START_MINUTES): boolean => between(minutes, ...ABED);

// Her next steps: to bed at night, else her work.
export function witchSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  if (!witchAbed(world.minutes)) return keeperSteps(npc, world, WITCH);
  npc.stop++; // (up at dawn: walked to her work from the bed)
  return [{ kind: 'settle', for: ABED_FOR, at: 'bed' }];
}
export const witchCalled = (npc: Npc, world: NpcWorld): boolean => !witchAbed(world.minutes) && keeperCalled(npc, world, WITCH);
