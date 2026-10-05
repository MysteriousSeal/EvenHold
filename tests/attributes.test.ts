import { describe, expect, it } from 'vitest';
import { lineText } from '../src/view/ui/menuTypes';
import { ENEMY_STATS } from '../src/model/constants';
import { ITEMS, ITEM_IDS, type ItemId } from '../src/model/human/equipment';
import { MAX_ENERGY, maxHpAt, recover } from '../src/model/hero/heroStats';
import { armorOf, blowOf, critChanceOf, dodgeChanceOf, gearStats, maxEnergyOf, maxHpOf, statsOf, throughArmor } from '../src/model/hero/attributes';
import { STATS } from '../src/model/hero/statKinds';
import { gearKey, gearSpecs } from '../src/model/human/items/gear';
import { parseSave, restore, snapshot } from '../src/model/save';
import { gearLines } from '../src/controller/hero/gearLines';
import type { Enemy } from '../src/model/types';
import type { GameModel } from '../src/model/GameModel';
import { FRAME, fresh, nearest } from './support/testWorld';

// One enemy right beside the hero, the only one in the world.
function alone(model: GameModel, enemy: Enemy): Enemy {
  model.enemies.splice(0, model.enemies.length, enemy);
  Object.assign(enemy, { x: model.hero.x + 0.5, z: model.hero.z, homeX: model.hero.x + 0.5, homeZ: model.hero.z, state: 'chase' }); // (living here: not led off from home)
  return enemy;
}
// The hero wearing `items` (straight on, not from the bag).
function wearing(model: GameModel, ...items: ItemId[]): GameModel {
  for (const id of items) model.hero.equipment[ITEMS[id].slot] = id;
  return model;
}

describe("the hero's stats", () => {
  it('are 0 each at level 1 with nothing on, and leave them as they always were', () => {
    const { hero } = fresh();
    expect(statsOf(hero)).toEqual({ strength: 0, agility: 0, stamina: 0, endurance: 0 });
    expect([armorOf(hero), maxHpOf(hero), maxEnergyOf(hero), blowOf(hero), dodgeChanceOf(hero), critChanceOf(hero)]).toEqual([0, maxHpAt(1), MAX_ENERGY, 1, 0, 0]);
  });

  it("don't grow by themselves with levels (points do: training.ts); health does, as it always did", () => {
    const { hero } = fresh();
    hero.level = 4;
    expect(Object.values(statsOf(hero))).toEqual([0, 0, 0, 0]);
    expect(maxHpOf(hero)).toBe(maxHpAt(4));
    hero.trained.stamina = 2;
    expect(statsOf(hero).stamina).toBe(2);
    expect(maxHpOf(hero)).toBe(maxHpAt(4) + 4);
  });

  it("follow what's worn as it changes (in place: put on, taken off, swapped for a better one of the same)", () => {
    const model = fresh();
    const { hero } = model;
    expect(armorOf(hero)).toBe(0);
    wearing(model, 'chainMail');
    const mail = armorOf(hero);
    expect(mail).toBeGreaterThan(0);
    const slot = ITEMS.chainMail.slot;
    hero.equipment[slot] = gearKey({ item: 'chainMail', level: 10, rarity: 'common', roll: 0 });
    expect(armorOf(hero)).toBeGreaterThan(mail);
    expect(gearStats(hero)).toEqual(gearSpecs(hero.equipment[slot]!).stats);
    delete hero.equipment[slot];
    expect([armorOf(hero), gearStats(hero)]).toEqual([0, { strength: 0, agility: 0, stamina: 0, endurance: 0 }]);
  });

  it('take what gear adds: Strength for harder blows, Stamina for health, Agility for dodges and critical blows, Endurance for energy; armour off blows taken', () => {
    const { hero } = wearing(fresh(), 'chainMail', 'armingSword', 'leatherBoots', 'runeStone');
    expect(gearStats(hero)).toEqual({ strength: 3, agility: 1, stamina: 3, endurance: 3 });
    expect(blowOf(hero)).toBe(2); // 3 Strength: a point more
    expect(maxHpOf(hero)).toBe(maxHpAt(1) + 6);
    expect(maxEnergyOf(hero)).toBe(MAX_ENERGY + 15);
    expect(dodgeChanceOf(hero)).toBeCloseTo(0.01);
    expect(armorOf(hero)).toBe(8 + 2);
    expect(throughArmor(hero, 5)).toBe(3); // 10 armour: two off
    expect(throughArmor(hero, 2)).toBe(1); // never under 1
  });

  it('spend energy slower with more Endurance', () => {
    const plain = fresh().hero;
    const hardy = wearing(fresh(), 'runeStone', 'tome', 'furJerkin').hero; // +9 Endurance
    for (const hero of [plain, hardy]) {
      hero.energy = 80;
      recover(hero, 600);
    }
    expect(80 - hardy.energy).toBeLessThan(80 - plain.energy);
  });

  it('keep health and energy under their new most when gear comes off', () => {
    const model = wearing(fresh(), 'chainMail', 'runeStone');
    model.hero.hp = maxHpOf(model.hero);
    model.hero.energy = maxEnergyOf(model.hero);
    model.unequip('torso');
    model.unequip('neck');
    expect(model.hero.hp).toBe(maxHpAt(1));
    expect(model.hero.energy).toBe(MAX_ENERGY);
  });

  it("keep a save's health past the bare most, when the gear worn allows it", () => {
    const model = wearing(fresh(), 'chainMail');
    model.hero.hp = maxHpOf(model.hero);
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.hp).toBe(maxHpAt(1) + 6);
  });
});

describe('in a fight', () => {
  it('dodges a blow with Agility (a roll), taking nothing', () => {
    const model = wearing(fresh(), 'dagger', 'parryingDagger'); // +6 Agility
    model.random = () => 0; // every roll comes up
    alone(model, nearest(model, 'bandit'));
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME; t += FRAME) model.update(0, 0, FRAME);
    expect(model.hero.hp).toBe(maxHpAt(1));
    expect(model.takeEvents().some((e) => e.kind === 'dodge')).toBe(true);
  });

  it('takes blows through its armour', () => {
    const model = wearing(fresh(), 'breastplate', 'greatHelm', 'plateGreaves', 'towerShield'); // 28 armour: 5 off
    alone(model, nearest(model, 'bandit'));
    const before = model.hero.hp;
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME && model.hero.hp === before; t += FRAME) model.update(0, 0, FRAME);
    expect(before - model.hero.hp).toBe(Math.max(1, ENEMY_STATS.bandit.damage - 5));
  });

  it('lands harder blows with Strength, and double on a critical one', () => {
    const model = wearing(fresh(), 'battleAxe', 'lakeStone'); // +5 Strength, +2 Agility
    model.random = () => 0;
    const wolf = alone(model, nearest(model, 'wolf'));
    wolf.hp = 100;
    model.update(1, 0, 1e-6);
    wolf.x = model.hero.x + 0.6;
    wolf.z = model.hero.z;
    model.startAttack();
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    const hit = model.takeEvents().find((e) => e.kind === 'hit' && e.on === 'wolf');
    expect(hit).toMatchObject({ amount: 2 * blowOf(model.hero), crit: true });
    expect(blowOf(model.hero)).toBe(2);
  });
});

describe('gear', () => {
  it('each piece adds to the stats, and only what is worn on the body or held as a shield has armour', () => {
    for (const id of ITEM_IDS) {
      const { stats = {}, armor = 0, slot } = ITEMS[id];
      expect(STATS.some((s) => (stats[s] ?? 0) > 0), id).toBe(true);
      if (['neck', 'ring', 'mainHand'].includes(slot)) expect(armor, id).toBe(0);
    }
  });

  it("tells in its tooltip its armour and what it adds, as WoW's do", () => {
    expect(gearLines('chainMail').map(lineText)).toEqual(['Level 1 · Common', 'Armour 8', '+3 Stamina']);
    expect(gearLines('sapphireRing').map(lineText)).toEqual(['Level 1 · Common', '+1 Agility', '+2 Endurance']);
    expect(gearLines('chainMail').slice(1).every((l) => typeof l !== 'string' && l.tone === 'stat')).toBe(true); // (each told as a stat: menuTypes.ts)
  });
});
