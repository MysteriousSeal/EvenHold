// The inn's two barmaids, always at work inside it (npcs.ts spawns them,
// npcRoutine.ts runs their steps like anyone's):
// - the barkeep keeps behind the bar, in the aisle between the bottle
//   shelves and the counter, stopping opposite whoever sits on a stool to
//   serve them (anywhere along the bar when no one does); the tables'
//   orders (the hero at work) all poured in one trip, set down at its end;
//   while the hero has the bar (a shift: jobs/barShift.ts), off her feet by
//   the hearth;
// - the server goes back and forth between the end of the counter and the
//   tables with folk sat round them (none: waiting at the counter's end),
//   pausing at each; behind the hero's bar (jobs/barShift.ts), carrying a
//   table's drinks to it once they're poured (serveTable); while
//   the hero has the tables (a shift: jobs/innShift.ts), off her feet by the
//   hearth, in an armchair if one's free.

import { hashUnit } from '../../util/random';
import type { Point } from '../map/obstacles';
import { distanceTo, seatOf, type Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Room } from '../interiors/interiors';
import type { Drink, Npc, NpcStep } from '../npcs/npcs';
import { mugsAt, roundOnBar, takeMug } from './barMugs';
import { ordersAt, type BarOrder } from './barOrders';
import { say } from '../npcs/speech';
import { onShift } from '../jobs/shiftsAt';

export const AISLE_X = 0.34; // the middle of the aisle behind the bar (shelves end at -0.08, the counter starts at 0.76)
const SERVE_WAIT: [number, number] = [4, 10];
const TABLE_WAIT: [number, number] = [2, 5];
const TO_COUNTER = Math.PI / 2; // behind the bar, facing out across it (+x)
// Where the server waits at the bar, and takes up what's set down for her: just past the counter's end.
export const pickupAt = (counter: Furniture): Point => ({ x: counter.x, z: counter.z + counter.d });
export const AT_KEG = { x: 0.44, z: 0 }; // beside the corner keg's tap (the keg at 0, 0 reaches out to x 0.12), clear of it and the counter (she's 0.25 wide indoors)
const POUR_TIME = 1.4; // seconds bent over the tap
const LINGER = 2; // seconds she stays before whoever she's served, having set it down
const TAKE_ORDER = 2.4; // seconds taking a villager's order, across the bar from them (her question, their answer)
// What's said over an order: her question (by name, often), their answer, her word as it's set down.
const ASK_NAMED = [
  "What'll it be, {name}?",
  'The usual, {name}?',
  'Thirsty, {name}?',
  'Back again, {name}? What are you having?',
  "{name}! I was wondering when you'd turn up.",
  'Long day, {name}? What can I pour you?',
  "Don't tell me, {name}. An ale?",
  "Evening, {name}. Your stool's still warm from last time.",
]
const ASK = [
  'What can I get you, love?',
  'What are you having?',
  "What'll it be?",
  'Something to wet the throat?',
  "You look parched, love. What'll it be?",
  'Name your poison.',
  "Sit yourself down. What'll you have?",
  "What's it to be tonight?",
]
const ANSWERS = [
  'An ale, please.',
  'Ale, and keep it cold.',
  'The usual.',
  'An ale, if you would.',
  "Whatever's frothing.",
  'An ale. A big one.',
  "Ale. It's been that sort of day.",
  'Just an ale, love. And a smile.',
]
const WINE_ANSWERS = [
  'A glass of wine, please.',
  'Wine tonight, I think. The red.',
  "Something finer than ale. Wine, if you've any.",
  "A glass of red. I've earned it.",
]
const HANDED_WINE = ['Your wine, love.', 'A glass of the red.', "Mind, it's the good stuff.", 'Sip it slow, now.']
const HANDED = [
  'There you go.',
  'Enjoy, love.',
  'Mind the foam.',
  'One ale, as asked.',
  "Drink up, there's more where that came from.",
  'Fresh from the keg.',
  "Careful, it's a strong one tonight.",
  "Here. Don't say I never do anything for you.",
]
const pick = (lines: readonly string[], n: number) => lines[Math.floor(hashUnit(n, lines.length, 29) * lines.length)];
const asks = (by: Npc, n: number) => (hashUnit(by.id, n, 31) < 0.5 ? pick(ASK_NAMED, n).replace('{name}', by.name) : pick(ASK, n));
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
  const off = onShift(npc.home) === (npc.role === 'barkeep' ? 'innBarkeep' : 'innServer'); // (the hero has her work)
  if (off) return offHerFeet(npc, npcs, furniture, room);
  npc.resting = false; // (back at it: her word again, next time)
  if (npc.role === 'barkeep') {
    // An order waiting: first come, first served.
    const order = ordersAt(npc.home)[0];
    if (order?.batch) return serveTables(npc, ordersAt(npc.home).filter((o) => o.batch));
    if (order) return serve(npc, order, furniture.find((f) => f.kind === 'bottleShelf'));
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
  // The server: from the end of the counter to a table with folk round it (none: she waits there) and back.
  const pickup = pickupAt(counter);
  const tables = furniture.filter((f) => f.kind === 'tavernTable');
  const busy = tables.filter((t) => furniture.some((f) => f.kind === 'chair' && distanceTo(t, f.x, f.z) <= 0.6 && sat(npcs, npc.home, f)));
  const table = busy[Math.floor(roll(npc, 4) * busy.length)]; // (no empty table waited on)
  const steps: NpcStep[] = [
    { kind: 'go', to: pickup, face: Math.PI }, // facing the counter's end
    { kind: 'wait', for: between(npc, TABLE_WAIT, 5) },
  ];
  const spot = table && beside(table, furniture, room);
  if (spot) steps.push({ kind: 'go', to: spot, faceToward: table }, { kind: 'wait', for: between(npc, TABLE_WAIT, 6) });
  return steps;
}

// A barmaid's break, the hero at her work (the tables, or the bar): sat by the fire (an armchair before it, else the
// chair nearest it), else stood by it; her word the first time.
const BREAK: Record<'barkeep' | 'server', readonly string[]> = {
  server: ['All yours, love. My feet thank you.', "Mind table three, they're thirsty.", "I'll be by the fire if you need me."],
  barkeep: ["The bar's yours. Mind the tap, it sticks.", 'Pour to the line, and keep those tankards washed.', "I'll be by the fire. Shout if the keg runs dry."],
};
function offHerFeet(npc: Npc, npcs: readonly Npc[], furniture: readonly Furniture[], room: Room): NpcStep[] {
  if (npc.seat) return [{ kind: 'wait', for: 5 }]; // (sat already: stays)
  const steps: NpcStep[] = [];
  if (!npc.resting) {
    npc.resting = true;
    npc.serving = false;
    const lines = BREAK[npc.role === 'barkeep' ? 'barkeep' : 'server'];
    steps.push({ kind: 'hand', then: () => say(npc, lines[Math.floor(roll(npc, 7) * lines.length)]) });
  }
  // A seat by the fire: an armchair before it, else the chair nearest it (both taken by villagers: the next best).
  const hearth = furniture.find((f) => f.kind === 'hearth');
  const fromFire = (f: Furniture) => (hearth ? Math.hypot(f.x - hearth.x, f.z - hearth.z) : 0);
  const free = (kind: string) => furniture.filter((f) => f.kind === kind && !sat(npcs, npc.home, f) && !npcs.some((o) => o !== npc && o.steps.some((st) => st.kind === 'sit' && st.seat.piece === f)));
  for (const chair of [...free('armchair'), ...free('chair').sort((a, b) => fromFire(a) - fromFire(b))]) {
    const seat = seatOf(chair);
    const from = beside(chair, furniture, room);
    if (seat && from) return [...steps, { kind: 'go', to: from }, { kind: 'sit', seat, for: 8 }];
  }
  const spot = hearth && beside(hearth, furniture, room);
  return [...steps, ...(spot ? [{ kind: 'go', to: spot, faceToward: hearth } as NpcStep] : []), { kind: 'wait', for: 8 }];
}

// Clearing the mug at a row: over to take it, to the sink to wash it.
function clearMug(barkeep: Npc, z: number): NpcStep[] {
  return [
    { kind: 'go', to: { x: AISLE_X, z }, direct: true, face: TO_COUNTER },
    { kind: 'hand', then: () => (barkeep.carrying = takeMug(barkeep.home, z)?.drink ?? false) }, // the empty cup, in hand
    { kind: 'go', to: AT_SINK, direct: true, face: -Math.PI / 2 }, // facing the washstand
    { kind: 'work', for: PUT_AWAY },
    { kind: 'hand', then: () => (barkeep.carrying = false) },
  ];
}

// The steps of a drink for whoever's sat on `stool`: clear away the cup
// before them first, if there's one (empty or full), go to the keg and pour
// an ale (or to the bottle shelf, `shelf`, for a glass of wine), bring it
// back across the bar to them, and hand it over (`then`).
function drinkFor(barkeep: Npc, stool: Furniture, then: () => void, drink: Drink = 'ale', shelf?: Furniture): NpcStep[] {
  const left = mugsAt(barkeep.home).some((m) => m.z === stool.z); // a cup before them already, empty or not
  const pour: Point = drink === 'wine' && shelf ? { x: AISLE_X, z: shelf.z + shelf.d / 2 - 0.5 } : AT_KEG; // before the bottles, or the keg's tap
  return [
    ...(left ? clearMug(barkeep, stool.z) : []),
    { kind: 'go', to: pour, direct: true, face: -Math.PI / 2 }, // facing the tap, or the bottles
    { kind: 'work', for: POUR_TIME },
    { kind: 'hand', then: () => (barkeep.carrying = drink) },
    { kind: 'go', to: { x: AISLE_X, z: stool.z }, direct: true, face: TO_COUNTER },
    { kind: 'hand', then: () => ((barkeep.carrying = false), then()) },
  ];
}

// Serving the front order: a villager's taken first, across the bar from
// them (the hero calls theirs out); then the drink fetched and handed over,
// the order done.
function serve(barkeep: Npc, order: BarOrder, shelf?: Furniture): NpcStep[] {
  barkeep.serving = true;
  // A word with a villager first: she asks what they'll have, they answer.
  const by = order.by;
  const n = barkeep.stop; // (to vary her words)
  const take: NpcStep[] = by
    ? [
        { kind: 'go', to: { x: AISLE_X, z: order.stool.z }, direct: true, face: TO_COUNTER },
        { kind: 'hand', then: () => say(barkeep, asks(by, n)) },
        { kind: 'wait', for: TAKE_ORDER / 2 },
        { kind: 'hand', then: () => say(by, pick(order.drink === 'wine' ? WINE_ANSWERS : ANSWERS, n + by.id)) },
        { kind: 'wait', for: TAKE_ORDER / 2 },
      ]
    : [];
  return [...take, ...drinkFor(barkeep, order.stool, () => {
    const queue = ordersAt(barkeep.home);
    const at = queue.indexOf(order);
    if (at < 0) return; // (seen to meanwhile: the hero behind her bar, jobs/barShift.ts)
    queue.splice(at, 1);
    if (by) say(barkeep, pick(order.drink === 'wine' ? HANDED_WINE : HANDED, n + 3)); // setting it down before them
    order.served();
  }, order.drink, shelf),
    { kind: 'wait', for: LINGER }, // a moment there with them, for her word (and their thanks): not to be called away
    { kind: 'hand', then: () => (barkeep.serving = false) },
  ];
}

// The tables' orders (the hero at work), all those queued at once: drawn at the tap one after another, a little
// quicker each than a lone one, carried along the bar together and set down at its end; each order done.
const BATCH_POUR = 0.7; // of a lone pour's time, each of the tables' orders
function serveTables(barkeep: Npc, orders: BarOrder[]): NpcStep[] {
  barkeep.serving = true;
  const end = orders[0].stool;
  return [
    { kind: 'go', to: AT_KEG, direct: true, face: -Math.PI / 2 },
    { kind: 'work', for: POUR_TIME * BATCH_POUR * orders.length },
    { kind: 'hand', then: () => (barkeep.carrying = orders[0].drink) },
    { kind: 'go', to: { x: AISLE_X, z: end.z }, direct: true, face: TO_COUNTER },
    {
      kind: 'hand',
      then: () => {
        barkeep.carrying = false;
        const queue = ordersAt(barkeep.home);
        for (const order of orders) {
          const at = queue.indexOf(order);
          if (at < 0) continue; // (let go of meanwhile)
          queue.splice(at, 1);
          order.served();
        }
      },
    },
    { kind: 'wait', for: LINGER / 2 },
    { kind: 'hand', then: () => (barkeep.serving = false) },
  ];
}

// The server, the hero behind the bar (jobs/barShift.ts): a table's drinks taken up at the counter's end, carried to
// it, and set down before them (`then`); the first of them in her hand on the way.
export function serveTable(server: Npc, table: Furniture, drink: Drink, then: () => void, seed: number): void {
  const { room, furniture } = layoutOf(seed, server.home);
  const counter = furniture.find((f) => f.kind === 'counter');
  const pickup = counter ? pickupAt(counter) : { x: server.x, z: server.z };
  const spot = beside(table, furniture, room) ?? pickup;
  server.steps = [
    { kind: 'go', to: pickup, face: Math.PI },
    { kind: 'hand', then: () => (server.carrying = drink) },
    { kind: 'go', to: spot, faceToward: table },
    { kind: 'hand', then: () => ((server.carrying = false), then()) },
    { kind: 'wait', for: LINGER },
  ];
  Object.assign(server, { path: null, waited: 0, working: false });
}

// An ale for whoever's sat on `stool`, now, ahead of any queue (the barkeep
// leaves what she was doing): `then` once it's handed over.
export function pourFor(barkeep: Npc, stool: Furniture, then: () => void): void {
  barkeep.steps = drinkFor(barkeep, stool, then);
  Object.assign(barkeep, { path: null, waited: 0, working: false, carrying: false }); // (a mug she was taking away, put down)
}

// A spot by a table to serve it from: a tile next to it, in the room, with nothing on it
// (none if it's hemmed in: then it's not waited on).
export function beside(table: Furniture, furniture: readonly Furniture[], room: Room): Point | null {
  const around: Point[] = [
    { x: table.x, z: table.z + 1 },
    { x: table.x + 1, z: table.z },
    { x: table.x - 1, z: table.z },
    { x: table.x, z: table.z - 1 },
    { x: table.x + 1, z: table.z + 1 },
    { x: table.x - 1, z: table.z + 1 },
    { x: table.x + 1, z: table.z - 1 },
    { x: table.x - 1, z: table.z - 1 },
  ];
  const inRoom = (p: Point) => p.x >= 0 && p.z >= 0 && p.x < room.width && p.z < room.depth - 1;
  return around.find((p) => inRoom(p) && !furniture.some((f) => f.solid && distanceTo(f, p.x, p.z) === 0)) ?? null;
}
