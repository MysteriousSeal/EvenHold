// The smith's wares at a level under the hero's own once they're past his village's (smithy/smithShop.ts smithShopIn):
// his forge keeps up with them, and coin has somewhere to go; one forging of each piece on his wall.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { smithShopIn, gearPrice } from '../src/model/smithy/smithShop';
import { baseOf, isGear, levelOf } from '../src/model/human/items/gear';

describe("the smith's wares", () => {
  it("are forged a level under the hero once past his village, dearer for it, the village's forging put away; before, at the village's level", () => {
    const model = fresh();
    const smithy = model.entrances.find((e) => e.type === 'smithy')!;
    model.teleport(smithy.x, smithy.z);
    model.useDoor();
    const wares = () => Object.keys(smithShopIn(model).stock).filter(isGear);
    const low = wares();
    expect(Math.max(...low.map(levelOf))).toBeLessThanOrEqual(2);
    model.hero.level = 9;
    const high = wares();
    expect(new Set(high.map(levelOf))).toEqual(new Set([8])); // (one forging of each piece: the old put away)
    expect(high).toHaveLength(low.length);
    const plain = low.find((k) => baseOf(k) === baseOf(high[0]))!;
    expect(gearPrice(high[0])).toBeGreaterThan(gearPrice(plain));
  });
});
