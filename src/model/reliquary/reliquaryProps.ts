// What stands in the reliquary (its plan's letters: reliquaryPlan.ts), and what hangs on its walls: reliquary caskets,
// pillars of skulls and urns (solid); candles and bones (underfoot); a plinth under every saint and the dais under the
// Deacon's shrine (raised: floorHeight); the shrine itself, his heap of reliquaries (solid); on the rock, skull niches
// (one behind every Brother, the wall he prays in), sconces along the ways, the old door, and the way out.

import { FACINGS, cellKey } from '../map/grid';
import { inFullView, isFloor } from '../dungeons/floorPlan';
import { DAIS_TOP } from '../crypts/cryptProps';
import { reliquaryPlan, type Mark, type ReliquaryPlan } from './reliquaryPlan';

export type ReliquaryPropKind = 'casket' | 'pillar' | 'urns' | 'candles' | 'bones' | 'plinth' | 'dais' | 'shrine' | 'niche' | 'sconce' | 'oldDoor';

export interface ReliquaryProp {
  kind: ReliquaryPropKind;
  x: number; // its first tile
  z: number;
  w: number;
  d: number;
  facing: number; // quarter turns (0 +z, 1 +x, 2 -z, 3 -x): a wall piece's, the floor it looks out on
  solid: boolean;
  variant: number; // 0..3
}

const OF_MARK: Partial<Record<Mark, ReliquaryPropKind>> = { r: 'casket', p: 'pillar', u: 'urns', c: 'candles', x: 'bones', g: 'plinth' };
const SOLID: ReadonlySet<ReliquaryPropKind> = new Set(['casket', 'pillar', 'urns', 'shrine']);
const SCONCE_EVERY = 5; // tiles of wall between sconces, about
const NICHE_EVERY = 3; // and between niches

// What's in it, worked out once.
let made: ReliquaryProp[] | null = null;
export function reliquaryProps(): ReliquaryProp[] {
  if (made) return made;
  const plan = reliquaryPlan();
  const props: ReliquaryProp[] = [];
  const variant = (x: number, z: number) => (x * 7 + z * 13) % 4;
  const put = (kind: ReliquaryPropKind, x: number, z: number, w = 1, d = 1, facing = 0) => props.push({ kind, x, z, w, d, facing, solid: SOLID.has(kind), variant: variant(x, z) });
  for (const { x, z, mark } of plan.marks) {
    const kind = OF_MARK[mark];
    if (kind) put(kind, x, z, 1, 1, variant(z, x));
  }
  // The dais (two of the crypts' great halls', side by side) and the shrine on it.
  const [dais, shrine] = [boundsOf(plan, 'dD'), boundsOf(plan, 'S')];
  for (let x = dais.x0; x <= dais.x1; x += 4) put('dais', x, dais.z0, Math.min(4, dais.x1 - x + 1), dais.z1 - dais.z0 + 1);
  put('shrine', shrine.x0, shrine.z0, shrine.x1 - shrine.x0 + 1, shrine.z1 - shrine.z0 + 1, 0);
  // The old door, in the rock (facing the room before it).
  const old = boundsOf(plan, 'O');
  put('oldDoor', old.x0, old.z0, old.x1 - old.x0 + 1, 1, 0);
  // On the rock in full view: a niche behind every Brother; then niches and sconces along the rest, so many tiles apart.
  const hung = new Set<string>([...plan.marks.filter((m) => m.mark === 'E' || m.mark === 'O').map((m) => cellKey(m.x, m.z))]);
  const wallOf = (x: number, z: number) => FACINGS.map(([dx, dz], facing) => ({ x: x - dx, z: z - dz, facing })).find((w) => w.facing <= 1 && !isFloor(plan, w.x, w.z) && inFullView(plan, w.x, w.z) && !hung.has(cellKey(w.x, w.z)));
  const hang = (kind: ReliquaryPropKind, x: number, z: number) => {
    const wall = wallOf(x, z);
    if (!wall) return false;
    hung.add(cellKey(wall.x, wall.z));
    put(kind, wall.x, wall.z, 1, 1, wall.facing);
    return true;
  };
  for (const { x, z, mark } of plan.marks) if (mark === 'b') hang('niche', x, z);
  let along = 0;
  for (let z = 0; z < plan.depth; z++) for (let x = 0; x < plan.width; x++) {
    if (!isFloor(plan, x, z) || !wallOf(x, z)) continue;
    along++;
    if (along % SCONCE_EVERY === 0) hang('sconce', x, z);
    else if (along % NICHE_EVERY === 0) hang('niche', x, z);
  }
  return (made = props);
}

// The bounds of the tiles marked with any of `marks`.
function boundsOf(plan: ReliquaryPlan, marks: string): { x0: number; z0: number; x1: number; z1: number } {
  const at = plan.marks.filter((m) => marks.includes(m.mark));
  return { x0: Math.min(...at.map((m) => m.x)), z0: Math.min(...at.map((m) => m.z)), x1: Math.max(...at.map((m) => m.x)), z1: Math.max(...at.map((m) => m.z)) };
}

// The tiles something solid stands on.
export const solidTiles = (props: readonly ReliquaryProp[]): Set<string> =>
  new Set(props.filter((p) => p.solid).flatMap((p) => Array.from({ length: p.w * p.d }, (_, i) => cellKey(p.x + (i % p.w), p.z + Math.floor(i / p.w)))));

// How high the floor stands at (x, z): up on the dais or a saint's plinth, a step over the rest (as a crypt's dais).
export function floorHeight(props: readonly ReliquaryProp[], x: number, z: number): number {
  const on = props.some((p) => (p.kind === 'dais' || p.kind === 'plinth') && x >= p.x - 0.5 && x <= p.x + p.w - 0.5 && z >= p.z - 0.5 && z <= p.z + p.d - 0.5);
  return on ? DAIS_TOP : 0;
}

// The way out, in the rock behind the shrine (its two tiles' middle), and where to stand for it.
export function wayOut(plan: ReliquaryPlan): { door: { x: number; z: number }; spot: { x: number; z: number } } {
  const e = plan.marks.filter((m) => m.mark === 'E');
  const x = (Math.min(...e.map((m) => m.x)) + Math.max(...e.map((m) => m.x))) / 2;
  return { door: { x, z: e[0].z }, spot: { x, z: e[0].z + 1 } };
}
