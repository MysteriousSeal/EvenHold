// What the woodworker makes beyond weapons and shields (model/skills/woodworking.ts), each with its use in the game:
// packs that give the bag more room (loot/bags.ts roomOf); axes that chop quicker and leave a second log oftener
// (skills/lumber.ts AXE_BONUS); a bedroll, used off the action bar, to lie down on anywhere outdoors and mend, slower
// than a bed (GameModel.lieDown, setbacks.ts BEDROLL_REST); trinkets set with the salvage bench's stones.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { BAG_ROOM, bagRoom, fitBag, unfitBag } from '../src/model/hero/bagSlots';
import { roomOf } from '../src/model/loot/bags';
import { groupOf, kindOf } from '../src/model/hero/bag';
import { setAction } from '../src/model/hero/actionBar';
import { recover } from '../src/model/hero/heroStats';
import { BEDROLL_REST } from '../src/model/hero/setbacks';
import { AXE_BONUS } from '../src/model/skills/lumber';
import { RECIPES, RECIPE_GROUPS } from '../src/model/skills/woodworking';
import { makeOf } from '../src/model/skills/salvage';
import { FRAME } from './support/testWorld';

describe('the packs a woodworker makes', () => {
  it('are roomier each, and fitted give the bag that room; one too full to take off stays on', () => {
    expect([roomOf('roughSack'), roomOf('birchFramedPack'), roomOf('pinePack'), roomOf('heartwoodPack')]).toEqual([6, 6, 8, 10]);
    const model = fresh();
    const { hero } = model;
    hero.bag.pinePack = 1;
    expect(fitBag(hero, 'pinePack')).toBe(true);
    expect(bagRoom(hero)).toBe(BAG_ROOM + 8);
    hero.bag.heartwoodPack = 1;
    expect(fitBag(hero, 'heartwoodPack')).toBe(true);
    expect(bagRoom(hero)).toBe(BAG_ROOM + 18);
    for (let i = 0; i < BAG_ROOM + 12; i++) hero.bag[`dagger@${i + 2}c0` as never] = 1 as never; // (near full: a pack's room in use)
    expect(unfitBag(hero, 1)).toBe(false); // (the heartwood pack's ten: too much to lose)
    for (let i = 0; i < 12; i++) delete hero.bag[`dagger@${i + 2}c0` as never];
    expect(unfitBag(hero, 1)).toBe(true);
    expect(RECIPES.heartwoodPack.makes).toBe('heartwoodPack');
  });
});

describe("a woodworker's axes", () => {
  it('chop a swing quicker, and the broad one leaves a second log oftener, in hand or in the pack', () => {
    const model = fresh();
    const { hero } = model;
    hero.equipment.mainHand = 'hatchet';
    const plain = model.lumber.chopSeconds;
    expect(model.lumber.secondLogChance(1)).toBe(0);
    hero.equipment.mainHand = 'fellingAxe';
    expect(model.lumber.chopSeconds).toBeLessThan(plain);
    hero.equipment.mainHand = undefined;
    hero.bag.broadAxe = 1;
    expect(model.lumber.axeKey).toBe('broadAxe');
    expect(model.lumber.chopSeconds).toBeLessThan(plain);
    expect(model.lumber.secondLogChance(1)).toBe(AXE_BONUS.broadAxe!.secondLog);
    expect(model.lumber.secondLogChance(300)).toBeLessThanOrEqual(0.9);
    expect([makeOf('fellingAxe'), makeOf('broadAxe')]).toEqual(['iron', 'iron']); // (broken down: iron)
  });
});

describe('the bedroll', () => {
  it('is a tool, off the action bar: lain down on outdoors, mending slower than a bed; up on walking; not indoors, nor without one', () => {
    const model = fresh();
    const { hero } = model;
    expect([kindOf('bedroll'), groupOf('bedroll')]).toEqual(['Tool', 'tool']);
    expect(setAction(hero, 0, 'bedroll')).toBe(true);
    expect(model.useAction(0)).toBe(false); // (none carried)
    hero.bag.bedroll = 1;
    hero.hp = 2;
    expect(model.useAction(0)).toBe(true);
    expect(model.outdoors.seated?.seat).toMatchObject({ lying: true, piece: { kind: 'bedroll' } });
    expect(model.seated?.seat.lying).toBe(true);
    expect(model.takeEvents().some((e) => e.kind === 'mending')).toBe(true);
    expect(model.useAction(0)).toBe(false); // (lying already)
    for (let t = 0; t < 10; t += FRAME) model.update(0, 0, FRAME);
    const mended = hero.hp - 2;
    expect(mended).toBeGreaterThan(0);
    const bed = { ...hero, hp: 2 };
    for (let t = 0; t < 10; t += FRAME) recover(bed, FRAME, true);
    expect(mended).toBeLessThan(bed.hp - 2); // (slower than a bed)
    expect(mended).toBeCloseTo((bed.hp - 2) * BEDROLL_REST, 0);
    expect(hero.bag.bedroll).toBe(1); // (kept, rolled up again)
    model.update(1, 0, FRAME); // (a step: up)
    expect(model.outdoors.seated).toBeNull();
    const house = model.entrances.find((e) => e.type === 'house')!;
    model.teleport(house.x, house.z);
    model.useDoor();
    expect(model.useAction(0)).toBe(false); // (indoors: a bed's there)
  });
});

describe('the trinkets, and the recipes as listed', () => {
  it('are set with the bench\'s stones, made at their level and rarity, silver to break down again; the recipes in groups, in the order of the skill they want', () => {
    expect(RECIPES.carvedPendant).toMatchObject({ group: 'Trinkets', from: { gemShard: 1 }, makes: { item: 'carvedPendant', rarity: 'uncommon' } });
    expect(RECIPES.heartwoodAmulet).toMatchObject({ from: { cutGem: 1 }, makes: { rarity: 'rare' } });
    expect([makeOf('bentwoodRing'), makeOf('carvedPendant'), makeOf('heartwoodAmulet')]).toEqual(['silver', 'silver', 'silver']);
    expect(RECIPE_GROUPS).toEqual(['Materials', 'Goods', 'Tools', 'Packs', 'Trinkets', 'Weapons', 'Shields']);
    const needs = Object.values(RECIPES).map((r) => r.needs);
    expect([...needs].sort((a, b) => a - b)).toEqual(needs);
    for (const recipe of Object.values(RECIPES)) expect(RECIPE_GROUPS).toContain(recipe.group);
  });
});
