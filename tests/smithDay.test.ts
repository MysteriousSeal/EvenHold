// The smith's day as the hero sees it (smithy/smithWork.ts): at work while they come in at the door, called to his
// counter only once they're at it, and keeping off the anvil while they forge at it.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { smithAsleep } from '../src/model/smithy/smithWork';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

function smithies() {
  const out: Array<{ model: GameModel; smith: GameModel['npcs'][number] }> = [];
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (!enterNearest(model, 'smithy', new Set())) continue;
    const smith = model.npcs.find((n) => n.role === 'smith' && n.where === model.inside!.entrance);
    if (smith) out.push({ model, smith });
  }
  return out;
}

describe("the smith's day", () => {
  it('keeps at his work while the hero stands just in at the door', () => {
    for (const { model, smith } of smithies()) {
      const counter = model.inside!.furniture.find((f) => f.kind === 'smithCounter')!;
      const [x, z] = [model.hero.x, model.hero.z];
      let behind = 0;
      for (let t = 0; t < 30; t += FRAME) {
        Object.assign(model.hero, { x, z });
        model.update(0, 0, FRAME);
        if (Math.abs(smith.z - (counter.z - 0.6)) < 0.05) behind += FRAME;
      }
      expect(behind).toBeLessThan(10);
    }
  });

  it("doesn't walk into the hero standing before his anvil", () => {
    for (const { model, smith } of smithies()) {
      const anvil = model.inside!.furniture.find((f) => f.kind === 'anvil')!;
      const at = { x: anvil.x, z: anvil.z + anvil.d };
      let closest = Infinity;
      for (let t = 0; t < 60; t += FRAME) {
        Object.assign(model.hero, at);
        model.update(0, 0, FRAME);
        if (t > 5) closest = Math.min(closest, Math.hypot(smith.x - at.x, smith.z - at.z));
      }
      expect(closest).toBeGreaterThan(0.5);
    }
  });

  it('keeps villagers\' hours: from 23:00 to 06:00 his work put down, not called to his counter, abed or resting', () => {
    for (const { model, smith } of smithies()) {
      model.minutes = 23 * 60 + 30;
      const counter = model.inside!.furniture.find((f) => f.kind === 'smithCounter')!;
      Object.assign(model.hero, { x: counter.x + (counter.w - 1) / 2, z: counter.z + 1 });
      let working = 0;
      for (let t = 0; t < 40; t += FRAME) {
        model.update(0, 0, FRAME);
        model.minutes = 23 * 60 + 30; // (the clock held: still night)
        if (smith.working) working += FRAME;
      }
      expect(working).toBe(0);
      expect(Math.abs(smith.z - (counter.z - 0.6))).toBeGreaterThan(0.05); // (not behind his counter for the hero)
      expect(smithAsleep(model.minutes)).toBe(true);
      expect(smithAsleep(12 * 60)).toBe(false);
    }
  });
});
