// Icons for things the hero carries, rendered from their own voxel models
// (voxelIcon.ts): gear as it sits when worn or held, loot as it lies.

import { ITEMS, type EquipSlot, type ItemId } from '../../model/human/equipment';
import type { LootId } from '../../model/loot/loot';
import { LOOT } from '../../model/loot/loot';
import type { BagItem } from '../../model/hero/bag';
import { humanBust, humanFigure } from '../meshes/human/humanFigure';
import type { BodyLook } from '../../model/human/humanoid';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { ITEM_MODELS } from '../meshes/human/gear/itemModels';
import { LOOT_MODELS } from '../meshes/loot/lootModels';
import type { MenuIcon } from './menu';
import { voxelIcon } from './voxelIcon';

// Gear as it sits when worn or held; jewelry, its own little model.
export const gearIcon = (item: ItemId): MenuIcon => (size) =>
  voxelIcon(
    `item:${item}`,
    () => {
      const jewel = ITEM_MODELS[item].jewel;
      return jewel ? { grid: jewel.build(), palette: ITEM_MODELS[item].palette } : humanFigure(null, { [ITEMS[item].slot]: item });
    },
    size,
  );

export const lootIcon = (item: LootId): MenuIcon => (size) =>
  voxelIcon(`loot:${item}`, () => ({ grid: LOOT_MODELS[item].build(), palette: LOOT_MODELS[item].palette }), size);

// What an empty slot shows: a small voxel model of what goes there (a
// helmet, a gauntlet, a boot...), made just for that, rendered like every
// other icon but all in one faded sand tone, like an empty slot's ghost.
const GHOST = 0x8a6a45;

// Fills a box and gives back the grid, for building the models below.
function shape(size: [number, number, number], draw: (box: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, on?: boolean) => void) => void): VoxelGrid {
  const grid = createGrid(size);
  draw((x0, y0, z0, x1, y1, z1, on = true) => fillBox(grid, x0, y0, z0, x1, y1, z1, on ? 1 : 0));
  return grid;
}

const GHOSTS: Record<EquipSlot, () => VoxelGrid> = {
  // A stepped dome of a helmet, a rim at the bottom, the face open around a nose guard.
  head: () =>
    shape([12, 12, 12], (box) => {
      box(0, 0, 0, 11, 0, 11);
      box(1, 1, 1, 10, 8, 10);
      box(2, 9, 2, 9, 9, 9);
      box(3, 10, 3, 8, 10, 8);
      box(4, 11, 4, 7, 11, 7);
      box(3, 2, 9, 8, 5, 10, false); // the face
      box(5, 2, 9, 6, 5, 10); // nose guard
    }),
  // A pair of pauldrons, stepped domes on a strap across the back.
  shoulders: () =>
    shape([16, 6, 7], (box) => {
      for (const x of [0, 10]) {
        box(x, 0, 0, x + 5, 3, 6);
        box(x + 1, 4, 1, x + 4, 4, 5);
        box(x + 2, 5, 2, x + 3, 5, 4);
      }
      box(6, 3, 1, 9, 4, 2);
    }),
  // A breastplate with shoulders and a notch for the neck.
  torso: () =>
    shape([14, 13, 6], (box) => {
      box(2, 0, 0, 11, 10, 5);
      box(0, 7, 0, 13, 11, 5);
      box(5, 9, 3, 8, 11, 5, false);
      box(2, 0, 5, 11, 0, 5, false);
    }),
  // A gauntlet: a flared cuff, the back of the hand, four fingers and a thumb.
  hands: () =>
    shape([9, 14, 5], (box) => {
      box(0, 0, 0, 7, 3, 4);
      box(1, 4, 0, 6, 9, 3);
      for (const x of [1, 3, 5]) box(x, 10, 0, x, 13, 2);
      box(6, 10, 0, 6, 12, 2);
      box(7, 5, 1, 8, 8, 2); // thumb
    }),
  // Trousers: a belted waist and two legs.
  legs: () =>
    shape([11, 14, 5], (box) => {
      box(0, 10, 0, 10, 13, 4);
      box(0, 0, 0, 4, 10, 4);
      box(6, 0, 0, 10, 10, 4);
    }),
  // A tall boot, its toe to the front, a turned-down cuff at the top.
  feet: () =>
    shape([6, 14, 11], (box) => {
      box(0, 0, 0, 5, 3, 10);
      box(0, 4, 0, 5, 12, 5);
      box(0, 13, 0, 5, 13, 6);
      box(0, 0, 10, 5, 1, 10, false);
    }),
  // An amulet: a chain loop and a stone hanging from it.
  neck: () =>
    shape([11, 17, 3], (box) => {
      box(0, 7, 1, 0, 16, 1);
      box(10, 7, 1, 10, 16, 1);
      box(0, 16, 1, 10, 16, 1);
      box(1, 6, 1, 2, 6, 1);
      box(8, 6, 1, 9, 6, 1);
      box(3, 0, 0, 7, 5, 2);
      box(4, 6, 0, 6, 6, 2);
    }),
  // A ring standing up: a thick band, a stone on top in its setting.
  ring: () =>
    shape([11, 14, 3], (box) => {
      box(0, 0, 0, 10, 10, 2);
      box(2, 2, 0, 8, 8, 2, false);
      box(3, 11, 0, 7, 11, 2);
      box(4, 12, 0, 6, 13, 2);
    }),
  // A sword standing up: pommel, grip, crossguard, a long blade.
  mainHand: () =>
    shape([8, 20, 2], (box) => {
      box(2, 0, 0, 5, 1, 1);
      box(3, 2, 0, 4, 4, 1);
      box(0, 5, 0, 7, 6, 1);
      box(2, 7, 0, 5, 18, 1);
      box(3, 19, 0, 4, 19, 1);
    }),
  // A shield narrowing to its foot in steps, a boss in the middle.
  offHand: () =>
    shape([12, 16, 3], (box) => {
      box(0, 5, 0, 11, 15, 1);
      box(1, 3, 0, 10, 4, 1);
      box(3, 1, 0, 8, 2, 1);
      box(5, 0, 0, 6, 0, 1);
      box(4, 8, 2, 7, 11, 2);
    }),
};

export const slotPlaceholder = (slot: EquipSlot): MenuIcon => (size) =>
  voxelIcon(`ghost:${slot}`, () => ({ grid: GHOSTS[slot](), palette: [GHOST], alpha: 0.5 }), size);

export const isLoot = (item: BagItem): item is LootId => item in LOOT;

export const bagIcon = (item: BagItem): MenuIcon => (isLoot(item) ? lootIcon(item) : gearIcon(item as ItemId));

// The toolbar's icons: the hero's head and shoulders, a pouch for the bag,
// a book for the journal, an hourglass for the pause menu.
export const heroBustIcon = (look: BodyLook): MenuIcon => (size) => voxelIcon(`bust:toolbar`, () => humanBust(look, {}), size);
export const bagToolIcon: MenuIcon = (size) => lootIcon('tornPouch')(size);
export const journalIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:journal',
    () => {
      // Leather 1, its dark spine 2, pages 3, gold 4, a red ribbon 5: a closed book standing, a gold "!" on its cover.
      const grid = createGrid([8, 11, 4]);
      fillBox(grid, 0, 0, 0, 6, 10, 3, 1); // the covers
      fillBox(grid, 0, 0, 0, 0, 10, 3, 2); // the spine
      fillBox(grid, 1, 1, 1, 7, 9, 2, 3); // the pages, showing at the edge
      fillBox(grid, 6, 0, 0, 6, 10, 0, 2);
      fillBox(grid, 6, 0, 3, 6, 10, 3, 2);
      for (const y of [1, 9]) fillBox(grid, 1, y, 3, 5, y, 3, 4); // gold bands on the front
      fillBox(grid, 3, 5, 3, 3, 7, 3, 4); // the "!"
      fillBox(grid, 3, 3, 3, 3, 3, 3, 4);
      fillBox(grid, 4, 0, 1, 4, 0, 2, 5); // the ribbon, hanging out below
      return { grid, palette: [0x8a3a24, 0x5a2416, 0xf2e6c8, 0xf2b640, 0xc8302a], alpha: 1 };
    },
    size,
  );
export const levelUpIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:levelUp',
    () => {
      // Lake turquoise 1, its dark back 2, a pale highlight 3: a chunky arrow pointing up, stepped to a point.
      const grid = createGrid([9, 12, 3]);
      const paint = (x0: number, x1: number, y: number) => fillBox(grid, x0, y, 0, x1, y, 2, (x, _y, z) => (z === 0 ? 2 : x === x0 && z === 2 ? 3 : 1));
      for (let y = 0; y <= 5; y++) paint(3, 5, y); // the shaft
      for (let k = 0; k <= 4; k++) paint(k, 8 - k, 6 + k); // the head, a step in each side each row
      return { grid, palette: [0x3dbdb8, 0x217c98, 0xbff0e8], alpha: 1 };
    },
    size,
  );
export const pauseIcon: MenuIcon = (size) =>
  voxelIcon(
    'tool:pause',
    () => {
      // Wood 1, glass 2, sand 3: a frame, two glass bulbs meeting at a waist, sand in the lower one.
      const grid = createGrid([7, 11, 7]);
      fillBox(grid, 0, 0, 0, 6, 0, 6, 1);
      fillBox(grid, 0, 10, 0, 6, 10, 6, 1);
      for (const [x, z] of [[0, 0], [6, 0], [0, 6], [6, 6]]) fillBox(grid, x, 1, z, x, 9, z, 1);
      fillBox(grid, 1, 1, 1, 5, 2, 5, 3); // sand fallen
      fillBox(grid, 2, 3, 2, 4, 3, 4, 3);
      fillBox(grid, 3, 4, 3, 3, 6, 3, 3); // trickling through the waist
      fillBox(grid, 2, 7, 2, 4, 7, 4, 2);
      fillBox(grid, 1, 8, 1, 5, 9, 5, 2); // the empty upper bulb
      fillBox(grid, 2, 8, 2, 4, 8, 4, 3); // a little sand left
      return { grid, palette: [0x8a5a35, 0xcfe8e0, 0xe8c070], alpha: 1 };
    },
    size,
  );
