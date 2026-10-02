// A herbalist at home, always at work (npcs.ts spawns them, npcRoutine.ts
// runs their steps like anyone's): round from the cauldron (stirring it)
// to the worktable (grinding, chopping), the drying rack (turning the
// bundles) and the potion shelf; and while the hero's by their counter,
// behind it, to trade (E: herbalistShop.ts). As the smith does (npcs/keeperWork.ts).

import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import { TOWARD_BACK, TOWARD_LEFT, keeperCalled, keeperSteps, type KeeperDay } from '../npcs/keeperWork';

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

// Their next steps, for as long as the house stands.
export const herbalistSteps = (npc: Npc, world: NpcWorld): NpcStep[] => keeperSteps(npc, world, HERBALIST);
export const herbalistCalled = (npc: Npc, world: NpcWorld): boolean => keeperCalled(npc, world, HERBALIST); // (the hero at their counter: their work put down)
