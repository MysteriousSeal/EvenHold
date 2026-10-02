// A keeper at work in their own place (the smith in his smithy:
// smithy/smithWork.ts; a herbalist at home: herbalist/herbalistWork.ts),
// their steps run like anyone's (npcRoutine.ts): while the hero's by their
// counter, behind it, facing them across it, to trade; else round their
// work, from piece to piece (`round`), each worked a while from its spot.

import { distanceTo, type Furniture, type FurnitureKind } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Npc, NpcStep } from './npcs';
import type { NpcWorld } from './npcRoutine';

const AT_COUNTER = 0.6; // tiles behind the counter's middle they stand, up against its back (as deep as it's drawn: furniture.ts SLIM)
const SERVE_NEAR = 2.5; // tiles from the counter the hero draws them to it
export const TOWARD_BACK = Math.PI; // facing the back wall (-z)
export const TOWARD_DOOR = 0; // facing the door (+z), from behind the counter
export const TOWARD_LEFT = -Math.PI / 2; // facing the left wall (-x)

export interface KeeperDay {
  counter: FurnitureKind; // where they trade
  round: ReadonlyArray<{ at: FurnitureKind; for: number }>; // their work, and how long at each (seconds)
  spot(piece: Furniture): { x: number; z: number; face: number }; // where they stand to work a piece, and which way they face
}

// Their counter, if the hero's at it (in their place, near it), else null.
function served(npc: Npc, world: NpcWorld, day: KeeperDay): Furniture | null {
  const counter = layoutOf(world.seed, npc.home).furniture.find((f) => f.kind === day.counter);
  const hero = world.inside?.entrance === npc.home ? world.hero : null;
  return counter && hero && distanceTo(counter, hero.x, hero.z) < SERVE_NEAR ? counter : null;
}

// Whether to put down their work (at it, or on their way to it: the counter's steps hold none), the hero come to
// their counter.
export const keeperCalled = (npc: Npc, world: NpcWorld, day: KeeperDay): boolean => npc.steps.some((s) => s.kind === 'work') && !!served(npc, world, day);

// Their next steps, for as long as their place stands.
export function keeperSteps(npc: Npc, world: NpcWorld, day: KeeperDay): NpcStep[] {
  npc.stop++;
  const { furniture } = layoutOf(world.seed, npc.home);
  const counter = served(npc, world, day);
  if (counter) {
    const x = counter.x + (counter.w - 1) / 2;
    const behind = { x, z: counter.z - 1 }; // the row behind it,
    const at = { x, z: counter.z - AT_COUNTER }; // then up against it
    if (npc.stop === 1) [npc.x, npc.z] = [at.x, at.z]; // there already
    const there = Math.hypot(npc.x - at.x, npc.z - at.z) < 0.1; // (staying put, not round by the row behind again)
    return [...(there ? [] : [{ kind: 'go', to: behind } as NpcStep]), { kind: 'go', to: at, direct: true, face: TOWARD_DOOR }, { kind: 'wait', for: 1.5 }];
  }
  const job = day.round[npc.stop % day.round.length];
  const piece = furniture.find((f) => f.kind === job.at);
  if (!piece) return [{ kind: 'wait', for: 2 }];
  const { face, ...spot } = day.spot(piece);
  if (npc.stop === 1) [npc.x, npc.z] = [spot.x, spot.z]; // at work already when their place opens
  return [{ kind: 'go', to: spot, face }, { kind: 'work', for: job.for }];
}
