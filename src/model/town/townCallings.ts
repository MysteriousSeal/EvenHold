// Greyminster's people by their calling (the story's parts in the cathedral town: story/storyCast.ts, its second
// arc's quests, story/quests/saintQuestsTown.ts), one each, spawned with the town's folk (npcs/npcs.ts): the bishop,
// at the Minster by day before his altar and abed in his quarters by night; the deacon, at the lectern; Sister Agnes,
// keeping the pilgrims' hospice (the town's house nearest its inn); the captain of the witch-finders, by the south gate
// by day and at his hall (the house nearest it) by night; and the prisoner in the cell by the Minster's door, behind
// its bars. (The pardoner keeps a relic stall: stallKeepers.ts, as its monger would.)

import { START_MINUTES, hourAt } from '../clock';
import { doorTile } from '../npcs/npcPlaces';
import type { Npc, NpcStep } from '../npcs/npcs';
import type { NpcWorld } from '../npcs/npcRoutine';
import type { Entrance } from '../interiors/interiors';
import type { Village } from '../types';
import { TOWARD_BACK, TOWARD_DOOR } from '../npcs/keeperWork';
import { CELL, LECTERN } from '../cathedral/cathedralLayout';
import { WALL } from './townPlan';
import { inTurn } from '../npcs/speech';

export type Calling = 'bishop' | 'deacon' | 'sister' | 'captain' | 'prisoner';
export const CALLINGS: readonly Calling[] = ['bishop', 'deacon', 'sister', 'captain', 'prisoner'];
export const CALLING_TITLES: Record<Calling | 'pardoner', string> = { bishop: 'Bishop', deacon: 'Deacon', sister: 'Sister', captain: 'Captain', prisoner: 'Prisoner', pardoner: 'Pardoner' };
const WOMEN: ReadonlySet<Calling> = new Set(['sister']);
const DAY: [number, number] = [7, 21]; // the hours they're about their calling
const STAND = 30; // seconds at a time, before they look again
const BEFORE_ALTAR = 1.6; // tiles out from the back wall the bishop stands, before his altar
const GATE_IN = 2; // tiles in from the south gate the captain stands

// Where each lives and who they are: their door, their village (the town), where they're named from, a woman or not.
export function callingsOf(town: Village, minster: Entrance, houses: readonly Entrance[], inn: Entrance | null): Array<{ calling: Calling; home: Entrance; at: { x: number; z: number }; woman: boolean }> {
  const nearestTo = (x: number, z: number) => houses.reduce<Entrance | null>((best, h) => (!best || Math.hypot(h.x - x, h.z - z) < Math.hypot(best.x - x, best.z - z) ? h : best), null);
  const hospice = inn ? nearestTo(inn.x, inn.z) : null;
  const hall = nearestTo(town.x, town.z + WALL);
  const homes: Record<Calling, Entrance | null> = { bishop: minster, deacon: minster, sister: hospice, captain: hall, prisoner: minster };
  return CALLINGS.flatMap((calling, i) => {
    const home = homes[calling];
    return home ? [{ calling, home, at: { x: town.x + 0.37 * (i + 1), z: town.z - 0.29 * (i + 1) }, woman: WOMEN.has(calling) }] : [];
  });
}

// Their next steps, by their calling and the hour.
export function callingSteps(npc: Npc, world: NpcWorld): NpcStep[] {
  const hour = hourAt(world.minutes ?? START_MINUTES);
  const day = hour >= DAY[0] && hour < DAY[1];
  const steps: NpcStep[] = [];
  const leave = () => {
    if (npc.where) steps.push({ kind: 'go', to: doorTile(world.seed, npc.where) }, { kind: 'exit' });
  };
  const into = (place: Entrance) => {
    if (npc.where === place) return;
    leave();
    steps.push({ kind: 'go', to: place }, { kind: 'enter', entrance: place });
  };
  if (npc.role === 'prisoner') {
    Object.assign(npc, { where: npc.home, x: CELL[0], z: CELL[1], facing: TOWARD_BACK }); // (behind the bars, always: never walked there, looking out)
    return [{ kind: 'wait', for: STAND }];
  }
  if (npc.role === 'captain' && day) {
    leave();
    steps.push({ kind: 'go', to: { x: npc.village.x, z: npc.village.z + WALL - GATE_IN }, face: TOWARD_DOOR }, { kind: 'wait', for: STAND });
    return steps;
  }
  into(npc.home);
  if (day && (npc.role === 'bishop' || npc.role === 'deacon')) {
    const spot = npc.role === 'bishop' ? { x: LECTERN[0] - 1, z: BEFORE_ALTAR, face: TOWARD_DOOR } : { x: LECTERN[0], z: LECTERN[1] - 0.8, face: TOWARD_DOOR }; // (the deacon behind the lectern, reading out to the nave)
    steps.push({ kind: 'go', to: { x: spot.x, z: spot.z }, face: spot.face }, { kind: 'wait', for: STAND });
    return steps;
  }
  steps.push({ kind: 'settle', for: STAND * 2, at: day ? undefined : 'bed' });
  return steps;
}

// What each says, spoken to with nothing of the story's to say (in turn: npcs/speech.ts).
const WORDS: Record<Calling, readonly string[]> = {
  bishop: ['Bless you, child. The offertory box is by the door.', 'The saint provides. Through me, chiefly.', 'Kneel, if your knees allow. Pay, if they do not.', 'We are all sinners. Some of us are also on the chapter.'],
  deacon: ['Hush. His Grace is at prayer. Or at lunch.', 'The relic is shown on feast days. And on other days, for a consideration.', 'Read? Yes. Believe? That is above my station.'],
  sister: ['Wipe your feet. Two hundred souls sleep on that straw.', 'If you have bread, I have mouths.', 'Healed, every one of them. Mind you do not catch it.'],
  captain: ['Move along. Unless you have something to tell me.', 'Walls keep things out. Gates let me look at what comes in.', 'Witches? None today. The day is young.'],
  prisoner: ['Is that you? Get me out of here.', "It's a finger. A deacon's finger. I carried it myself.", 'They feed me twice a day and pray at me three times.'],
};
export const callingWord = (npc: Npc): string => inTurn(npc, WORDS[npc.role as Calling] ?? ['...']);
export const isCalling = (role: string): role is Calling => (CALLINGS as readonly string[]).includes(role);
