// The reliquary under the cathedral (reliquary.ts): the bishop's ossuary, a story place, so hand-shaped, not rolled
// (MAP: the same in every world). Down the charnel stair from the cathedral into the bone nave (pillars of skulls,
// the dead at their posts, bowmen at its far end), a charnel chapel off either side of it (a gilded saint on its
// plinth in each, a Brother praying by the wall); out of the nave's far end the Brothers' walk winding back and up,
// into the saints' gallery (four saints on their plinths); off it east, the room of the old door (the old kingdom's,
// sealed: older than the cathedral, older than the bishops); and on north, up a short way, the Deacon's sanctum: his
// shrine of heaped reliquaries on its dais, caskets along its walls, and in the rock behind it the way out, opened
// once he's fallen.
//
// In room tiles, as any dungeon's (dungeons/floorPlan.ts): x across, z down the map; the stair up at `door` in the
// +Z wall (the map's foot). What each letter is: # rock; . floor; s a skeleton's post, a a bowman's, b a Brother's, g
// a saint's (on its plinth); D where the Deacon forms (on the dais); d the dais; S the shrine; r a reliquary casket; p
// a pillar of skulls; u urns; c candles; x bones; and in the rock: E the way out, O the old door.

import type { FloorPlan } from '../dungeons/floorPlan';
import type { Rect } from '../crypts/cryptLayout';

export const MAP: readonly string[] = [
  '################EE###############',
  '##########..............#########',
  '##########.r.cddddddc.r.#########',
  '##########...ddSSSSdd...#########',
  '##########...ddSSSSdd...#########',
  '##########...dddddddd...#########',
  '##########...cddDdddc...#########',
  '##########..............#########',
  '##########.r..........r.#########',
  '##########..............#########',
  '##########..............#########',
  '##########r............r#########',
  '##########..............#########',
  '################..###############',
  '################..###############',
  '################..###############',
  '###########...cb...c...#####OO###',
  '######......g........g.###u..bx.#',
  '######.................###..s...#',
  '######.s###..r......r...........#',
  '######..###.....s..........x....#',
  '######..###............###..s...#',
  '######b.###.g....s...g.###u....u#',
  '######..###.....r......##########',
  '######.x#########################',
  '######...xb..........############',
  '######....s..........############',
  '###################..############',
  '###################b.############',
  '###################..############',
  '############.........x###########',
  '############.a......a.###########',
  '############..........###########',
  '####rc.b.r##..p....p..##r.b.cr###',
  '####......##..s.......##......###',
  '####.g......................g.###',
  '####..........p....p..........###',
  '####......##.......s..##......###',
  '####c.....##..........##.....c###',
  '############..p....p..###########',
  '############...s......###########',
  '############....x.....###########',
  '############..p....p..###########',
  '############x.........###########',
  '################..###############',
  '################..###############',
  '################..###############',
  '################..###############',
  '################..###############',
  '################..###############',
  '################..###############',
  '################..###############',
];

// Its places, as the hero comes into each (told by name: reliquaryFoes.ts).
export type ReliquaryPlace = 'nave' | 'westChapel' | 'eastChapel' | 'walk' | 'gallery' | 'oldDoor' | 'sanctum';
export const PLACES: Record<ReliquaryPlace, Rect & { name: string }> = {
  nave: { x0: 12, z0: 30, x1: 21, z1: 43, name: 'The bone nave' },
  westChapel: { x0: 4, z0: 33, x1: 9, z1: 38, name: 'The charnel chapel of the west' },
  eastChapel: { x0: 24, z0: 33, x1: 29, z1: 38, name: 'The charnel chapel of the east' },
  walk: { x0: 6, z0: 25, x1: 20, z1: 26, name: "The Brothers' walk" },
  gallery: { x0: 11, z0: 16, x1: 22, z1: 23, name: "The saints' gallery" },
  oldDoor: { x0: 26, z0: 17, x1: 31, z1: 22, name: 'The old door' },
  sanctum: { x0: 10, z0: 1, x1: 23, z1: 12, name: "The Deacon's sanctum" },
};

export type Mark = 's' | 'a' | 'b' | 'g' | 'D' | 'd' | 'S' | 'r' | 'p' | 'u' | 'c' | 'x' | 'E' | 'O';

export interface ReliquaryPlan extends FloorPlan {
  marks: Array<{ x: number; z: number; mark: Mark }>; // every letter but rock and bare floor, in the map's order (row by row)
}

const ROCK = new Set(['#', 'E', 'O']); // (the way out and the old door: in the rock)

// The plan, read from the map once.
let read: ReliquaryPlan | null = null;
export function reliquaryPlan(): ReliquaryPlan {
  if (read) return read;
  const [width, depth] = [MAP[0].length, MAP.length];
  const floor = new Uint8Array(width * depth);
  const marks: ReliquaryPlan['marks'] = [];
  MAP.forEach((row, z) => [...row].forEach((c, x) => {
    if (!ROCK.has(c)) floor[x * depth + z] = 1;
    if (c !== '#' && c !== '.') marks.push({ x, z, mark: c as Mark });
  }));
  return (read = { width, depth, door: MAP[depth - 1].indexOf('.'), floor, marks });
}

// The place (x, z) is in, or null (a way between them).
export const placeAt = (x: number, z: number): ReliquaryPlace | null =>
  (Object.keys(PLACES) as ReliquaryPlace[]).find((p) => x >= PLACES[p].x0 - 0.5 && x <= PLACES[p].x1 + 0.5 && z >= PLACES[p].z0 - 0.5 && z <= PLACES[p].z1 + 0.5) ?? null;
