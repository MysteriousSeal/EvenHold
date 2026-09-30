// The smith, always at work in his smithy (npcs.ts spawns him, npcRoutine.ts
// runs his steps like anyone's): round from the forge to the anvil (hammering
// what's hot, sparks flying), the trough (quenching it) and the grindstone;
// and while the hero's by his counter, behind it, to trade (E: smithShop.ts).

import { distanceTo, type Furniture } from '../interiors/furniture';
import { layoutOf, type Inside } from '../interiors/indoors';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';

const AT_COUNTER = 0.6; // tiles behind his counter's middle he stands, up against its back (it's a third of a tile deep)
const SERVE_NEAR = 2.5; // tiles from his counter the hero draws him to it
const TALK_RANGE = 2.2; // room tiles: across the counter from him
const TOWARD_BACK = Math.PI; // facing the back wall (-z): the forge, and what stands before it
const TOWARD_DOOR = 0; // facing the door (+z), from behind his counter
// His round, and how long he's at each (seconds).
const ROUND: Array<{ at: Furniture['kind']; for: number }> = [
  { at: 'forge', for: 3 },
  { at: 'anvil', for: 5 },
  { at: 'trough', for: 1.6 },
  { at: 'anvil', for: 4 },
  { at: 'grindstone', for: 3.5 },
];

// The spot he stands on to work at a piece: the tile before it (kept free for him).
function workSpot(piece: Furniture): { x: number; z: number } {
  if (piece.kind === 'forge') return { x: piece.x + (piece.w - 1) / 2, z: piece.z + 1 }; // before the fire, in the row kept free there
  return { x: piece.x, z: piece.z + piece.d };
}

// His next steps, for as long as the smithy stands.
export function smithSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  npc.stop++;
  const { furniture } = layoutOf(world.seed, npc.home);
  const counter = furniture.find((f) => f.kind === 'smithCounter');
  const hero = world.inside?.entrance === npc.home ? world.hero : null;
  if (counter && hero && distanceTo(counter, hero.x, hero.z) < SERVE_NEAR) {
    const x = counter.x + (counter.w - 1) / 2;
    const behind = { x, z: counter.z - 1 }; // the row behind it,
    const at = { x, z: counter.z - AT_COUNTER }; // then up against it
    if (npc.stop === 1) [npc.x, npc.z] = [at.x, at.z]; // there already
    const there = Math.hypot(npc.x - at.x, npc.z - at.z) < 0.1; // (staying put, not round by the row behind again)
    return [
      ...(there ? [] : [{ kind: 'go', to: behind } as NpcStep]),
      { kind: 'go', to: at, direct: true, face: TOWARD_DOOR }, // behind it, across it from the hero
      { kind: 'wait', for: 1.5 },
    ];
  }
  const job = ROUND[npc.stop % ROUND.length];
  const piece = furniture.find((f) => f.kind === job.at);
  if (!piece) return [{ kind: 'wait', for: 2 }];
  const spot = workSpot(piece);
  if (npc.stop === 1) [npc.x, npc.z] = [spot.x, spot.z]; // at work already when the smithy opens
  return [
    { kind: 'go', to: spot, face: TOWARD_BACK },
    { kind: 'work', for: job.for },
  ];
}

// The smith in the room the hero's in, near enough to trade with (E), if any.
export function smithAt(npcs: readonly Npc[], inside: Inside | null, hero: { x: number; z: number }): Npc | null {
  if (!inside) return null;
  return npcs.find((n) => n.role === 'smith' && n.where === inside.entrance && Math.hypot(n.x - hero.x, n.z - hero.z) < TALK_RANGE) ?? null;
}

// Whether a smith is hammering at his anvil (sparks), or quenching at his trough (steam), right now.
export function smithWorking(npc: Npc, at: Furniture): boolean {
  return npc.role === 'smith' && npc.working && Math.hypot(npc.x - at.x, npc.z - (at.z + at.d)) < 0.6;
}
