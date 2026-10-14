// What hangs off a bandit stronghold's people, standing out from the body where a shell can't (who wears what:
// strongholdOutfits.ts): each a small voxel model in the body's own voxels, hung on the torso behind or before it,
// set an eighth of a voxel off every way (so no face of it ever lies on a plane the body's or its shells' do).
// Never items: looks only. Palette first, one between them: leather and its flap, brass, iron, horn and its dark
// tip, the collars' red, fired clay and its stopper, a fletching's white; and the king's fur, his own three tones.
// - a quiver: slung across the back from the left hip to the right shoulder, fletchings at its mouth;
// - a satchel: behind the left hip, its flap buckled;
// - a horn (a runner's signal horn, a quartermaster's powder horn behind him): curved, brass at its ends;
// - fire pots: three on a bandolier down the chest, stoppered;
// - a string of collars: red rings hung at the hip, their spikes bright;
// - a ring of keys: at the hip;
// - a pelt: a wolf's fur down the back, its hem ragged.
import type { VoxelGrid } from '../../../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import type { BodyShape } from '../../bodyVoxels';
import { namedPalette } from '../armorShell';
import { fur } from '../patterns';

const kit = namedPalette({ leather: 0x6b4a33, leatherDark: 0x4a3222, flap: 0x8a6a45, brass: 0xd4b060, iron: 0xa2a8b0, horn: 0xe2d8be, hornTip: 0x3a2a20, red: 0x9c2a22, clay: 0xc4622e, stopper: 0x3a2a1e, fletch: 0xf0e8d8 });
const furs = namedPalette({ fur: 0xcfc4ae, furMid: 0xa39884, furDark: 0x6e6456 });
const { c } = kit;

export interface Hung {
  palette: number[];
  size: [number, number, number];
  where: 'behind' | 'before'; // against the back, or the front
  x: number; // its corner from the body's middle, in a man's voxels (a woman's: drawn in as she's narrower)
  y: number; // and up from the hips
  build(): VoxelGrid;
}
const hung = (where: Hung['where'], size: [number, number, number], x: number, y: number, paint: (g: VoxelGrid) => void, palette = kit.palette): Hung => ({
  palette,
  size,
  where,
  x,
  y,
  build: () => {
    const g = createGrid(size);
    paint(g);
    return g;
  },
});
// A horn: its bell up and out, curving down to its tip.
const horn = (where: Hung['where'], x: number, y: number): Hung =>
  hung(where, [6, 4, 2], x, y, (g) => {
    for (const [row, from, to] of [[3, 4, 5], [2, 3, 4], [1, 1, 3], [0, 0, 1]]) fillBox(g, from, row, 0, to, row, 1, (px) => (px === 5 ? c.brass : px === 0 ? c.hornTip : c.horn));
  });

export const STRONGHOLD_HUNG = {
  quiver: hung('behind', [8, 9, 2], -4, -1, (g) => {
    for (let y = 0; y <= 6; y++) fillBox(g, 6 - y, y, 0, 7 - y, y, 1, y === 0 ? c.leatherDark : c.leather);
    fillBox(g, 0, 7, 0, 1, 7, 1, c.flap); // its mouth
    fillBox(g, 0, 8, 0, 1, 8, 1, (x, _y, z) => ((x + z) % 2 ? c.red : c.fletch)); // the bolts' fletchings
  }),
  satchel: hung('behind', [5, 5, 2], 0, -2, (g) => {
    fillBox(g, 0, 0, 0, 4, 3, 1, (_x, y) => (y >= 2 ? c.flap : c.leather));
    fillBox(g, 0, 0, 0, 4, 0, 1, c.leatherDark);
    setColor(g, 2, 2, 0, c.brass); // its buckle
    for (const x of [1, 3]) fillBox(g, x, 4, 0, x, 4, 1, c.leatherDark); // where its strap's sewn on
  }),
  signalHorn: horn('before', 0, -1),
  powderHorn: horn('behind', 0, -2),
  firePots: hung('before', [7, 7, 2], -4, 1, (g) => {
    for (const [x, y] of [[0, 4], [3, 2], [5, 0]]) {
      fillBox(g, x, y, 0, x + 1, y + 1, 1, c.clay);
      fillBox(g, x, y + 2, 0, x, y + 2, 1, c.stopper);
    }
  }),
  collars: hung('before', [5, 5, 2], 0, -1, (g) => {
    for (const [x0, y0] of [[0, 2], [2, 0]]) for (let x = x0; x <= x0 + 2; x++) for (let y = y0; y <= y0 + 2; y++) if (x !== x0 + 1 || y !== y0 + 1) fillBox(g, x, y, 0, x, y, 1, (x + y) % 2 ? c.red : c.iron); // two rings, studded
  }),
  keys: hung('before', [3, 5, 1], -4, -1, (g) => {
    for (let x = 0; x <= 2; x++) for (let y = 2; y <= 4; y++) if (x !== 1 || y !== 3) setColor(g, x, y, 0, c.brass); // the ring
    for (const x of [0, 2]) fillBox(g, x, 0, 0, x, 1, 0, (_x, y) => (y === 0 ? c.iron : c.brass)); // a key hung either side
  }),
  pelt: hung('behind', [9, 11, 2], -5, -3, (g) => fillBox(g, 0, 0, 0, 8, 10, 1, (x, y, z) => (y < 2 && (x + y) % 2 === 0 ? 0 : fur(x, y, z, [furs.c.fur, furs.c.furMid, furs.c.furDark]))), furs.palette), // (its hem ragged)
} satisfies Record<string, Hung>;
export type StrongholdHungId = keyof typeof STRONGHOLD_HUNG;

// Where a hung thing's corner sits from the torso's joint (the hips), in the body's voxels: flat against the shell
// behind or before, an eighth of a voxel into it; across, drawn in on a narrower build.
export function hungAt(thing: Hung, body: BodyShape): [number, number, number] {
  const [grid, pivot] = [body.grid.torso, body.pivot.torso];
  const z = thing.where === 'behind' ? -pivot[2] - 1 - thing.size[2] + 0.125 : grid[2] - pivot[2] + 1 - 0.125;
  return [Math.round((thing.x * pivot[0]) / 4.5) + 0.125, thing.y + 0.125, z];
}
