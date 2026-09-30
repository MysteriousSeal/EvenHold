// Ingredients in voxels (ingredients.ts), grid-aligned only: a raw haunch of
// boar, red and marbled with fat, its bone sticking out of the cut end.

import type { IngredientId } from '../../../model/loot/ingredients';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

export const INGREDIENT_MODELS: Record<IngredientId, LootModel> = {
  // A rounded lump of red meat, darker underneath, streaked with fat; a rim of
  // fat round the cut end, and the bone out of it, knobbed at the tip.
  rawBoarMeat: model([0xc0464e, 0x8e2c36, 0xf2e2d4, 0xeee2c4], [7, 3, 5], (g) => {
    const meat = (x: number, y: number, z: number) => ((x + 2 * z + y) % 5 === 0 ? 3 : y === 0 ? 2 : 1);
    fillBox(g, 0, 0, 1, 3, 1, 3, meat);
    fillBox(g, 1, 0, 0, 3, 1, 4, meat); // (the corners left out: rounded)
    fillBox(g, 1, 2, 1, 3, 2, 3, (x, _y, z) => ((x + z) % 3 === 0 ? 3 : 1)); // its rounded top
    fillBox(g, 4, 0, 1, 4, 1, 3, 3); // the fat round the cut
    setColor(g, 5, 1, 2, 4); // the bone
    fillBox(g, 6, 1, 1, 6, 1, 3, 4); // its knob
  }),
};
