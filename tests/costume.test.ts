// A job's costume (view/meshes/human/gear/costumes.ts: the inn server's): only to be seen, never an item: no costume
// look is in the catalog, nor can be worn, carried, sold or dropped; each piece fits both builds, on the parts its
// slot covers; and a body dressed in it wears it over nothing of its own gear, which stays on the hero, untouched.
import { describe, expect, it } from 'vitest';
import { COSTUMES, COSTUME_LOOKS, isCostume } from '../src/view/meshes/human/gear/costumes';
import { lookSlot, wornGrid } from '../src/view/meshes/human/gear/itemModels';
import { ITEMS, ITEM_IDS } from '../src/model/human/equipment';
import { isGear } from '../src/model/human/items/gear';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE } from './support/testWorld';

const LOOKS = Object.keys(COSTUME_LOOKS) as Array<keyof typeof COSTUME_LOOKS>;

describe("a job's costume", () => {
  it('is never an item: not in the catalog, not gear, not to be dropped by anyone', () => {
    for (const look of LOOKS) {
      expect(isCostume(look)).toBe(true);
      expect(look in ITEMS).toBe(false);
      expect(isGear(look)).toBe(false);
    }
    expect(ITEM_IDS.some((id) => isCostume(id))).toBe(false); // (foes' drops pick from these)
  });

  it.each(['male', 'female'] as const)("fits a %s build: each piece on the parts its slot covers", (build) => {
    for (const look of LOOKS) {
      const slot = lookSlot(look);
      const parts = slot === 'head' ? (['head'] as const) : slot === 'torso' ? (['torso', 'arm'] as const) : slot === 'legs' ? (['torso', 'leg'] as const) : (['leg'] as const);
      for (const part of parts) expect(wornGrid(look, part, 'left', false, build), `${look} on the ${part}`).not.toBeNull();
    }
  });

  it("dresses a body over none of its own gear, which the hero keeps", () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    model.hero.equipment = { torso: 'chainMail', mainHand: 'armingSword', shoulders: 'ironPauldrons' };
    const kept = { ...model.hero.equipment };
    const rig = new HumanRig(model.hero.look);
    rig.wear(model.hero.equipment);
    const geared = rig.meshes.length;
    rig.dress(COSTUMES.innServer);
    expect(rig.meshes.length).toBeGreaterThan(0);
    expect(rig.meshes.length).not.toBe(geared);
    expect(model.hero.equipment).toEqual(kept);
    rig.wear(model.hero.equipment); // (off work: their gear again)
    expect(rig.meshes.length).toBe(geared);
  });
});
