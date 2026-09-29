import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { buyPrice, shopAt } from '../src/model/npcs/tavernShop';
import { maxHpAt } from '../src/model/hero/heroStats';
import { ALE_SECONDS, barmaidHere, callForAle, orderAle, orderLabel } from '../src/controller/barOrder';
import { PROVISIONS } from '../src/model/loot/provisions';
import { AT_KEG, AT_SINK, pourFor } from '../src/model/npcs/innStaff';
import { mugsAt, roundOnBar, setMug, takeMug } from '../src/model/npcs/barMugs';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { INDOOR_SCALE } from '../src/model/constants';
import { NPC_RADIUS } from '../src/model/npcs/npcs';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// In the nearest inn, as if sat at the bar.
const atTheInn = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  enterNearest(model, 'inn', new Set());
  expect(model.inside?.entrance.type).toBe('inn');
  return model;
};

describe('an ale at the bar', () => {
  it('is poured from her stock, paid for, and drunk on the spot', () => {
    const model = atTheInn();
    const shop = shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    const stock = shop.stock.ale!;
    model.hero.money = 100;
    model.hero.hp = 1;
    expect(orderLabel(model)).toEqual({ label: `Order an ale · ${buyPrice('ale')} copper`, soldOut: false });
    expect(orderAle(model).drank).toBe(true);
    expect(shop.stock.ale).toBe(stock - 1);
    expect(model.hero.money).toBe(100 - buyPrice('ale'));
    expect(model.hero.bag.ale ?? 0).toBe(0); // sipped there, not carried off
    // Sipped over ALE_SECONDS: its health back a little at a time, all of it once empty.
    model.update(0, 0, ALE_SECONDS / 2);
    const halfway = model.hero.hp;
    expect(halfway).toBeGreaterThan(1);
    expect(halfway).toBeLessThan(1 + PROVISIONS.ale.heal);
    model.update(0, 0, ALE_SECONDS / 2 + 0.1);
    expect(model.hero.hp).toBeCloseTo(Math.min(maxHpAt(model.hero.level), 1 + PROVISIONS.ale.heal));
    expect(model.hero.drinking).toBeNull();
  });

  it("is called for first: she says she's coming, and nothing's paid till she pours", () => {
    const model = atTheInn();
    model.hero.money = 100;
    expect(callForAle(model).coming).toBe(true);
    expect(model.hero.money).toBe(100);
    model.hero.money = 0;
    expect(callForAle(model).coming).toBe(false); // too poor: she says so at once
  });

  it("isn't, without the coin, or with the barrel dry", () => {
    const model = atTheInn();
    const shop = shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    model.hero.money = 0;
    expect(orderAle(model).drank).toBe(false);
    model.hero.money = 100;
    shop.stock.ale = 0;
    expect(orderLabel(model).soldOut).toBe(true);
    expect(orderAle(model)).toMatchObject({ drank: false });
    expect(model.hero.money).toBe(100);
  });

  it('is fetched: she goes to the keg, pours, and carries it back across the bar to the stool', () => {
    const model = atTheInn();
    const stool = model.inside!.furniture.find((f) => f.kind === 'barStool')!;
    const barmaid = barmaidHere(model)!;
    expect(barmaid).toBeTruthy();
    expect(bumpsFurniture(model.inside!.furniture, AT_KEG.x, AT_KEG.z, NPC_RADIUS * INDOOR_SCALE)).toBe(false); // she fits before the keg (no shuffling into it)
    let handed = false;
    let carried = false;
    let atKeg = false;
    pourFor(barmaid, stool, () => (handed = true));
    for (let t = 0; t < 30 && !handed; t += 0.05) {
      model.update(0, 0, 0.05);
      carried ||= !!barmaid.carrying;
      atKeg ||= barmaid.working && barmaid.z < 1; // bent over the tap, at the head of the bar
    }
    expect(atKeg).toBe(true);
    expect(carried).toBe(true);
    expect(handed).toBe(true);
    expect(barmaid.carrying).toBe(false);
    expect(Math.abs(barmaid.z - stool.z)).toBeLessThan(0.2); // across the bar from it
  });

  it('keeps the drinks on the bar, one to a row: set down, picked up, left empty', () => {
    const model = atTheInn();
    const inn = model.inside!.entrance;
    setMug(inn, 2, true);
    setMug(inn, 2, false, 2); // drunk: the empty mug in its place
    expect(mugsAt(inn).filter((m) => m.z === 2)).toEqual([{ z: 2, full: false, wait: 2 }]);
    expect(roundOnBar(inn)).toBeNull(); // not yet
    expect(roundOnBar(inn)?.z).toBe(2); // two of her rounds on: ready to clear
    expect(takeMug(inn, 2)).toBe(true);
    expect(mugsAt(inn)).toEqual([]);
  });

  it('are cleared by her, a while after: she takes the empty mug and carries it to the sink', () => {
    const model = atTheInn();
    const inn = model.inside!.entrance;
    const barmaid = barmaidHere(model)!;
    const stool = model.inside!.furniture.find((f) => f.kind === 'barStool')!;
    setMug(inn, stool.z, false, 1);
    let carried = false;
    for (let t = 0; t < 90 && mugsAt(inn).some((m) => m.z === stool.z); t += 0.05) {
      model.update(0, 0, 0.05);
      carried ||= !!barmaid.carrying;
    }
    expect(mugsAt(inn).some((m) => m.z === stool.z)).toBe(false); // taken
    for (let t = 0; t < 10; t += 0.05) {
      model.update(0, 0, 0.05);
      carried ||= !!barmaid.carrying;
    }
    expect(carried).toBe(true);
    expect(model.inside!.furniture.some((f) => f.kind === 'sink')).toBe(true);
    expect(bumpsFurniture(model.inside!.furniture, AT_SINK.x, AT_SINK.z, NPC_RADIUS * INDOOR_SCALE)).toBe(false); // she fits before it
  }, 60_000);
});
