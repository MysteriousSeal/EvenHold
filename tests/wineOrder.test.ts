import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { callBarkeep, placeOrder } from '../src/model/inn/barOrders';
import { mugsAt, setMug } from '../src/model/inn/barMugs';
import type { Drink } from '../src/model/npcs/npcs';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const FRAME = 1 / 30;

describe('a glass of wine at the bar', () => {
  it('is poured at the bottle shelf (not the keg), carried as a glass, and set down full as wine; its empty glass cleared as a glass', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    enterNearest(model, 'inn', new Set());
    const inn = model.inside!.entrance;
    const { furniture } = model.inside!;
    const barkeep = model.npcs.find((n) => n.role === 'barkeep' && n.where === inn)!;
    const stool = furniture.find((f) => f.kind === 'barStool')!;
    const shelf = furniture.find((f) => f.kind === 'bottleShelf')!;
    const villager = model.npcs.find((n) => n.role === 'villager')!;
    let served = false;
    placeOrder(inn, { stool, by: villager, drink: 'wine', served: () => ((served = true), setMug(inn, stool.z, true, 3, 'wine')) });
    callBarkeep(barkeep);
    const carried = new Set<false | Drink | undefined>();
    let atShelf = false;
    for (let t = 0; t < 120 && !served; t += FRAME) {
      model.update(0, 0, FRAME);
      carried.add(barkeep.carrying);
      if (Math.abs(barkeep.z - (shelf.z + shelf.d / 2 - 0.5)) < 0.1 && barkeep.working) atShelf = true;
    }
    expect(served).toBe(true);
    expect(atShelf).toBe(true); // poured at the bottles
    expect(carried.has('wine')).toBe(true); // a glass in hand
    expect(mugsAt(inn).find((m) => m.z === stool.z)).toMatchObject({ full: true, drink: 'wine' });
    // Drunk, its empty glass left: she clears it, a glass in hand.
    setMug(inn, stool.z, false, 1, 'wine');
    const clearing = new Set<false | Drink | undefined>();
    for (let t = 0; t < 120 && mugsAt(inn).some((m) => m.z === stool.z); t += FRAME) {
      model.update(0, 0, FRAME);
      clearing.add(barkeep.carrying);
    }
    expect(mugsAt(inn).some((m) => m.z === stool.z)).toBe(false);
    expect(clearing.has('wine')).toBe(true);
  });
});
