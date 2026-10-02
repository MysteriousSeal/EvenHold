// Icons for the cheat menu: isometric snapshots of the game's own voxel
// models (view/ui/voxelIcon.ts), so they always match the world. People
// and items are drawn by humanFigure, exactly as they're worn; the wolf is
// assembled from its body parts; a lake tile and an ice crystal are small
// models made just for icons.

import { BANDIT_OUTFIT, STARTER_SET, outfit, type Equipment } from '../../model/human/equipment';
import { HERO_LOOK, type BodyLook } from '../../model/human/humanoid';
import type { MenuIcon } from '../../view/ui/menu';
import { voxelIcon, type VoxelModel } from '../../view/ui/voxelIcon';
import { gearIcon } from '../../view/ui/itemIcons';
import type { VoxelGrid } from '../../view/meshes/voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../../view/meshes/voxel/voxelShapes';
import { humanFigure } from '../../view/meshes/human/humanFigure';
import { SCENERY_PALETTE, buildScenery } from '../../view/meshes/scenery/sceneryVoxels';
import { BLOOM_KINDS, BLOOM_PALETTE, buildBloom } from '../../view/meshes/cover/bloomVoxels';
import { BIRD_PALETTE, birdGrid, butterflyGrid } from '../../view/meshes/wildlife/ambientVoxels';
import type { SceneryKind } from '../../model/scenery/scenery';
import type { BloomKind } from '../../model/scenery/meadowPatches';
import { BOAR_PALETTE, buildBoarHead } from '../../view/meshes/enemy/boarVoxels';
import { WOLF_PALETTE, buildBody, buildHead as buildWolfHead, buildLeg as buildWolfLeg, buildTail } from '../../view/meshes/enemy/wolfVoxels';
import { HOUSE_LAYOUTS, buildHouseVoxels } from '../../view/meshes/building/houseVoxels';
import { HOUSE_PALETTE } from '../../view/meshes/building/housePalette';
import { WELL_PALETTE, buildWellVoxels } from '../../view/meshes/well/wellVoxels';
import { CAMP_PALETTE, buildTent } from '../../view/meshes/camp/campVoxels';
import { LANTERN_PALETTE, buildLanternPost } from '../../view/meshes/plaza/lanternVoxels';
import { TREE_PALETTE, buildTreeVoxels } from '../../view/meshes/tree/treeVoxels';
import { WATER_DECOR_PALETTE, buildLilyPad } from '../../view/meshes/water/waterVoxels';
import { RUIN_PALETTE, buildRuinPiece } from '../../view/meshes/ruin/ruinVoxels';

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

// The hero as a woman (a cheat), her hair in a braid.
export const HEROINE_LOOK: BodyLook = { ...HERO_LOOK, build: 'female', hairStyle: 'braid', beard: false };
const BANDIT_FACE: BodyLook = { build: 'male', dye: 3, skin: 1, hair: 1, hairStyle: 'short', beard: true };
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

// A tuft of meadow: a poppy, a daisy and a bluebell side by side.
function meadowModel(): VoxelModel {
  const grid = createGrid([15, 14, 9]);
  ([['poppy', 0, 1], ['daisy', 4, 0], ['bluebell', 8, 2]] as const).forEach(([kind, ox, oz]) => {
    const part = buildBloom(kind, 1);
    const [sx, sy, sz] = part.size;
    for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
      const c = part.cells[x + sx * (y + sy * z)];
      if (c) setColor(grid, x + ox, y, z + oz, c);
    }
  });
  return { grid, palette: BLOOM_PALETTE };
}

// A firefly, glowing: a bright speck in a softer halo.
function fireflyModel(): VoxelModel {
  const grid = createGrid([3, 3, 3]);
  fillBox(grid, 0, 1, 1, 2, 1, 1, 2);
  fillBox(grid, 1, 0, 1, 1, 2, 1, 2);
  setColor(grid, 1, 1, 1, 1);
  return { grid, palette: [0xf4ff9a, 0xa8d84a] };
}

// An item on its own, as it sits when worn or held.
export const itemIcon = gearIcon;

// Named by what they stand for in the menu.
const wolf = icon('wolf', wolfModel);
const hero = icon('hero', person(HERO_LOOK, {}));
export const ICONS = {
  // Tabs
  travel: icon('well', () => ({ grid: buildWellVoxels(), palette: WELL_PALETTE })),
  hero,
  enemies: wolf,
  wardrobe: itemIcon('gambeson'),
  world: icon('oak', () => ({ grid: buildTreeVoxels('oak', 0), palette: TREE_PALETTE })),
  // Travel
  village: icon('house', () => ({ grid: buildHouseVoxels(HOUSE_LAYOUTS[0], 0), palette: HOUSE_PALETTE })),
  lake: icon('lake', lakeModel),
  camp: icon('tent', () => ({ grid: buildTent(), palette: CAMP_PALETTE })),
  ruin: icon('ruinArch', () => ({ grid: buildRuinPiece('arch', 0), palette: RUIN_PALETTE })),
  wolfPack: icon('wolfHead', () => ({ grid: buildWolfHead(), palette: WOLF_PALETTE })),
  boar: icon('boarHead', () => ({ grid: buildBoarHead(), palette: BOAR_PALETTE })),
  spawn: icon('lantern', () => ({ grid: buildLanternPost(), palette: LANTERN_PALETTE })),
  // Hero
  swiftFeet: itemIcon('leatherBoots'),
  heroine: icon('heroine', person(HEROINE_LOOK, {})),
  noclip: icon('ghost', () => ({ ...humanFigure(HERO_LOOK, {}), alpha: 0.45 })),
  invulnerable: itemIcon('plankShield'),
  // Enemies
  wolf,
  bandit: icon('bandit', person(BANDIT_FACE, outfit(BANDIT_OUTFIT))),
  slay: itemIcon('shortSword'),
  freeze: icon('ice', iceModel),
  // Wardrobe
  undress: hero,
  starterSet: icon('starter', person(HERO_LOOK, outfit(STARTER_SET))),
  banditOutfit: icon('banditOutfit', person(HERO_LOOK, outfit(BANDIT_OUTFIT))),
  // Sights
  ...Object.fromEntries((['boulder', 'outcrop', 'log', 'cairn', 'wall', 'menhir'] as const).map((kind) => [kind, icon(`sight:${kind}`, () => ({ grid: buildScenery(kind, 0), palette: SCENERY_PALETTE }))])) as Record<SceneryKind, MenuIcon>,
  ...Object.fromEntries(BLOOM_KINDS.map((kind) => [kind, icon(`sight:${kind}`, () => ({ grid: buildBloom(kind, 1), palette: BLOOM_PALETTE }))])) as Record<BloomKind, MenuIcon>,
  meadow: icon('sight:meadow', meadowModel),
  butterfly: icon('sight:butterfly', () => ({ grid: butterflyGrid(), palette: [0xf0a33a, 0x2a2420] })),
  bird: icon('sight:bird', () => ({ grid: birdGrid(), palette: BIRD_PALETTE })),
  firefly: icon('sight:firefly', fireflyModel),
};
