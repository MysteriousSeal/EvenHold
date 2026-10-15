import { describe, expect, it } from 'vitest';
import { parseSave, restore, snapshot } from '../src/model/save';
import { MAX_BOUNTIES, POSTERS, TROPHY, WEEK, posterAt } from '../src/model/quests/bounties';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import type { GameModel } from '../src/model/GameModel';
import { fresh } from './support/testWorld';

const slayTarget = (model: GameModel, key: string) => {
  const taken = model.bounties.takenOf(key)!;
  const target = model.bounties.target(taken)!;
  model.teleport(target.x - 0.4, target.z);
  model.hero.facing = Math.atan2(target.x - model.hero.x, target.z - model.hero.z);
  target.hp = 1;
  model.focus(target.id);
  model.startAttack();
  for (let i = 0; i < 60 && target.state !== 'dead'; i++) model.update(0, 0, 1 / 60);
  return target;
};

describe('bounties on the notice board', () => {
  it('posts the same posters on the same seed, two a board, richer the farther from the start', () => {
    const model = fresh();
    const posters = model.bounties.postersAt(0);
    expect(posters).toHaveLength(POSTERS);
    expect(fresh().bounties.postersAt(0)).toEqual(posters);
    for (const p of posters) {
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.copper).toBeGreaterThan(0);
      expect(p.xp).toBeGreaterThan(0);
      expect(p.where).toMatch(/(woods|meadows|heath|marsh|hills), a (long )?walk (north|south|east|west)/);
    }
    // In a streamed world, a far village's posters are of a higher level, and pay more.
    const world = { seed: 7, size: STREAMED_SIZE, villages: [], isOpenTile: () => true, isBlocked: () => false };
    const near = { ...world, villageOf: () => ({ x: 8192, z: 8192, groundTier: 1 }) };
    const far = { ...world, villageOf: () => ({ x: 8192 + 1000, z: 8192, groundTier: 1 }) };
    const [a, b] = [posterAt(near, 1, 0, 0), posterAt(far, 1, 0, 0)];
    expect(b.level).toBeGreaterThan(a.level + 15);
    expect(b.copper).toBeGreaterThan(a.copper * 3);
  });

  it('sets a named, tougher target out when taken; slain, it leaves a sack to hand in for coin and experience', () => {
    const model = fresh();
    const poster = model.bounties.postersAt(0)[0];
    expect(model.bounties.accept(poster)).toBe(true);
    expect(model.bounties.accept(poster), 'once').toBe(false);
    const taken = model.bounties.takenOf(poster.key)!;
    const target = model.bounties.target(taken)!;
    expect(target.name).toBe(poster.name);
    expect(target.maxHp).toBeGreaterThan(10);
    expect(model.enemies.filter((e) => taken.ids.includes(e.id))).toHaveLength(1 + poster.pack);
    expect(model.bounties.handIn(poster.key), 'not yet').toBeNull();
    slayTarget(model, poster.key);
    expect(taken.slain).toBe(true);
    expect(model.loot.some((l) => l.item === TROPHY)).toBe(true);
    model.hero.bag[TROPHY] = 1; // (picked up)
    const [money, xp] = [model.hero.money, model.hero.xp];
    expect(model.bounties.handIn(poster.key)).toMatch(/./);
    expect(model.hero.money - money).toBe(poster.copper);
    expect(model.hero.xp + 100 * model.hero.level).toBeGreaterThan(xp); // (experience given: maybe a level with it)
    expect(model.hero.bag[TROPHY]).toBeUndefined();
    expect(model.bounties.isCompleted(poster.key)).toBe(true);
    expect(model.bounties.accept(poster), 'done for good').toBe(false);
  });

  it('withdraws a bounty not done when its poster comes down, its target gone, and puts a new poster up', () => {
    const model = fresh();
    const poster = model.bounties.postersAt(0)[0];
    model.bounties.accept(poster);
    const ids = model.bounties.takenOf(poster.key)!.ids;
    model.minutes = poster.ends;
    model.update(0, 0, 1 / 60);
    expect(model.bounties.takenOf(poster.key)).toBeNull();
    expect(model.enemies.some((e) => ids.includes(e.id))).toBe(false);
    expect(model.bounties.postersAt(0)[0].key).not.toBe(poster.key);
    expect(model.bounties.accept(poster), 'down: not to be taken').toBe(false);
    // The other slot's turns half a week apart.
    const slots = model.bounties.postersAt(0).map((p) => p.ends);
    expect(Math.abs(slots[0] - slots[1])).toBe(WEEK / 2);
  });

  it('keeps those taken and those handed in through a save (the hunted set out again, the slain still to hand in)', () => {
    const model = fresh();
    const [a, b] = model.bounties.postersAt(0);
    model.bounties.accept(a);
    model.bounties.accept(b);
    slayTarget(model, b.key);
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    const again = fresh();
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.bounties.takenOf(a.key)?.slain).toBe(false);
    expect(again.bounties.target(again.bounties.takenOf(a.key)!)?.name).toBe(a.name);
    expect(again.bounties.takenOf(b.key)?.slain).toBe(true);
    // An older save: none.
    delete data.bounties;
    const third = fresh();
    restore(third, parseSave(JSON.stringify(data), model.seed)!);
    expect(third.bounties.taken).toHaveLength(0);
    expect(MAX_BOUNTIES).toBe(3);
  });
});
