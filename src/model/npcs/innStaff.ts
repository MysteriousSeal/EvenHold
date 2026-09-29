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
import type { Room } from '../interiors/interiors';
import type { Npc, NpcStep } from './npcs';
import { mugsAt, roundOnBar, takeMug } from './barMugs';
import { ordersAt, type BarOrder } from './barOrders';

const AISLE_X = 0.34; // the middle of the aisle behind the bar (shelves end at -0.08, the counter starts at 0.76)
const SERVE_WAIT: [number, number] = [4, 10];
const TABLE_WAIT: [number, number] = [2, 5];
const TO_COUNTER = Math.PI / 2; // behind the bar, facing out across it (+x)
export const AT_KEG = { x: 0.44, z: 0 }; // beside the corner keg's tap (the keg at 0, 0 reaches out to x 0.12), clear of it and the counter (she's 0.25 wide indoors)
const POUR_TIME = 1.4; // seconds bent over the tap
const TAKE_ORDER = 1.5; // seconds taking a villager's order, across the bar from them
const PUT_AWAY = 1.2; // seconds washing an empty mug at the sink
export const AT_SINK = { x: AISLE_X, z: 1.5 }; // before the washstand behind the bar (its two tiles at 0, 1..2), facing it

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
  const { room, furniture } = layoutOf(seed, npc.home);
  const counter = furniture.find((f) => f.kind === 'counter');
  if (!counter) return [{ kind: 'wait', for: 10 }];
  const barEnd = counter.z + counter.d - 1;
  if (npc.role === 'barkeep') {
    // An order waiting: first come, first served.
    const order = ordersAt(npc.home)[0];
    if (order) return serve(npc, order);
    npc.serving = false;
    // An empty mug left a while: over to take it, and to the sink to wash it.
    const mug = roundOnBar(npc.home);
    if (mug) return clearMug(npc, mug.z);
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
  if (table) steps.push({ kind: 'go', to: beside(table, furniture, room), faceToward: table }, { kind: 'wait', for: between(npc, TABLE_WAIT, 6) });
  return steps;
}

// Clearing the mug at a row: over to take it, to the sink to wash it.
function clearMug(barkeep: Npc, z: number): NpcStep[] {
  return [
    { kind: 'go', to: { x: AISLE_X, z }, direct: true, face: TO_COUNTER },
    { kind: 'hand', then: () => takeMug(barkeep.home, z) && (barkeep.carrying = true) },
    { kind: 'go', to: AT_SINK, direct: true, face: -Math.PI / 2 }, // facing the washstand
    { kind: 'work', for: PUT_AWAY },
    { kind: 'hand', then: () => (barkeep.carrying = false) },
  ];
}

// The steps of an ale for whoever's sat on `stool`: clear away the mug
// before them first, if there's one (empty or full), go to the keg and pour
// it, bring it back across the bar to them, and hand it over (`then`).
function aleFor(barkeep: Npc, stool: Furniture, then: () => void): NpcStep[] {
  const left = mugsAt(barkeep.home).some((m) => m.z === stool.z); // a mug before them already, empty or not
  return [
    ...(left ? clearMug(barkeep, stool.z) : []),
    { kind: 'go', to: AT_KEG, direct: true, face: -Math.PI / 2 }, // facing the keg's tap
    { kind: 'work', for: POUR_TIME }, // at the tap
    { kind: 'hand', then: () => (barkeep.carrying = true) },
    { kind: 'go', to: { x: AISLE_X, z: stool.z }, direct: true, face: TO_COUNTER },
    { kind: 'hand', then: () => ((barkeep.carrying = false), then()) },
  ];
}

// Serving the front order: a villager's taken first, across the bar from
// them (the hero calls theirs out); then the ale fetched and handed over,
// the order done.
function serve(barkeep: Npc, order: BarOrder): NpcStep[] {
  barkeep.serving = true;
  const take: NpcStep[] = order.by
    ? [
        { kind: 'go', to: { x: AISLE_X, z: order.stool.z }, direct: true, face: TO_COUNTER },
        { kind: 'wait', for: TAKE_ORDER }, // a word with them
      ]
    : [];
  return [...take, ...aleFor(barkeep, order.stool, () => {
    const queue = ordersAt(barkeep.home);
    queue.splice(queue.indexOf(order), 1);
    barkeep.serving = false;
    order.served();
  })];
}

// An ale for whoever's sat on `stool`, now, ahead of any queue (the barkeep
// leaves what she was doing): `then` once it's handed over.
export function pourFor(barkeep: Npc, stool: Furniture, then: () => void): void {
  barkeep.steps = aleFor(barkeep, stool, then);
  Object.assign(barkeep, { path: null, waited: 0, working: false, carrying: false }); // (a mug she was taking away, put down)
}

// A spot by a table to serve it from: a tile next to it, in the room, with nothing on it.
function beside(table: Furniture, furniture: readonly Furniture[], room: Room): Point {
  const around: Point[] = [
    { x: table.x, z: table.z + 1 },
    { x: table.x + 1, z: table.z },
    { x: table.x - 1, z: table.z },
    { x: table.x, z: table.z - 1 },
    { x: table.x + 1, z: table.z + 1 },
    { x: table.x - 1, z: table.z + 1 },
  ];
  const inRoom = (p: Point) => p.x >= 0 && p.z >= 0 && p.x < room.width && p.z < room.depth - 1;
  return around.find((p) => inRoom(p) && !furniture.some((f) => f.solid && distanceTo(f, p.x, p.z) === 0)) ?? { x: table.x, z: table.z };
}
