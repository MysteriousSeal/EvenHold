// The smith's wares at a level under the hero's own once they're past his village's (smithy/smithShop.ts smithShopIn):
// his forge keeps up with them, and coin has somewhere to go.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { smithShopIn, gearPrice } from '../src/model/smithy/smithShop';
import { isGear, levelOf } from '../src/model/human/items/gear';

describe("the smith's wares", () => {
  it('are forged a level under the hero once past his village, dearer for it; before, at the village\'s level', () => {
    const model = fresh();
    const smithy = model.entrances.find((e) => e.type === 'smithy')!;
    model.teleport(smithy.x, smithy.z);
    model.useDoor();
    const levelsOf = () => Object.keys(smithShopIn(model).stock).filter(isGear).map(levelOf);
    const low = levelsOf();
    expect(Math.max(...low)).toBeLessThanOrEqual(2);
    model.hero.level = 9;
    const high = levelsOf();
    expect(Math.min(...high.filter((l) => l >= 8))).toBe(8); // (new wares at 8, beside the old)
    const [plain, forged] = [Object.keys(smithShopIn(model).stock).filter(isGear).find((k) => levelOf(k) <= 2), Object.keys(smithShopIn(model).stock).filter(isGear).find((k) => levelOf(k) === 8)];
    expect(gearPrice(forged!)).toBeGreaterThan(gearPrice(plain!));
  });
});
