// The inn's bouncer: a burly man in studded leather (his own kit, worn by no
// one else: items/, wornBy 'bouncer'), one to every inn. He keeps to his
// post beside the door, facing into the room, a minute or so; then makes a
// round of the room (two open spots near it, a look at each, about 15
// seconds) and is back at his post. Never behind the bar, never upstairs,
// never sitting.
// Now and then on a round he has a word for the room. Spoken to (E), he has a gruff word or two.

import type { Point } from '../map/obstacles';
import { layoutOf } from '../interiors/indoors';
import type { Npc, NpcStep } from '../npcs/npcs';
import { between, roll } from '../npcs/npcPlaces';
import { roomFree } from '../npcs/npcWalk';
import { say } from '../npcs/speech';
import { oneOf } from '../../util/random';

const AT_POST: [number, number] = [45, 75]; // seconds at his post between rounds
const LOOK: [number, number] = [1.5, 3]; // seconds looking round at each spot of a round
const INTO_ROOM = Math.PI; // facing into the room from beside the door
const ROUND_SPOTS = 2; // spots looked in at, each round
const ROUND_WORD = 0.35; // of a round's having a word for the room, at one of its spots
const ROUND_REACH = 4; // room tiles from his post, the farthest a round takes him (a round: about 15 seconds)

export const BOUNCER_LINES = [
  'Keep it civil.',
  'No brawling in here.',
  'Mind your manners, friend.',
  "Trouble? Not in this inn.",
  "I've got my eye on you.",
  'Drink your ale and behave.',
  'Swords stay sheathed in here.',
  "Step outside if you've a quarrel.",
  'Quiet night. Let it stay that way.',
  'Hmph.',
];

// Said to the room, looking round it.
export const ROUND_LINES = [
  'Easy, lads.',
  'Who spilled this? Mop it up, or lick it up.',
  "Another round of trouble and you're out on your arse.",
  'Hands where I can see them.',
  "You. Yes, you. Pay for that, or I'll take it out of your hide.",
  'Sing if you like. Badly is fine. Brawling is not.',
  "Last fellow who started something in here is still picking his teeth out of the road.",
];

// His next stop: at his post a while (every other stop), else a round of the room.
export function bouncerSteps(npc: Npc, seed: number): NpcStep[] {
  npc.stop++;
  const post = postOf(npc, seed);
  if (npc.stop === 1) [npc.x, npc.z] = [post.x, post.z]; // there already when the inn opens
  if (npc.stop % 2 === 1) return [{ kind: 'go', to: post, face: INTO_ROOM }, { kind: 'wait', for: between(npc, AT_POST, 1) }];
  const word = roll(npc, 20) < ROUND_WORD ? Math.floor(roll(npc, 21) * ROUND_SPOTS) : -1; // (at which spot, if any)
  return Array.from({ length: ROUND_SPOTS }, (_, k): NpcStep[] => [
    { kind: 'go', to: openSpot(npc, seed, post, 3 + k) },
    ...(k === word ? [{ kind: 'hand', then: () => say(npc, oneOf(ROUND_LINES, roll(npc, 22))) } as NpcStep] : []),
    { kind: 'wait', for: between(npc, LOOK, 10 + k) },
  ]).flat();
}

// His post: right beside the door, inside, back to the front wall (off the door's own column, the way in).
export function postOf(npc: Npc, seed: number): Point {
  const { room } = layoutOf(seed, npc.home);
  const free = roomFree(seed, npc.home);
  const options: Point[] = [1, -1, 2, -2].flatMap((dx) => [room.depth - 1, room.depth - 2].map((z) => ({ x: room.door + dx, z })));
  return options.find((p) => p.x >= 0 && p.x < room.width && free(p.x, p.z)) ?? { x: room.door, z: room.depth - 2 };
}

// A floor tile of the main room within ROUND_REACH of his post that he fits on (where the
// patrons may go: not behind the bar), picked from his routine.
function openSpot(npc: Npc, seed: number, post: Point, salt: number): Point {
  const { room } = layoutOf(seed, npc.home);
  const free = roomFree(seed, npc.home);
  const tiles: Point[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 1; z < room.depth - 1; z++) if (free(x, z) && Math.hypot(x - post.x, z - post.z) <= ROUND_REACH) tiles.push({ x, z });
  return oneOf(tiles, roll(npc, salt)) ?? post;
}

// Spoken to: a gruff word, a different one each time.
let spoken = 0;
export function bouncerSpeaks(npc: Npc): void {
  say(npc, BOUNCER_LINES[(npc.id + spoken++) % BOUNCER_LINES.length]);
}
