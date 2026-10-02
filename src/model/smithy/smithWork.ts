// The smith, always at work in his smithy (npcs.ts spawns him, npcRoutine.ts
// runs his steps like anyone's): round from the forge to the anvil (hammering
// what's hot, sparks flying), the trough (quenching it) and the grindstone;
// and while the hero's by his counter, behind it, to trade (E: smithShop.ts).

import type { Furniture } from '../interiors/furniture';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import { TOWARD_BACK, keeperCalled, keeperSteps, type KeeperDay } from '../npcs/keeperWork';

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
      : { x: piece.x, z: piece.z + piece.d, face: TOWARD_BACK },
};

// His next steps, for as long as the smithy stands.
export const smithSteps = (npc: Npc, world: NpcWorld): NpcStep[] => keeperSteps(npc, world, SMITH);
export const smithCalled = (npc: Npc, world: NpcWorld): boolean => keeperCalled(npc, world, SMITH); // (the hero at his counter: his work put down)

// Whether a smith is hammering at his anvil (sparks), or quenching at his trough (steam), right now.
export function smithWorking(npc: Npc, at: Furniture): boolean {
  return npc.role === 'smith' && npc.working && Math.hypot(npc.x - at.x, npc.z - (at.z + at.d)) < 0.6;
}
