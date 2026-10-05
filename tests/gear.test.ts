// Gear as found (model/human/items/gear.ts): its item, level and rarity in its key (a plain id: level 1, common);
// its stats and armour growing with its level, its rarity a line more each tier (specials from rare up), the same
// every time; worth more the higher and rarer; rarities rolled with their odds; worn only at its level; what it gives
// the hero (stats, armour, crit and dodge, health back, pace, life on hit); dropped by people and the dead (a chief
// always, uncommon at the least); kept in a save; the smith's forged at his village's level.
import { describe, expect, it } from 'vitest';
import {
  RARITIES,
  baseOf,
  canWear,
  gearKey,
  gearOf,
  gearSpecs,
  gearWorth,
  isGear,
  levelOf,
  rarityOf,
  rollGear,
  rollRarity,
  tierOf,
  type GearKey,
  type Rarity,
} from '../src/model/human/items/gear';
import { STATS } from '../src/model/hero/statKinds';
import { armorOf, critChanceOf, dodgeChanceOf, maxHpOf, statsOf } from '../src/model/hero/attributes';
import { gearPace, leech, regenerate } from '../src/model/hero/gearEffects';
import { rollGearDrop } from '../src/model/loot/gearDrops';
import { makeEnemy } from '../src/model/enemies/enemies';
import { parseSave, restore, snapshot } from '../src/model/save';
import { smithShopAt, gearPrice, gearSellPrice } from '../src/model/smithy/smithShop';
import { gearLines } from '../src/controller/hero/gearLines';
import { lineText } from '../src/view/ui/menuTypes';
import { mulberry32 } from '../src/util/random';
import { fresh } from './support/testWorld';

const key = (level: number, rarity: Rarity, roll = 7, item: Parameters<typeof gearKey>[0]['item'] = 'chainMail') => gearKey({ item, level, rarity, roll });

describe('a piece of gear', () => {
  it('its item, level and rarity in its key; a plain id level 1 and common; nonsense not gear', () => {
    const k = key(12, 'rare', 348);
    expect(k).toBe('chainMail@12r348');
    expect(gearOf(k)).toEqual({ item: 'chainMail', level: 12, rarity: 'rare', roll: 348 });
    expect(gearKey({ item: 'chainMail', level: 1, rarity: 'common', roll: 5 })).toBe('chainMail');
    expect(gearOf('chainMail')).toEqual({ item: 'chainMail', level: 1, rarity: 'common', roll: 0 });
    expect([isGear(k), isGear('chainMail'), isGear('wolfFang'), isGear('nothing@3r1'), isGear('chainMail@x')]).toEqual([true, true, false, false, false]);
    expect([baseOf(k), levelOf(k), rarityOf(k)]).toEqual(['chainMail', 12, 'rare']);
  });

  it('its own stats and armour growing with its level; its rarity a line more each tier, none the same twice, specials from rare up', () => {
    const [low, high] = [gearSpecs(key(1, 'common')), gearSpecs(key(20, 'common'))];
    expect(high.armor).toBeGreaterThan(low.armor);
    expect(high.stats.stamina).toBeGreaterThan(low.stats.stamina);
    for (const rarity of RARITIES) {
      for (let roll = 0; roll < 60; roll++) {
        const { lines } = gearSpecs(key(10, rarity, roll));
        const extra = lines.filter((l) => l.extra);
        expect(extra).toHaveLength(tierOf(rarity));
        expect(new Set(extra.map((l) => l.kind)).size).toBe(extra.length);
        if (tierOf(rarity) < 2) expect(extra.every((l) => l.kind === 'armor' || (STATS as readonly string[]).includes(l.kind))).toBe(true);
        for (const l of lines) expect(l.amount).toBeGreaterThan(0);
      }
    }
    const legendary = Array.from({ length: 80 }, (_, roll) => gearSpecs(key(30, 'legendary', roll)).lines);
    expect(legendary.some((lines) => lines.some((l) => ['crit', 'dodge', 'regen', 'speed', 'leech'].includes(l.kind)))).toBe(true);
    expect(gearSpecs(key(10, 'epic', 3))).toEqual(gearSpecs(key(10, 'epic', 3))); // (the same every time)
  });

  it('worth more the higher and the rarer; the smith pays half', () => {
    expect(gearWorth(key(10, 'common'), 100)).toBeGreaterThan(gearWorth(key(1, 'common'), 100));
    const worths = RARITIES.map((r) => gearWorth(key(10, r), 100));
    for (let i = 1; i < worths.length; i++) expect(worths[i]).toBeGreaterThan(worths[i - 1]);
    expect(gearSellPrice(key(10, 'epic'))).toBeLessThan(gearPrice(key(10, 'epic')));
  });

  it('rarities rolled with their odds, commonest first; luck leaning rarer; never under the least asked', () => {
    const count = (luck: number, least?: Rarity) => {
      const tally = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
      for (let i = 0; i < 20000; i++) tally[rollRarity((i + 0.5) / 20000, luck, least)]++;
      return tally;
    };
    const plain = count(1);
    expect(plain.common).toBeGreaterThan(plain.uncommon);
    expect(plain.uncommon).toBeGreaterThan(plain.rare);
    expect(plain.rare).toBeGreaterThan(plain.epic);
    expect(plain.epic).toBeGreaterThan(plain.legendary);
    expect(plain.legendary).toBeGreaterThan(0);
    expect(count(3).legendary).toBeGreaterThan(plain.legendary);
    expect(count(1, 'rare').common + count(1, 'rare').uncommon).toBe(0);
    const piece = rollGear('shortSword', 7, mulberry32(4));
    expect([baseOf(piece), levelOf(piece)]).toEqual(['shortSword', 7]);
  });

  it('its tooltip: its level and rarity, its own lines, its rarity\'s apart, and that the hero must be its level', () => {
    const k = key(9, 'epic', 11);
    const lines = gearLines(k, 5);
    expect(lineText(lines[0])).toBe('Level 9 · Epic');
    expect(lines.filter((l) => typeof l !== 'string' && l.tone === 'extra')).toHaveLength(3);
    expect(lineText(lines.at(-1)!)).toBe('Requires level 9');
    expect(gearLines(k, 9).map(lineText)).not.toContain('Requires level 9');
  });
});

describe('gear on the hero', () => {
  it('worn only at its level', () => {
    const model = fresh();
    const k = key(5, 'rare', 2);
    model.hero.bag[k] = 1;
    expect(canWear(k, 1)).toBe(false);
    expect(model.equipFromBag(k)).toBe(false);
    expect(model.hero.equipment.torso).not.toBe(k);
    model.hero.level = 5;
    expect(model.equipFromBag(k)).toBe(true);
    expect(model.hero.equipment.torso).toBe(k);
  });

  it('its stats and armour theirs; its specials: crit and dodge, health back, pace, life on hit', () => {
    const model = fresh();
    const { hero } = model;
    hero.level = 40;
    hero.equipment = {};
    const [armor, stamina] = [armorOf(hero), statsOf(hero).stamina];
    const k = key(20, 'uncommon');
    hero.equipment.torso = k;
    expect(armorOf(hero) - armor).toBe(gearSpecs(k).armor);
    expect(statsOf(hero).stamina - stamina).toBe(gearSpecs(k).stats.stamina);
    // A piece with each special: found among legendary rolls.
    const special = (kind: string) => Array.from({ length: 400 }, (_, roll) => key(30, 'legendary', roll, 'goldRing')).find((g) => gearSpecs(g).affixes[kind as 'crit'] > 0)!;
    hero.equipment = { ring: special('crit') };
    expect(critChanceOf(hero)).toBeGreaterThan(0);
    hero.equipment = { ring: special('dodge') };
    expect(dodgeChanceOf(hero)).toBeGreaterThan(0);
    hero.equipment = { ring: special('speed') };
    expect(gearPace(hero)).toBeGreaterThan(1);
    hero.equipment = { ring: special('regen') };
    hero.hp = 1;
    regenerate(hero, 10);
    expect(hero.hp).toBeCloseTo(1 + gearSpecs(hero.equipment.ring!).affixes.regen);
    hero.equipment = { ring: special('leech') };
    hero.hp = 1;
    leech(hero, 100);
    expect(hero.hp).toBeGreaterThan(1);
    expect(hero.hp).toBeLessThanOrEqual(maxHpOf(hero));
  });

  it('kept in a save, worn and in the bag', () => {
    const model = fresh();
    const [worn, carried] = [key(1 + model.hero.level, 'legendary', 9), key(3, 'uncommon', 4, 'shortSword')];
    model.hero.equipment.torso = worn;
    model.hero.bag[carried] = 2;
    const again = fresh();
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.equipment.torso).toBe(worn);
    expect(again.hero.bag[carried]).toBe(2);
  });
});

describe('gear dropped and sold', () => {
  it('people and the dead leave a piece now and then, at their level; beasts none; a chief always, uncommon at the least; the same every time', () => {
    const drops = (kind: Parameters<typeof makeEnemy>[1], level = 6) => Array.from({ length: 400 }, (_, i) => rollGearDrop(makeEnemy(i, kind, i, i * 2, i, i * 2, level)));
    expect(drops('wolf').every((d) => d === null)).toBe(true);
    const bandits = drops('bandit').filter((d): d is GearKey => d !== null);
    expect(bandits.length).toBeGreaterThan(20);
    expect(bandits.length).toBeLessThan(120);
    for (const d of bandits) expect(levelOf(d)).toBe(6);
    const chiefs = drops('banditChief', 9);
    expect(chiefs.every((d) => d !== null && tierOf(rarityOf(d)) >= tierOf('uncommon') && levelOf(d) === 9)).toBe(true);
    const bandit = makeEnemy(3, 'bandit', 4, 4);
    expect(rollGearDrop(bandit, 100)).toBe(rollGearDrop(bandit, 100));
    const wore = Object.values(bandit.human!.equipment).map((k) => baseOf(k!));
    expect(wore).toContain(baseOf(rollGearDrop(bandit, 100)!)); // (one of what it wore)
  });

  it("the smith's wares forged at his village's level, a few uncommon; plain without one", () => {
    const model = fresh();
    const plain = smithShopAt(new Map(), model.seed, 3);
    expect(Object.keys(plain.stock).every((k) => !k.includes('@'))).toBe(true);
    const forged = smithShopAt(new Map(), model.seed, 3, Date.now(), 8);
    const keys = Object.keys(forged.stock) as GearKey[];
    expect(keys.every((k) => levelOf(k) === 8 && ['common', 'uncommon'].includes(rarityOf(k)))).toBe(true);
    expect(keys.some((k) => rarityOf(k) === 'uncommon')).toBe(true);
    expect(Object.keys(smithShopAt(new Map(), model.seed, 3, Date.now(), 8).stock)).toEqual(keys); // (the same each visit)
  });
});
