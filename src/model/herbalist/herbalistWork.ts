// A herbalist at home, always at work (npcs.ts spawns them, npcRoutine.ts
// runs their steps like anyone's): round from the cauldron (stirring it)
// to the worktable (grinding, chopping), the drying rack (turning the
// bundles) and the potion shelf; and while the hero's by their counter,
// behind it, to trade (E: herbalistShop.ts). As the smith does (smithWork.ts).

import { distanceTo, type Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';

const AT_COUNTER = 0.6; // tiles behind the counter's middle they stand, against its back (as deep as it's drawn: furniture.ts SLIM)
const SERVE_NEAR = 2.5; // tiles from it the hero draws them to it
const TOWARD_BACK = Math.PI; // facing the back wall (-z)
const TOWARD_DOOR = 0; // facing the door (+z)
const TOWARD_LEFT = -Math.PI / 2; // facing the left wall (-x)
// Their round, and how long at each (seconds).
const ROUND: Array<{ at: Furniture['kind']; for: number }> = [
  { at: 'cauldron', for: 5 },
  { at: 'herbTable', for: 6 },
  { at: 'dryingRack', for: 3 },
  { at: 'cauldron', for: 4 },
  { at: 'potionShelf', for: 2.5 },
];

// Their next steps, for as long as the house stands.
export function herbalistSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  npc.stop++;
  const { furniture } = layoutOf(world.seed, npc.home);
  const counter = furniture.find((f) => f.kind === 'herbCounter');
  const hero = world.inside?.entrance === npc.home ? world.hero : null;
  if (counter && hero && distanceTo(counter, hero.x, hero.z) < SERVE_NEAR) {
    const x = counter.x + (counter.w - 1) / 2;
    const behind = { x, z: counter.z - 1 };
    const at = { x, z: counter.z - AT_COUNTER };
    const there = Math.hypot(npc.x - at.x, npc.z - at.z) < 0.1;
    return [...(there ? [] : [{ kind: 'go', to: behind } as NpcStep]), { kind: 'go', to: at, direct: true, face: TOWARD_DOOR }, { kind: 'wait', for: 1.5 }];
  }
  const job = ROUND[npc.stop % ROUND.length];
  const piece = furniture.find((f) => f.kind === job.at);
  if (!piece) return [{ kind: 'wait', for: 2 }];
  // The tile before it, kept free (herbalistLayout.ts), facing it: on the left wall, beside it, facing the wall.
  const left = piece.wall === 'left';
  const spot = left ? { x: piece.x + piece.w, z: piece.z + (piece.d - 1) / 2 } : { x: piece.x + (piece.w - 1) / 2, z: piece.z + piece.d };
  if (npc.stop === 1) [npc.x, npc.z] = [spot.x, spot.z]; // at work already
  return [{ kind: 'go', to: spot, face: left ? TOWARD_LEFT : TOWARD_BACK }, { kind: 'work', for: job.for }];
}
