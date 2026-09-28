// Icons for the cheat menu: isometric snapshots of the game's own voxel
// models (view/ui/voxelIcon.ts), so they always match the world. People
// and items are drawn by humanFigure, exactly as they're worn; the wolf is
// assembled from its body parts; a lake tile and an ice crystal are small
// models made just for icons.

import { BANDIT_OUTFIT, ITEMS, STARTER_SET, outfit, type Equipment, type ItemId } from '../model/equipment';
import { HERO_LOOK, type BodyLook } from '../model/humanoid';
import type { MenuIcon } from '../view/ui/menu';
import { voxelIcon, type VoxelModel } from '../view/ui/voxelIcon';
import type { VoxelGrid } from '../view/meshes/voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../view/meshes/voxel/voxelShapes';
import { humanFigure } from '../view/meshes/human/humanFigure';
import { WOLF_PALETTE, buildBody, buildHead as buildWolfHead, buildLeg as buildWolfLeg, buildTail } from '../view/meshes/enemy/wolfVoxels';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../view/meshes/building/houseVoxels';
import { HOUSE_PALETTE } from '../view/meshes/building/housePalette';
import { WELL_PALETTE, buildWellVoxels } from '../view/meshes/well/wellVoxels';
import { CAMP_PALETTE, buildTent } from '../view/meshes/camp/campVoxels';
import { LANTERN_PALETTE, buildLanternPost } from '../view/meshes/plaza/lanternVoxels';
import { TREE_PALETTE, buildTreeVoxels } from '../view/meshes/tree/treeVoxels';
import { WATER_DECOR_PALETTE, buildLilyPad } from '../view/meshes/water/waterVoxels';

// Copies several part grids into one, each at its voxel offset.
function compose(size: [number, number, number], parts: Array<[VoxelGrid, number, number, number]>): VoxelGrid {
  const out = createGrid(size);
  for (const [grid, ox, oy, oz] of parts) {
    const [gx, gy, gz] = grid.size;
    for (let z = 0; z < gz; z++) {
      for (let y = 0; y < gy; y++) {
        for (let x = 0; x < gx; x++) {
          const c = grid.cells[x + gx * (y + gy * z)];
          if (c) setColor(out, x + ox, y + oy, z + oz, c);
        }
      }
    }
  }
  return out;
}

const BANDIT_FACE: BodyLook = { skin: 1, hair: 1, hairStyle: 'short', beard: true };
const person = (look: BodyLook | null, equipment: Equipment) => (): VoxelModel => humanFigure(look, equipment);

function wolfModel(): VoxelModel {
  return {
    palette: WOLF_PALETTE,
    grid: compose([7, 17, 29], [
      [buildTail(), 2, 10, 0],
      [buildWolfLeg(), 1, 0, 8],
      [buildWolfLeg(), 4, 0, 8],
      [buildWolfLeg(), 1, 0, 18],
      [buildWolfLeg(), 4, 0, 18],
      [buildBody(), 0, 6, 7],
      [buildWolfHead(), 1, 9, 20],
    ]),
  };
}

// A patch of lake: turquoise water with ripples and a lily pad in bloom.
function lakeModel(): VoxelModel {
  const palette = [0x2a9aac, 0x3dbdb8, 0x9be8da, ...WATER_DECOR_PALETTE];
  const grid = createGrid([11, 4, 11]);
  fillBox(grid, 0, 0, 0, 10, 1, 10, (x, y, z) => (y === 0 ? 1 : (x * 3 + z * 5) % 7 === 0 ? 3 : 2));
  const pad = buildLilyPad(2);
  const [px, py, pz] = pad.size;
  for (let z = 0; z < pz; z++) {
    for (let y = 0; y < py; y++) {
      for (let x = 0; x < px; x++) {
        const c = pad.cells[x + px * (y + py * z)];
        if (c) setColor(grid, x + 1, y + 2, z + 1, c + 3); // after the water colors
      }
    }
  }
  return { grid, palette };
}

// A cluster of ice crystals, tall in the middle.
function iceModel(): VoxelModel {
  const grid = createGrid([7, 11, 7]);
  const spire = (x: number, z: number, h: number) =>
    fillBox(grid, x, 0, z, x + 1, h, z + 1, (_x, y) => (y === h ? 4 : y > h - 3 ? 1 : y % 3 === 0 ? 3 : 2));
  spire(2, 2, 10);
  spire(0, 4, 5);
  spire(5, 1, 6);
  spire(4, 5, 4);
  return { grid, palette: [0xd9f6f2, 0x9be8da, 0x5fb8c9, 0xffffff] };
}

// A menu icon for a model, rendered (and cached) on first use.
const icon = (key: string, model: () => VoxelModel): MenuIcon => (size) => voxelIcon(key, model, size);

// An item on its own, as it sits when worn or held.
export const itemIcon = (item: ItemId): MenuIcon => icon(`item:${item}`, person(null, { [ITEMS[item].slot]: item }));

export const ICONS = {
  // Tabs
  map: icon('well', () => ({ grid: buildWellVoxels(), palette: WELL_PALETTE })),
  hero: icon('hero', person(HERO_LOOK, {})),
  sword: icon('wolf', wolfModel),
  scroll: icon('oak', () => ({ grid: buildTreeVoxels('oak', 0), palette: TREE_PALETTE })),
  // Travel
  village: icon('house', () => ({ grid: buildHouseVoxels(HOUSE_LAYOUTS[0], 0), palette: HOUSE_PALETTE })),
  lake: icon('lake', lakeModel),
  camp: icon('tent', () => ({ grid: buildTent(), palette: CAMP_PALETTE })),
  paw: icon('wolfHead', () => ({ grid: buildWolfHead(), palette: WOLF_PALETTE })),
  flag: icon('lantern', () => ({ grid: buildLanternPost(), palette: LANTERN_PALETTE })),
  // Hero
  boot: itemIcon('leatherBoots'),
  ghost: icon('ghost', () => ({ ...humanFigure(HERO_LOOK, {}), alpha: 0.45 })),
  shield: itemIcon('plankShield'),
  // Enemies
  wolf: icon('wolf', wolfModel),
  bandit: icon('bandit', person(BANDIT_FACE, outfit(BANDIT_OUTFIT))),
  skull: itemIcon('shortSword'),
  frost: icon('ice', iceModel),
  // Wardrobe
  wardrobe: itemIcon('gambeson'),
  naked: icon('naked', person(HERO_LOOK, {})),
  starter: icon('starter', person(HERO_LOOK, outfit(STARTER_SET))),
  banditOutfit: icon('banditOutfit', person(HERO_LOOK, outfit(BANDIT_OUTFIT))),
};
