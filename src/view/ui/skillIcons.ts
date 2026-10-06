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

export const SKILL_ICONS: Record<SkillId, MenuIcon> = { cooking: cookingIcon, fishing: fishingIcon };

// The skills window's tile on the toolbar: a ladle and a rod crossed, the trades at a glance.
export const skillsIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:skills',
    () => {
      // Wood 1, its grip 2, iron 3, its shine 4.
      const grid = createGrid([12, 12, 3]);
      for (let i = 0; i <= 11; i++) fillBox(grid, i, i, 1, i, i, 1, i < 3 ? 2 : 1); // the rod, up to the right
      for (let i = 0; i <= 8; i++) fillBox(grid, 11 - i, i, 2, 11 - i, i, 2, 3); // the ladle's handle, up to the left, over it
      fillBox(grid, 0, 8, 0, 3, 11, 2, 3); // its bowl
      fillBox(grid, 1, 11, 0, 2, 11, 2, 4); // its rim, catching the light
      return { grid, palette: [WOOD, WOOD_DARK, IRON_LIGHT, 0xb4b4be], alpha: 1 };
    },
    size,
  );
