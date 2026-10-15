// Gear worn down by use (hero/wear.ts): a weapon by blows landed, armour by harm taken, all of it by a fall; broken,
// it gives nothing till a smith mends it, for coin; kept in the save.
import { describe, expect, it } from 'vitest';
import { BROKEN, mendAll, mendBill, mendCost, readWear, wearOf, wearOnBlow, wearOnFall, wearOnHarm, wearText } from '../src/model/hero/wear';
import { armorOf, gearStats } from '../src/model/hero/attributes';
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
});
