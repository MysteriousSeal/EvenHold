// The spells' icons (model/spells/spells.ts; the spellbook: controller/spells/spellbook.ts; the action bar), small
// voxel models as the skills' are (skillIcons.ts); and the spellbook's own tile on the toolbar, a closed book with a
// mark on its cover.
import type { SpellId } from '../../model/spells/spells';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { colorAt, createGrid, fillBox, setColor } from '../meshes/voxel/voxelShapes';
import { CHICKEN_PALETTE, buildChickenBody, buildChickenHead, buildChickenLeg } from '../meshes/wildlife/chickenVoxels';
import { COW_BODY_PIVOT, COW_HEAD_PIVOT, COW_LEGS, COW_LEG_HEIGHT, COW_LEG_PIVOT, COW_NECK, COW_PALETTE, buildCowBody, buildCowHead, buildCowLeg } from '../meshes/wildlife/cowVoxels';
import { HORSE_BODY_PIVOT, HORSE_HEAD_PIVOT, HORSE_LEGS, HORSE_LEG_HEIGHT, HORSE_LEG_PIVOT, HORSE_NECK, HORSE_PALETTE, buildHorseBody, buildHorseHead, buildHorseLeg } from '../meshes/wildlife/horseVoxels';
import type { MenuIcon } from './menu';
import { voxelIcon } from './voxelIcon';

// A hex: a knot of dark thorn twigs, a violet eye of light at its heart, motes of it thrown off.
const hexIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:hex',
    () => {
      // Thorn 1, its tips 2, the eye 3, its heart 4, motes 5.
      const grid = createGrid([11, 11, 3]);
      for (let i = 1; i <= 9; i++) [fillBox(grid, i, i, 1, i, i, 1, 1), fillBox(grid, i, 10 - i, 1, i, 10 - i, 1, 1)]; // the twigs, crossed
      fillBox(grid, 5, 1, 1, 5, 9, 1, 1);
      fillBox(grid, 1, 5, 1, 9, 5, 1, 1);
      for (const [x, y] of [[1, 1], [9, 1], [1, 9], [9, 9], [5, 0], [5, 10], [0, 5], [10, 5]]) fillBox(grid, x, y, 1, x, y, 1, 2); // their tips
      fillBox(grid, 4, 4, 0, 6, 6, 2, 3); // the eye
      fillBox(grid, 5, 5, 0, 5, 5, 2, 4);
      for (const [x, y] of [[2, 7], [8, 3], [7, 8], [3, 2]]) fillBox(grid, x, y, 2, x, y, 2, 5); // motes
      return { grid, palette: [0x3a2a30, 0x6a4a3a, 0x8a4fd0, 0xe8d0ff, 0xb98af0], alpha: 1 };
    },
    size,
  );

// A mending charm: an open hand, a green leaf laid in its palm, a mote of light over it.
const mendIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:mend',
    () => {
      // Skin 1, its shade 2, the leaf 3, its vein 4, light 5.
      const grid = createGrid([11, 11, 3]);
      fillBox(grid, 2, 1, 1, 8, 5, 1, 1); // the palm
      fillBox(grid, 3, 0, 1, 7, 0, 1, 2); // the wrist
      for (const x of [2, 4, 6, 8]) fillBox(grid, x, 6, 1, x, x === 2 || x === 8 ? 7 : 8, 1, 1); // the fingers
      fillBox(grid, 0, 3, 1, 1, 4, 1, 1); // the thumb
      fillBox(grid, 4, 2, 2, 6, 4, 2, 3); // the leaf
      fillBox(grid, 5, 1, 2, 5, 5, 2, 3);
      fillBox(grid, 5, 2, 2, 5, 4, 2, 4);
      fillBox(grid, 5, 9, 2, 5, 10, 2, 5); // light
      fillBox(grid, 4, 10, 2, 6, 10, 2, 5);
      return { grid, palette: [0xe0b08a, 0xb9865f, 0x5aa84a, 0xa8e08a, 0xf4f0c0], alpha: 1 };
    },
    size,
  );

// The hen-wife's turn: the hen herself, side on (wildlife/chickenVoxels.ts: her body, her head set on it).
const chickenIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:chicken',
    () => {
      const grid = createGrid([5, 12, 10]);
      const put = (part: VoxelGrid, ox: number, oy: number, oz: number) => {
        const [sx, sy, sz] = part.size;
        for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) if (colorAt(part, x, y, z)) setColor(grid, x + ox, y + oy, z + oz, colorAt(part, x, y, z));
      };
      put(buildChickenBody(), 0, 3, 0);
      put(buildChickenHead(), 1, 5, 5);
      for (const x of [1, 3]) put(buildChickenLeg(), x, 0, 3);
      return { grid, palette: CHICKEN_PALETTE, alpha: 1 };
    },
    size,
  );

// A four-legged beast itself, its parts set together as its rig sets them (each part's grid and where its own
// (0, 0, 0) is, in voxels from the middle of it on the ground).
function beast(parts: ReadonlyArray<{ grid: VoxelGrid; at: [number, number, number] }>, palette: number[]): { grid: VoxelGrid; palette: number[]; alpha: number } {
  const low = [0, 1, 2].map((axis) => Math.min(...parts.map((part) => Math.round(part.at[axis]))));
  const high = [0, 1, 2].map((axis) => Math.max(...parts.map((part) => Math.round(part.at[axis]) + part.grid.size[axis])));
  const grid = createGrid([high[0] - low[0], high[1] - low[1], high[2] - low[2]]);
  for (const { grid: part, at } of parts) {
    const [sx, sy, sz] = part.size;
    const [ox, oy, oz] = [0, 1, 2].map((axis) => Math.round(at[axis]) - low[axis]);
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) if (colorAt(part, x, y, z)) setColor(grid, x + ox, y + oy, z + oz, colorAt(part, x, y, z));
  }
  return { grid, palette, alpha: 1 };
}
const from = (at: readonly number[], pivot: readonly number[]): [number, number, number] => [at[0] - pivot[0], at[1] - pivot[1], at[2] - pivot[2]];

// The horse-coper's word: the horse itself (wildlife/horseVoxels.ts).
const horseIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:horse',
    () => beast([{ grid: buildHorseBody(), at: from([0, HORSE_LEG_HEIGHT, 0], HORSE_BODY_PIVOT) }, { grid: buildHorseHead(), at: from(HORSE_NECK, HORSE_HEAD_PIVOT) }, ...HORSE_LEGS.map(([x, z], i) => ({ grid: buildHorseLeg(i < 2), at: from([x, HORSE_LEG_HEIGHT, z], HORSE_LEG_PIVOT) }))], HORSE_PALETTE),
    size,
  );

// The dairymaid's call: the cow herself (wildlife/cowVoxels.ts).
const cowIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:cow',
    () => beast([{ grid: buildCowBody(), at: from([0, COW_LEG_HEIGHT, 0], COW_BODY_PIVOT) }, { grid: buildCowHead(), at: from(COW_NECK, COW_HEAD_PIVOT) }, ...COW_LEGS.map(([x, z], i) => ({ grid: buildCowLeg(i < 2), at: from([x, COW_LEG_HEIGHT, z], COW_LEG_PIVOT) }))], COW_PALETTE),
    size,
  );

// The moon-turn charm: a waning moon, its dark side one colour and its lit side another, a mote of light by it.
const swapIcon: MenuIcon = (size) =>
  voxelIcon(
    'spell:swap',
    () => {
      // The lit side 1, its edge 2, the dark side 3, light 4.
      const grid = createGrid([11, 11, 2]);
      fillBox(grid, 2, 1, 0, 8, 9, 0, (x, y) => {
        const [dx, dy] = [x - 5, y - 5];
        if (dx * dx + dy * dy > 17) return 0;
        const inner = (dx - 2) * (dx - 2) + dy * dy <= 11; // the dark of it, set to one side
        return inner ? 3 : dx <= -3 ? 2 : 1;
      });
      for (const [x, y] of [[9, 9], [1, 2], [10, 4]]) fillBox(grid, x, y, 1, x, y, 1, 4);
      return { grid, palette: [0xf4ecd0, 0xcfc49a, 0x4a3a6a, 0xe8d0ff], alpha: 1 };
    },
    size,
  );

export const SPELL_ICONS: Record<SpellId, MenuIcon> = { hex: hexIcon, mend: mendIcon, chicken: chickenIcon, cow: cowIcon, horse: horseIcon, swap: swapIcon };

// The spellbook's tile: a closed book, leather-bound, its clasp brass, a violet mark on the cover.
export const spellbookIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:spellbook',
    () => {
      // Leather 1, its spine 2, the pages 3, brass 4, the mark 5.
      const grid = createGrid([9, 11, 4]);
      fillBox(grid, 0, 0, 0, 8, 10, 3, 1);
      fillBox(grid, 0, 0, 0, 1, 10, 3, 2); // the spine
      fillBox(grid, 2, 0, 1, 8, 10, 2, 3); // the pages, between the boards
      fillBox(grid, 2, 0, 3, 8, 10, 3, 1);
      fillBox(grid, 2, 0, 0, 8, 10, 0, 1);
      fillBox(grid, 8, 4, 0, 8, 6, 3, 4); // the clasp
      fillBox(grid, 4, 3, 3, 6, 7, 3, 5); // the mark
      fillBox(grid, 3, 4, 3, 7, 6, 3, 5);
      fillBox(grid, 5, 5, 3, 5, 5, 3, 4);
      return { grid, palette: [0x5a3524, 0x3c2218, 0xe8dcc0, 0xc9a13a, 0x8a4fd0], alpha: 1 };
    },
    size,
  );
