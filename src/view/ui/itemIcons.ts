// Icons for things the hero carries, rendered from their own voxel models
// (voxelIcon.ts): gear as it sits when worn or held, loot as it lies.

import { ITEMS, type EquipSlot, type ItemId } from '../../model/human/equipment';
import type { LootId } from '../../model/loot/loot';
import { LOOT } from '../../model/loot/loot';
import type { BagItem } from '../../model/bag';
import { humanFigure, type Figure } from '../meshes/human/humanFigure';
import { HERO_LOOK } from '../../model/human/humanoid';
import { ITEM_MODELS } from '../meshes/human/gear/itemModels';
import { JUNK_MODELS } from '../meshes/loot/junkVoxels';
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
  voxelIcon(`loot:${item}`, () => ({ grid: JUNK_MODELS[item].build(), palette: JUNK_MODELS[item].palette }), size);

// What an empty slot shows: a typical item for it, worn on the part of the
// body it covers (a capped head, a booted foot...), as one faded sand-toned
// silhouette, so the shape says what goes there. Weapons and jewelry show
// on their own.
const TYPICAL: Record<EquipSlot, ItemId> = {
  head: 'leatherCap',
  shoulders: 'ironPauldrons',
  torso: 'gambeson',
  hands: 'workGloves',
  legs: 'woolHose',
  feet: 'leatherBoots',
  neck: 'silverLocket',
  ring: 'goldRing',
  mainHand: 'armingSword',
  offHand: 'plankShield',
};
const SILHOUETTE = 0x8a6a45;
// The part of a dressed figure (humanFigure's voxels: x across, y up) that
// shows the slot: [x0, x1, y0, y1], inclusive.
const CROP: Partial<Record<EquipSlot, [number, number, number, number]>> = {
  head: [0, 14, 12, 21],
  shoulders: [0, 14, 8, 13],
  torso: [0, 14, 5, 12],
  hands: [0, 3, 4, 9], // the right arm and fist
  legs: [0, 14, 0, 7], // up to the belt
  feet: [0, 14, 0, 2],
};

export const slotPlaceholder = (slot: EquipSlot): MenuIcon => (size) =>
  voxelIcon(
    `empty:${slot}`,
    () => {
      const item = TYPICAL[slot];
      const jewel = ITEM_MODELS[item].jewel;
      const crop = CROP[slot];
      const model = jewel
        ? { grid: jewel.build(), palette: ITEM_MODELS[item].palette }
        : crop
          ? cropped(humanFigure(HERO_LOOK, { [slot]: item }), crop)
          : humanFigure(null, { [slot]: item });
      return { grid: model.grid, palette: model.palette.map(() => SILHOUETTE), alpha: 0.6 };
    },
    size,
  );

// Only the voxels of `figure` within `crop`.
function cropped(figure: Figure, [x0, x1, y0, y1]: [number, number, number, number]): Figure {
  const [sx, sy, sz] = figure.grid.size;
  const cells = figure.grid.cells.slice();
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) if (x < x0 || x > x1 || y < y0 || y > y1) cells[x + sx * (y + sy * z)] = 0;
    }
  }
  return { grid: { size: figure.grid.size, cells }, palette: figure.palette };
}

export const isLoot = (item: BagItem): item is LootId => item in LOOT;

export const bagIcon = (item: BagItem): MenuIcon => (isLoot(item) ? lootIcon(item) : gearIcon(item as ItemId));
