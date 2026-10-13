// What's left of someone turned, kept as the game goes on (support/charmStage.ts: the real game, its own doors).
// A doll: on the ground where they stood, picked up into the bag, two of them one stack, sold as junk, left lying when
// the bag's full; kept in a save on the ground and in the bag; down a dungeon, on that dungeon's own floor
// (dungeons/dungeonFloors.ts), there still when the hero's gone up and come back down, and after a load. A foe turned
// down a dungeon: not back when the hero comes down again, what it became there still. And no one turned twice: a
// charm cast again at where they were finds no one, and spends nothing.
import { describe, expect, it } from 'vitest';
import { NEW_CHARMS, about, dungeonFoe, goIn, pickOut, reloaded, scene } from './support/charmStage';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { addToBag } from '../src/model/hero/bag';
import { bagRoom } from '../src/model/hero/bagSlots';
import { JUNK_STACK, slotsUsed, stacksOf } from '../src/model/hero/bagStacks';
import { LOOT } from '../src/model/loot/loot';
import { openShop, sellTo } from '../src/model/shops/shopStock';
import { isJunk, sellValue } from '../src/model/shops/sellValue';
import { castSpell } from '../src/model/spells/casting';
import { learn } from '../src/model/spells/spells';
import { mayTurn } from '../src/model/spells/turned';

const DUNGEONS = ['crypt', 'cave', 'stronghold'] as const;
const lying = (model: GameModel) => model.groundHere.loot.filter((l) => l.item === 'doll').map((l) => [l.x, l.z]);

describe('a doll', () => {
  it('is picked up into the bag, two of them one stack; sold as junk for its worth; left lying when the bag is full', () => {
    const { model, who } = scene(TEST_SEEDS[0], 'wolf')!;
    const { hero } = model;
    expect(castSpell(model, 'doll')).toBe('cast');
    const other = model.enemies.find((e) => e.kind === 'wolf' && mayTurn(e))!;
    Object.assign(other, { x: who.x + 0.4, z: who.z });
    pickOut(model, other);
    model.moves.breath = 100;
    expect(castSpell(model, 'doll')).toBe('cast');
    expect(lying(model)).toHaveLength(2);
    const used = slotsUsed(hero.bag);
    Object.assign(hero, { x: who.x, z: who.z });
    expect([model.pickUp(), model.pickUp(), model.pickUp()]).toEqual(['doll', 'doll', null]);
    expect([hero.bag.doll, slotsUsed(hero.bag) - used, lying(model).length]).toEqual([2, 1, 0]); // (one stack of the two)
    expect([stacksOf('doll', JUNK_STACK), stacksOf('doll', JUNK_STACK + 1)]).toEqual([1, 2]);
    // Kept in a save, in the bag.
    expect(reloaded(model).hero.bag.doll).toBe(2);
    // Sold, as junk is: for its worth.
    const shop = openShop(model.shops, 0, { money: 100, stock: {} } as never);
    const money = hero.money;
    expect([isJunk('doll'), sellValue('doll')]).toEqual([true, LOOT.doll.value]);
    expect(sellTo(shop, hero, 'doll', sellValue('doll')!)).toBe('sold');
    expect([hero.money - money, hero.bag.doll]).toEqual([LOOT.doll.value, 1]);
    // The bag full of other things: the next doll left where it lies, and told so.
    delete hero.bag.doll;
    const junk = (Object.keys(LOOT) as Array<keyof typeof LOOT>).filter((id) => id !== 'doll');
    for (let i = 0; slotsUsed(hero.bag) < bagRoom(hero); i++) addToBag(hero.bag, junk[i]);
    const third = model.enemies.find((e) => e.kind === 'wolf' && mayTurn(e))!;
    pickOut(model, third);
    model.moves.breath = 100;
    expect(castSpell(model, 'doll')).toBe('cast');
    Object.assign(hero, { x: third.x, z: third.z });
    model.takeEvents();
    expect(model.pickUp()).toBeNull();
    expect(model.takeEvents()).toContainEqual({ kind: 'poor', text: 'Your bag is full' });
    expect(lying(model)).toEqual([[third.x, third.z]]);
  });

  for (const type of DUNGEONS)
    it(`down a ${type}, lies on its own floor: there when the hero comes back down, and after a load; the foe not back`, () => {
      let seen = 0;
      for (const seed of TEST_SEEDS) {
        const model = new GameModel(seed, TEST_MAP_SIZE);
        learn(model.hero, 'doll');
        const foe = dungeonFoe(model, type);
        if (!foe) continue;
        seen++;
        const said = `seed ${seed}`;
        const [door, stood, foes] = [model.inside!.entrance, [foe.x, foe.z], model.foes.filter(mayTurn).length];
        pickOut(model, foe);
        expect(castSpell(model, 'doll'), said).toBe('cast');
        expect([lying(model), model.loot.length], said).toEqual([[stood], 0]); // (its floor's: not the world's)
        // Up and out; nothing of it out of doors; down again: there, and the foe not back.
        model.inside = null;
        model.teleport(door.x, door.z);
        Object.assign(model as unknown as { below: null }, { below: null }); // (out, as the door puts them)
        expect(model.dungeon, said).toBeNull();
        expect(lying(model), said).toEqual([]);
        goIn(model, door);
        expect(lying(model), said).toEqual([stood]);
        expect(model.foes.filter(mayTurn).length, said).toBe(foes - 1);
        // Saved and loaded down there: lying there still; picked up.
        const again = reloaded(model);
        expect(again.dungeon, said).not.toBeNull();
        expect(lying(again).map(([x, z]) => [Math.round(x * 100), Math.round(z * 100)]), said).toEqual([stood.map((n) => Math.round(Math.round(n * 100) / 100 * 100))]);
        Object.assign(again.hero, { x: stood[0], z: stood[1] });
        expect(again.pickUp(), said).toBe('doll');
        expect([lying(again), again.hero.bag.doll], said).toEqual([[], 1]);
      }
      expect(seen).toBeGreaterThan(5);
    });
});

describe('a foe turned down a dungeon', () => {
  for (const type of DUNGEONS)
    it(`in a ${type}: what it became there still when the hero comes back down, the foe itself not`, () => {
      for (const seed of TEST_SEEDS.slice(0, 4)) {
        for (const charm of ['pig', 'toad', 'ghost'] as const) {
          const model = new GameModel(seed, TEST_MAP_SIZE);
          learn(model.hero, charm);
          const foe = dungeonFoe(model, type);
          if (!foe) continue;
          const said = `${charm}, seed ${seed}`;
          const [door, foes] = [model.inside!.entrance, model.foes.filter(mayTurn).length];
          pickOut(model, foe);
          expect(castSpell(model, charm), said).toBe('cast');
          const beast = model.chickens.hens[0];
          for (let t = 0; t < 20; t += 0.1) model.update(0, 0, 0.1);
          if (!model.dungeon) continue; // (the hero fallen to the rest of them, and woken at an inn)
          expect(model.dungeon.free(beast.x, beast.z, 0.05), said).toBe(true); // (on its floor still, wherever it's gone)
          model.inside = null;
          Object.assign(model as unknown as { below: null }, { below: null });
          model.teleport(door.x, door.z);
          expect(model.chickens.here, said).toEqual([]); // (none of it out of doors)
          goIn(model, door);
          expect(model.chickens.here, said).toEqual([beast]);
          expect(model.foes.filter(mayTurn).length, said).toBe(foes - 1);
        }
      }
    });
});

describe('someone already turned', () => {
  it('is no one to cast at again: every charm refused, nothing spent, whatever they became left as it is', () => {
    for (const where of ['wolf', 'villager in', 'traveller', 'crypt'] as const) {
      for (const first of ['cat', 'ghost'] as const) {
        const made = scene(TEST_SEEDS[0], where)!;
        const { model, who } = made;
        expect(castSpell(model, first), where).toBe('cast');
        const [hens, breath] = [model.chickens.hens.length, (model.moves.breath = 100)];
        for (const charm of NEW_CHARMS) expect(castSpell(model, charm), `${charm} again at ${where}`).toBe('noTarget');
        expect([model.chickens.hens.length, model.moves.breath, about(model, who)], where).toEqual([hens, breath, false]);
      }
    }
  });
});
