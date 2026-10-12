// A village's hedge-witch: a woman in a shawl who keeps to a corner of the herbalist's hut (npcs.ts makes one where
// there's a herbalist), out of the herbalist's way, facing the room. Spoken to (E), she teaches charms for coin
// (spells/teaching.ts; her window: controller/trade/charmPanel.ts).
import { layoutOf } from '../interiors/indoors';
import type { Point } from '../map/obstacles';
import { TOWARD_BACK, TOWARD_DOOR } from './keeperWork';
import { roomFree } from './npcWalk';
import type { Npc, NpcStep } from './npcs';

const STAND = 30; // seconds between looks to her place (she's there already)
const CLEAR = 1.5; // room tiles kept from the herbalist's counter and the door

// Her place: a free tile off in a corner (the fewest free tiles round it: on no one's way), clear of the counter and
// the door, the farthest back of those.
export function witchPost(npc: Pick<Npc, 'home'>, seed: number): Point {
  const { room, furniture } = layoutOf(seed, npc.home);
  const free = roomFree(seed, npc.home);
  const counter = furniture.find((f) => f.kind === 'herbCounter');
  const far = (p: Point, x: number, z: number) => Math.hypot(p.x - x, p.z - z);
  const clear = (p: Point) => far(p, room.door, room.depth - 1) > CLEAR && (!counter || far(p, counter.x + (counter.w - 1) / 2, counter.z) > CLEAR + 0.5);
  const tiles: Point[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) if (free(x, z)) tiles.push({ x, z });
  const open = (p: Point) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => free(p.x + dx, p.z + dz)).length;
  const best = (tiles.some(clear) ? tiles.filter(clear) : tiles).sort((a, b) => open(a) - open(b) || a.z - b.z || b.x - a.x)[0];
  return best ?? { x: room.door, z: room.depth - 2 };
}

// Her next steps: at her place, facing the room (toward the door; from the front rows, the back).
export function witchSteps(npc: Npc, seed: number): NpcStep[] {
  npc.stop++;
  const post = witchPost(npc, seed);
  if (npc.stop === 1) [npc.x, npc.z] = [post.x, post.z]; // there already when the hut opens
  const { room } = layoutOf(seed, npc.home);
  return [{ kind: 'go', to: post, face: post.z >= room.depth - 2 ? TOWARD_BACK : TOWARD_DOOR }, { kind: 'wait', for: STAND }];
}
