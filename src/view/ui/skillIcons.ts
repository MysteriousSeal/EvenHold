// The skills' icons (model/skills/skills.ts; the skills window: controller/skills/skillsPanel.ts), small voxel models
// as the toolbar's are (itemIcons.ts): a cooking pot, a rod with a fish on the line; and the window's own tile on the
// toolbar, a ladle and a rod crossed.

import type { SkillId } from '../../model/skills/skills';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import type { MenuIcon } from './menu';
import { voxelIcon } from './voxelIcon';

const WOOD = 0x8a5a35;
const WOOD_DARK = 0x5e3a20;
const IRON = 0x3a3a44;
const IRON_LIGHT = 0x6a6a76;

// A black iron pot on three short legs, its rim lighter, a stew bubbling in it, a bail handle over it, a wisp of steam.
const cookingIcon: MenuIcon = (size) =>
  voxelIcon(
    'skill:cooking',
    () => {
      // Iron 1, its rim 2, the stew 3, its bubbles 4, steam 5.
      const grid = createGrid([10, 12, 10]);
      for (const [x, z] of [[2, 2], [7, 2], [4, 7]]) fillBox(grid, x, 0, z, x, 1, z, 1); // the legs
      fillBox(grid, 2, 2, 1, 7, 6, 8, 1); // the body, its corners cut round
      fillBox(grid, 1, 2, 2, 8, 6, 7, 1);
      fillBox(grid, 2, 7, 1, 7, 7, 8, 2); // the rim
      fillBox(grid, 1, 7, 2, 8, 7, 7, 2);
      fillBox(grid, 2, 7, 2, 7, 7, 7, 3); // the stew, just under it
      for (const [x, z] of [[3, 4], [6, 5], [4, 6]]) fillBox(grid, x, 8, z, x, 8, z, 4); // bubbles
      for (const x of [1, 8]) fillBox(grid, x, 8, 4, x, 9, 5, 2); // the handle's ears, up from the rim
      fillBox(grid, 1, 10, 4, 8, 10, 5, 1); // its bail, across
      fillBox(grid, 5, 9, 7, 5, 9, 7, 5); // steam, curling up
      fillBox(grid, 6, 10, 7, 6, 10, 7, 5);
      fillBox(grid, 5, 11, 7, 5, 11, 7, 5);
      return { grid, palette: [IRON, IRON_LIGHT, 0xc8742a, 0xf0b060, 0xece6da], alpha: 1 };
    },
    size,
  );

// A wooden rod rising on the slant, its grip darker and a reel on it, a line down from its tip to a fish on the hook.
const fishingIcon: MenuIcon = (size) =>
  voxelIcon(
    'skill:fishing',
    () => {
      // Wood 1, its grip 2, the reel 3, the line 4, the fish 5, its back and eye 6.
      const grid = createGrid([12, 12, 3]);
      for (let i = 0; i <= 10; i++) fillBox(grid, i, i, 1, Math.min(11, i + 1), i, 1, i < 3 ? 2 : 1); // the rod, a step at a time
      fillBox(grid, 2, 3, 0, 3, 4, 2, 3); // the reel
      fillBox(grid, 11, 4, 1, 11, 10, 1, 4); // the line, down from the tip
      fillBox(grid, 8, 1, 1, 11, 3, 1, 5); // the fish, hooked
      fillBox(grid, 8, 3, 1, 10, 3, 1, 6); // its back
      fillBox(grid, 7, 0, 1, 7, 0, 1, 5); // its tail
      fillBox(grid, 7, 4, 1, 7, 4, 1, 5);
      fillBox(grid, 11, 2, 0, 11, 2, 0, 6); // its eye
      return { grid, palette: [WOOD, WOOD_DARK, IRON, 0xe0dccf, 0x8cb8d8, 0x4a7290], alpha: 1 };
    },
    size,
  );

// A hatchet bitten into the top of a tree stump, the stump's rings showing round it, its handle up and away.
const lumberjackingIcon: MenuIcon = (size) =>
  voxelIcon(
    'skill:lumberjacking',
    () => {
      // Bark 1, its dark 2, the cut wood 3, its rings 4, the handle 5, iron 6, its edge 7.
      const grid = createGrid([12, 11, 12]);
      const [cx, cz] = [5.5, 5.5];
      for (let x = 0; x < 12; x++) {
        for (let z = 0; z < 12; z++) {
          const d = Math.hypot(x - cx, z - cz);
          if (d > 4.7) continue;
          fillBox(grid, x, 0, z, x, 3, z, (bx, by, bz) => (d > 3.7 ? ((bx + by * 2 + bz) % 4 === 0 ? 2 : 1) : 3)); // the stump: bark round, wood in
          fillBox(grid, x, 4, z, x, 4, z, d > 3.7 ? 1 : Math.round(d) % 2 === 0 ? 4 : 3); // its top, the rings
        }
      }
      fillBox(grid, 4, 4, 5, 6, 6, 6, 6); // the hatchet's head, bitten in
      fillBox(grid, 4, 4, 5, 4, 5, 6, 7); // its edge, in the wood
      for (let i = 0; i <= 4; i++) fillBox(grid, 7 + i, 6 + i, 5, 7 + i, 6 + i, 6, 5); // its handle, up and away
      return { grid, palette: [0x6e4a30, 0x4e3220, 0xe0b878, 0xb88850, WOOD, IRON_LIGHT, 0xc8ccd4], alpha: 1 };
    },
    size,
  );

// A saw resting across a plank: the plank in pine, its grain; the saw's steel blade, its bright teeth, its wooden handle.
const woodworkingIcon: MenuIcon = (size) =>
  voxelIcon(
    'skill:woodworking',
    () => {
      // The plank 1, its grain 2, steel 3, the teeth 4, the handle 5.
      const grid = createGrid([12, 4, 9]);
      fillBox(grid, 0, 0, 2, 11, 1, 6, (x, y, z) => (y === 1 && z === 4 && x % 3 !== 1 ? 2 : 1)); // the plank
      fillBox(grid, 1, 2, 3, 8, 2, 5, (x, _y, z) => (z === 3 ? (x % 2 === 0 ? 4 : 0) : 3)); // the blade, its teeth along an edge
      fillBox(grid, 9, 2, 3, 11, 3, 5, (x, y, z) => (x === 10 && y === 3 && z === 4 ? 0 : 5)); // its handle, a grip cut through it
      return { grid, palette: [0xe0a868, 0xc08848, 0xa8b0b8, 0xe8ecf0, WOOD_DARK], alpha: 1 };
    },
    size,
  );

export const SKILL_ICONS: Record<SkillId, MenuIcon> = { lumberjacking: lumberjackingIcon, woodworking: woodworkingIcon, cooking: cookingIcon, fishing: fishingIcon };

// The skills window's tile on the toolbar: a fish in a frying pan, lying flat as on a table, the trades (caught,
// then cooked) at a glance. The pan round in iron, its rim raised dark, its handle in wood out to the front; the fish
// across it, silver-blue, its back darker, its tail fanned, an eye.
export const skillsIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:skills',
    () => {
      // The pan 1, its rim 2, the handle 3, the fish 4, its back 5, its eye 6, its belly 7.
      const grid = createGrid([16, 3, 14]);
      const [cx, cz, r] = [6.5, 6.5, 6.2];
      for (let x = 0; x < 14; x++) {
        for (let z = 0; z < 14; z++) {
          const d = Math.hypot(x - cx, z - cz);
          if (d > r) continue;
          fillBox(grid, x, 0, z, x, 0, z, 1); // the pan's floor
          if (d > r - 1.2) fillBox(grid, x, 1, z, x, 1, z, 2); // its rim, raised
        }
      }
      // The fish, lying in it head to the right: its back, its flank, its belly, a row each; its head to a point, an
      // eye; its tail fanned out behind, forked.
      fillBox(grid, 5, 1, 5, 9, 1, 5, 5);
      fillBox(grid, 4, 1, 6, 10, 1, 7, 4);
      fillBox(grid, 5, 1, 8, 9, 1, 8, 7);
      fillBox(grid, 11, 1, 6, 11, 1, 7, 4);
      fillBox(grid, 9, 1, 6, 9, 1, 6, 6); // the eye
      fillBox(grid, 3, 1, 5, 3, 1, 8, 4); // the tail's root, widening
      fillBox(grid, 2, 1, 4, 2, 1, 5, 4); // fanned out, forked (a notch between)
      fillBox(grid, 2, 1, 8, 2, 1, 9, 4);
      fillBox(grid, 12, 1, 6, 15, 1, 7, 3); // the handle, out from the rim
      fillBox(grid, 12, 2, 6, 12, 2, 7, 2); // where it's riveted on
      return { grid, palette: [0x55555f, 0x2c2c34, WOOD, 0x9cc4dc, 0x5a86a6, 0x1e2a36, 0xd8ecf4], alpha: 1 };
    },
    size,
  );
