// Gear worn down by use (hero/wear.ts): a weapon by blows landed, armour by harm taken, all of it by a fall; broken,
// it gives nothing till a smith mends it, for coin; kept in the save.
import { describe, expect, it } from 'vitest';
import { BROKEN, TEMPERED_WEAR, TEMPER_FLOOR, mendAll, mendBill, mendCost, readWear, wearOf, wearOnBlow, wearOnFall, wearOnHarm, wearText } from '../src/model/hero/wear';
import { armorOf, gearStats } from '../src/model/hero/attributes';
import { BLESSINGS, TEMPERED_TIME, blessAll, spared, tickBlessing, tossCoin } from '../src/model/hero/blessing';
import { restore, snapshot } from '../src/model/save';
import type { GameEvent } from '../src/model/types';
import { fresh } from './support/testWorld';

describe('gear wears', () => {
  it('a weapon by the blows it lands, armour by the harm taken, everything by a fall; jewellery never', () => {
    const { hero } = fresh();
    Object.assign(hero.equipment, { mainHand: 'armingSword', torso: 'brigandine', ring: 'copperRing' });
    const told: GameEvent[] = [];
    const report = (e: GameEvent) => told.push(e);
    for (let i = 0; i < 10; i++) wearOnBlow(hero, report);
    expect(wearOf(hero, 'armingSword')).toBeCloseTo(4);
    wearOnHarm(hero, 50, report);
    expect(wearOf(hero, 'brigandine')).toBeCloseTo(6);
    expect(wearOf(hero, 'armingSword')).toBeCloseTo(4); // (a sword's no guard)
    wearOnFall(hero, report);
    expect([wearOf(hero, 'armingSword'), wearOf(hero, 'brigandine'), wearOf(hero, 'copperRing')]).toEqual([16, 18, 0]);
    expect(told).toEqual([]);
  });

  it('badly worn, told; broken, told, and it gives nothing till mended, for coin', () => {
    const { hero } = fresh();
    hero.equipment.torso = 'brigandine';
    const armor = armorOf(hero);
    const told: string[] = [];
    const report = (e: GameEvent) => e.kind === 'poor' && told.push(e.text);
    hero.wear = { brigandine: 70 };
    wearOnHarm(hero, 50, report);
    expect(told).toEqual(['Your Brigandine is badly worn']);
    expect(armorOf(hero)).toBe(armor); // (worn: still whole)
    wearOnHarm(hero, 400, report);
    expect(told.at(-1)).toMatch(/has broken/);
    expect(wearOf(hero, 'brigandine')).toBe(BROKEN);
    expect(armorOf(hero)).toBeLessThan(armor);
    expect(wearText(hero, 'brigandine')?.bad).toBe(true);
    const cost = mendCost(hero, 'brigandine');
    expect(cost).toBeGreaterThan(0);
    expect(mendBill(hero).total).toBe(cost);
    hero.money = cost - 1;
    expect(mendAll(hero)).toBe('too poor');
    hero.money = cost;
    expect(mendAll(hero)).toBe('mended');
    expect([hero.money, wearOf(hero, 'brigandine'), armorOf(hero)]).toEqual([0, 0, armor]);
    expect(mendAll(hero)).toBe('none');
  });

  it('a stat piece broken: its stats gone too', () => {
    const { hero } = fresh();
    hero.equipment.mainHand = 'armingSword';
    const strength = gearStats(hero).strength;
    hero.wear = { armingSword: BROKEN };
    expect(gearStats(hero).strength).toBe(strength - 3);
  });

  it('kept in the save; anything unsound in it left out', () => {
    const model = fresh();
    model.hero.equipment.mainHand = 'armingSword';
    model.hero.wear = { armingSword: 42 };
    const saved = snapshot(model);
    const again = fresh();
    restore(again, saved);
    expect(again.hero.wear).toEqual({ armingSword: 42 });
    expect(readWear({ armingSword: 500, nothing: 3, dagger: -1, mace: 'x' })).toEqual({ armingSword: BROKEN });
  });

  it('freshly mended, Tempered a while: hits on them a tenth less, their gear wearing half as fast; nothing mended, nothing', () => {
    const { hero } = fresh();
    Object.assign(hero.equipment, { mainHand: 'armingSword', torso: 'brigandine' });
    hero.money = 10_000;
    expect(mendAll(hero)).toBe('none');
    expect(hero.blessings ?? []).toEqual([]);
    hero.wear = { brigandine: 3 }; // (a scratch: a copper or two)
    expect(mendAll(hero)).toBe('mended');
    expect(hero.blessings ?? []).toEqual([]); // (not Tempered for a copper: the bill short of a tenth of what they wear's worth)
    hero.wear = { brigandine: 60 };
    expect(mendBill(hero).total).toBeGreaterThanOrEqual(Math.ceil((150 + 200) * TEMPER_FLOOR));
    expect(mendAll(hero)).toBe('mended');
    expect(hero.blessings).toEqual([{ kind: 'tempered', left: TEMPERED_TIME }]);
    expect(BLESSINGS.tempered.name).toBe('Tempered');
    expect(spared(hero)).toBeCloseTo(0.1);
    wearOnFall(hero, () => {});
    expect(wearOf(hero, 'armingSword')).toBeCloseTo(12 * TEMPERED_WEAR);
    // A well's blessing tossed for: Tempered kept beside it; mended again, afresh.
    tossCoin(hero, 0);
    expect(hero.blessings!.map((b) => b.kind)).toContain('tempered');
    tickBlessing(hero, 60);
    hero.wear = { brigandine: 60 };
    mendAll(hero);
    expect(hero.blessings!.filter((b) => b.kind === 'tempered')).toEqual([{ kind: 'tempered', left: TEMPERED_TIME }]);
    tickBlessing(hero, TEMPERED_TIME);
    expect(spared(hero)).toBe(0);
    blessAll(hero);
    expect(hero.blessings!.map((b) => b.kind)).not.toContain('tempered'); // (no well's)
  });

  it('not Tempered for a scratch mended off a piece carried with nothing worn (the floor counts what the bill mends)', () => {
    const { hero } = fresh();
    hero.money = 10_000;
    hero.bag = { brigandine: 1 };
    hero.wear = { brigandine: 1 };
    expect(mendBill(hero).total).toBe(1);
    expect(mendAll(hero)).toBe('mended');
    expect(hero.blessings ?? []).toEqual([]);
    hero.wear = { brigandine: 60 };
    expect(mendAll(hero)).toBe('mended');
    expect(hero.blessings!.map((b) => b.kind)).toEqual(['tempered']);
  });

  it('Tempered kept in the save, its time left; an older save, without it, loads untempered', () => {
    const model = fresh();
    model.hero.blessings = [{ kind: 'tempered', left: 600 }];
    const again = fresh();
    restore(again, snapshot(model));
    expect(again.hero.blessings).toEqual([{ kind: 'tempered', left: 600 }]);
    const old = snapshot(fresh()) as { hero: { blessings?: unknown } };
    delete old.hero.blessings;
    const older = fresh();
    restore(older, old as never);
    expect(older.hero.blessings).toEqual([]);
  });
});
