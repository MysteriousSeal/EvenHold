// The hero's bag, opened and closed with B: a grid of slots in the shared
// menu (view/ui/menu.ts), one per kind of item carried, with its voxel icon
// and how many; the selected one says what it is and what it sells for.
// Drag a slot out of the bag to drop one of it on the ground.
// The game plays on around it: it only takes Escape and B.

import type { GameModel } from '../model/GameModel';
import { LOOT, LOOT_QUALITY, type LootId } from '../model/loot/loot';
import { JUNK_MODELS } from '../view/meshes/loot/junkVoxels';
import { createMenu, type MenuSlot } from '../view/ui/menu';
import { voxelIcon } from '../view/ui/voxelIcon';

const COLUMNS = 6;
const ROWS = 4;
const QUALITY_NAMES = { junk: 'Junk' } as const;

const lootIcon = (item: LootId) => (size: number) => voxelIcon(`loot:${item}`, () => ({ grid: JUNK_MODELS[item].build(), palette: JUNK_MODELS[item].palette }), size);

export function createInventoryPanel(model: GameModel): void {
  createMenu({
    title: 'Bag',
    toggleKey: 'KeyB',
    keyHints: false,
    modal: false,
    tabs: [
      {
        name: 'Bag',
        slots: () => {
          const carried = (Object.entries(model.hero.bag) as Array<[LootId, number]>).filter(([, count]) => count > 0);
          const cells: Array<MenuSlot | null> = carried.map(([item, count]) => ({
            icon: lootIcon(item),
            count,
            title: LOOT[item].name,
            tone: LOOT_QUALITY[item],
            dragOut: () => void model.dropFromBag(item),
            lines: [`${QUALITY_NAMES[LOOT_QUALITY[item]]} · sells for ${LOOT[item].value} copper${count > 1 ? ' each' : ''}`, count > 1 ? `${count} in the bag` : ''].filter(Boolean),
          }));
          while (cells.length < COLUMNS * ROWS) cells.push(null);
          return { cells, columns: COLUMNS };
        },
      },
    ],
  });
}
