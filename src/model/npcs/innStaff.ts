// The inn's two barmaids, always at work inside it (npcs.ts spawns them,
// npcRoutine.ts runs their steps like anyone's):
// - the barkeep keeps behind the bar, in the aisle between the bottle
//   shelves and the counter, stopping opposite whoever sits on a stool to
//   serve them (anywhere along the bar when no one does);
// - the server goes back and forth between the end of the counter and the
//   tables, the ones with folk sat round them first, pausing at each.

import { hashUnit } from '../../util/random';
import type { Point } from '../obstacles';
import { distanceTo, type Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Npc, NpcStep } from './npcs';

const AISLE_X = 0.34; // the middle of the aisle behind the bar (shelves end at -0.08, the counter starts at 0.76)
const SERVE_WAIT: [number, number] = [4, 10];
const TABLE_WAIT: [number, number] = [2, 5];
const TO_COUNTER = Math.PI / 2; // behind the bar, facing out across it (+x)

const roll = (npc: Npc, salt: number) => hashUnit(npc.id, npc.stop * 7 + salt, npc.salt);
const between = (npc: Npc, [a, b]: [number, number], salt: number) => a + roll(npc, salt) * (b - a);

// Who's sat on a piece of furniture in the inn right now.
const sat = (npcs: readonly Npc[], inn: Npc['home'], piece: Furniture) => npcs.some((o) => o.where === inn && o.seat?.piece === piece);

// A barmaid's next steps, for as long as the inn stands (on her first
// round she's already at her first spot: at work when the inn opens).
export function staffSteps(npc: Npc, npcs: readonly Npc[], seed: number): NpcStep[] {
  const steps = rounds(npc, npcs, seed);
  if (npc.stop === 1 && steps[0].kind === 'go') {
    npc.x = steps[0].to.x;
    npc.z = steps[0].to.z;
  }
  return steps;
}

function rounds(npc: Npc, npcs: readonly Npc[], seed: number): NpcStep[] {
  npc.stop++;
  const { furniture } = layoutOf(seed, npc.home);
  const counter = furniture.find((f) => f.kind === 'counter');
  if (!counter) return [{ kind: 'wait', for: 10 }];
  const barEnd = counter.z + counter.d - 1;
  if (npc.role === 'barkeep') {
    // Opposite a patron at the bar, or somewhere along it.
    const patrons = furniture.filter((f) => f.kind === 'barStool' && sat(npcs, npc.home, f));
    const z = patrons.length > 0 ? patrons[Math.floor(roll(npc, 1) * patrons.length)].z : 1 + Math.floor(roll(npc, 2) * barEnd);
    return [
      { kind: 'go', to: { x: AISLE_X, z }, direct: true, face: TO_COUNTER },
      { kind: 'wait', for: between(npc, SERVE_WAIT, 3) },
    ];
  }
  // The server: from the end of the counter to a table (one with folk round it, if any) and back.
  const pickup: Point = { x: counter.x, z: barEnd + 1 };
  const tables = furniture.filter((f) => f.kind === 'tavernTable');
  const busy = tables.filter((t) => furniture.some((f) => f.kind === 'chair' && distanceTo(t, f.x, f.z) <= 0.6 && sat(npcs, npc.home, f)));
  const choice = busy.length > 0 ? busy : tables;
  const table = choice[Math.floor(roll(npc, 4) * choice.length)];
  const steps: NpcStep[] = [
    { kind: 'go', to: pickup, face: Math.PI }, // facing the counter's end
    { kind: 'wait', for: between(npc, TABLE_WAIT, 5) },
  ];
  if (table) steps.push({ kind: 'go', to: beside(table, furniture), faceToward: table }, { kind: 'wait', for: between(npc, TABLE_WAIT, 6) });
  return steps;
}

// A spot by a table to serve it from: a tile next to it with nothing on it.
function beside(table: Furniture, furniture: readonly Furniture[]): Point {
  const around: Point[] = [
    { x: table.x, z: table.z + 1 },
    { x: table.x + 1, z: table.z },
    { x: table.x - 1, z: table.z },
    { x: table.x, z: table.z - 1 },
    { x: table.x + 1, z: table.z + 1 },
    { x: table.x - 1, z: table.z + 1 },
  ];
  return around.find((p) => !furniture.some((f) => f.solid && distanceTo(f, p.x, p.z) === 0)) ?? { x: table.x, z: table.z + 1 };
}
