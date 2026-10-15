// The keepers of the cathedral town's stalls (townPlan.ts STALLS; their wares: stallShop.ts): one to a stall, living in
// the town's house nearest it (with whoever lives there: npcs.ts). From morning till evening behind their counter,
// facing out onto the square, for anyone to buy from (E: talk.ts, their trade); of a night, home and abed.

import { START_MINUTES, hourAt } from '../clock';
import { doorTile } from '../npcs/npcPlaces';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import type { StallKind } from './townPlan';

export interface Stall {
  x: number;
  z: number;
  kind: StallKind;
  front: [number, number];
}

export const STALL_TITLES: Record<StallKind, string> = { relics: 'Relic-monger', wine: 'Vintner', cloth: 'Clothier', potions: 'Apothecary' };
const OPEN: [number, number] = [7, 20]; // the hours they keep their stall
const BEHIND = 0.62; // tiles from the stall's middle they stand, behind its counter (just past its tile)
const STAND = 20; // seconds at a time, before they look again (the clock gone on: home)
const ABED = 120;

// Where its keeper stands, behind it, and which way they face (out over the counter).
export function stallSpot(stall: Stall): { x: number; z: number; face: number } {
  const [fx, fz] = stall.front;
  return { x: stall.x - fx * BEHIND, z: stall.z - fz * BEHIND, face: Math.atan2(fx, fz) };
}

// Their next steps: to the stall, by day; else home to bed.
export function mongerSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  const hour = hourAt(world.minutes ?? START_MINUTES);
  const steps: NpcStep[] = [];
  const leave = () => {
    if (npc.where) steps.push({ kind: 'go', to: doorTile(world.seed, npc.where) }, { kind: 'exit' });
  };
  if (npc.stall && hour >= OPEN[0] && hour < OPEN[1]) {
    const { face, ...spot } = stallSpot(npc.stall);
    leave();
    steps.push({ kind: 'go', to: spot, face }, { kind: 'wait', for: STAND });
    return steps;
  }
  if (npc.where !== npc.home) {
    leave();
    steps.push({ kind: 'go', to: npc.home }, { kind: 'enter', entrance: npc.home });
  }
  steps.push({ kind: 'settle', for: ABED, at: 'bed' });
  return steps;
}
