// Icons for the cheat menu: isometric snapshots of the game's own voxel
// models (view/ui/voxelIcon.ts), so they always match the world. The hero,
// the bandit and the wolf are assembled from their body parts; a lake tile,
// a shield and an ice crystal are small models made just for icons.

import type { MenuIcon } from '../view/ui/menu';
import { voxelIcon, type VoxelModel } from '../view/ui/voxelIcon';
import type { VoxelGrid } from '../view/meshes/voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../view/meshes/voxel/voxelShapes';
import { HERO_PALETTE, buildArm, buildHead, buildLeg, buildTorso } from '../view/meshes/hero/heroVoxels';
import { BANDIT_PALETTE, BANDIT_PARTS, buildSword } from '../view/meshes/enemy/banditVoxels';
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

// A human on the rig's layout: legs, torso, arms at the sides (the right
// hand on -X), head on top; all facing +Z.
function human(parts: { leg(): VoxelGrid; torso(): VoxelGrid; arm(): VoxelGrid; head(): VoxelGrid }, extra: Array<[VoxelGrid, number, number, number]> = []): VoxelGrid {
  return compose([11, 18, 15], [
    [parts.leg(), 2, 0, 2],
    [parts.leg(), 6, 0, 2],
    [parts.torso(), 2, 5, 2],
    [parts.arm(), 0, 5, 3],
    [parts.arm(), 9, 5, 3],
    [parts.head(), 2, 11, 0],
    ...extra,
  ]);
}

const heroModel = (): VoxelModel => ({ grid: human({ leg: buildLeg, torso: buildTorso, arm: buildArm, head: buildHead }), palette: HERO_PALETTE });

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

// A kite shield in lake turquoise with a gold boss and iron rim.
function shieldModel(): VoxelModel {
  const grid = createGrid([9, 11, 2]);
  for (let y = 0; y < 11; y++) {
    const half = y >= 5 ? 4 : Math.max(0, Math.floor(y * 0.8));
    for (let x = 4 - half; x <= 4 + half; x++) {
      const rim = x === 4 - half || x === 4 + half || y === 10 || y === 0;
      setColor(grid, x, y, 0, 4);
      setColor(grid, x, y, 1, rim ? 4 : x < 4 ? 2 : 1);
    }
  }
  fillBox(grid, 3, 5, 1, 5, 7, 1, 3); // gold boss
  return { grid, palette: [0x3dbdb8, 0x217c98, 0xf0c64a, 0x8a9098] };
}

// A leather traveller's boot, toe toward +Z: sole, laced shaft, folded cuff.
function bootModel(): VoxelModel {
  const grid = createGrid([5, 10, 9]);
  fillBox(grid, 0, 0, 0, 4, 0, 8, 4); // sole
  fillBox(grid, 0, 1, 0, 4, 2, 8, (_x, y, z) => (z >= 7 && y === 2 ? 2 : 1)); // foot, toe cap
  fillBox(grid, 0, 3, 0, 4, 7, 4, (x, y, z) => (z === 4 && x === 2 && y % 2 === 1 ? 3 : 1)); // shaft with lacing
  fillBox(grid, 0, 8, 0, 4, 9, 4, 2); // folded cuff
  return { grid, palette: [0x7a5236, 0x5e3f28, 0xc2a26b, 0x2e2420] };
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

export const ICONS = {
  // Tabs
  map: icon('well', () => ({ grid: buildWellVoxels(), palette: WELL_PALETTE })),
  hero: icon('hero', heroModel),
  sword: icon('wolf', wolfModel),
  scroll: icon('oak', () => ({ grid: buildTreeVoxels('oak', 0), palette: TREE_PALETTE })),
  // Travel
  village: icon('house', () => ({ grid: buildHouseVoxels(HOUSE_LAYOUTS[0], 0), palette: HOUSE_PALETTE })),
  lake: icon('lake', lakeModel),
  camp: icon('tent', () => ({ grid: buildTent(), palette: CAMP_PALETTE })),
  paw: icon('wolfHead', () => ({ grid: buildWolfHead(), palette: WOLF_PALETTE })),
  flag: icon('lantern', () => ({ grid: buildLanternPost(), palette: LANTERN_PALETTE })),
  // Hero
  boot: icon('boot', bootModel),
  ghost: icon('ghost', () => ({ ...heroModel(), alpha: 0.45 })),
  shield: icon('shield', shieldModel),
  // Enemies
  wolf: icon('wolf', wolfModel),
  bandit: icon('bandit', () => ({ grid: human(BANDIT_PARTS, [[buildSword(), 0, 5, 4]]), palette: BANDIT_PALETTE })),
  skull: icon('sword', () => ({ grid: buildSword(), palette: BANDIT_PALETTE })),
  frost: icon('ice', iceModel),
};
