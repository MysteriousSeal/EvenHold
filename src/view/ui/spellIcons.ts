// The spells' icons (model/spells/spells.ts; the spellbook: controller/spells/spellbook.ts; the action bar), small
// voxel models as the skills' are (skillIcons.ts); and the spellbook's own tile on the toolbar, a closed book with a
// mark on its cover.
import type { SpellId } from '../../model/spells/spells';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
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

export const SPELL_ICONS: Record<SpellId, MenuIcon> = { hex: hexIcon };

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
