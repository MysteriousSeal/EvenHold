// A cottage of the hero's own (model/homestead/): one empty in each village of a few houses, no one living there, the
// reeve's notice inside; bought only once the village knows the hero (its board's quests), for its price, one to a
// hero; then each thing built at its chalked spot for its price: the bed (slept in free of a night, Well rested), the
// chest (the strongbox's store), the hearth (cooked at), the trophy wall (the trophies hung). Trophies taken off
// bosses, captains and bounties' targets. All kept in a save; an older save's: none.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BUILDABLE, COTTAGE_PRICE, QUESTS_KNOWN, UPGRADES, isCottage, offerOf, readCottage } from '../src/model/homestead/cottage';
import { homeAction, useHome } from '../src/model/homestead/home';
import { TROPHY_IDS, WALL_PEGS, bountyTrophy, hungOf, readTrophies, trophyOff } from '../src/model/homestead/trophies';
import { interactionOf } from '../src/model/hero/interaction';
import { strongboxInReach } from '../src/model/hero/stash';
import { roomAction, sleepTillMorning } from '../src/model/inn/roomLetting';
import { parseSave, restore, snapshot } from '../src/model/save';
import type { Entrance } from '../src/model/interiors/interiors';
import type { Furniture } from '../src/model/interiors/furniture';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A world with a cottage for sale, the hero inside it, and the village knowing them (`known`) or not.
function atCottage(known = true): { model: GameModel; door: Entrance } {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    const door = model.entrances.find((e) => e.type === 'house' && isCottage(e));
    if (!door) continue;
    model.quests.tallyAt = () => ({ completed: known ? QUESTS_KNOWN : QUESTS_KNOWN - 1, of: 6 });
    model.enterRoom(door);
    return { model, door };
  }
  throw new Error('no test world has a cottage');
}
const piece = (model: GameModel, kind: Furniture['kind'], upgrade?: string) => model.inside!.furniture.find((f) => f.kind === kind && (!upgrade || f.upgrade === upgrade))!;
// The hero stood just before a piece (the tile in front of it, along the back wall; beside it, along the left).
const before = (model: GameModel, f: Furniture) => Object.assign(model.hero, f.wall === 'left' ? { x: f.x + f.w - 0.2, z: f.z + (f.d - 1) / 2 } : { x: f.x + (f.w - 1) / 2, z: f.z + f.d });
const use = (model: GameModel) => {
  const found = interactionOf(model);
  return found?.kind === 'home' && useHome(model, found.action);
};
function bought(): { model: GameModel; door: Entrance } {
  const at = atCottage();
  at.model.hero.money = COTTAGE_PRICE + 100 * 100;
  before(at.model, piece(at.model, 'saleNotice'));
  expect(use(at.model)).toBe(true);
  return at;
}

describe('a cottage of your own', () => {
  it('stands empty in villages of a few houses: no villager lives there', () => {
    let found = 0;
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const cottages = model.entrances.filter((e) => e.type === 'house' && isCottage(e));
      found += cottages.length;
      for (const c of cottages) expect(model.npcs.some((n) => n.home === c || n.house === c)).toBe(false);
      expect(cottages.length).toBeLessThanOrEqual(model.villages.length); // (one a village, at most)
    }
    expect(found).toBeGreaterThan(0);
  });

  it("is sold by the reeve's notice only to those the village knows, and for its price", () => {
    const { model, door } = atCottage(false);
    model.hero.money = COTTAGE_PRICE * 2;
    before(model, piece(model, 'saleNotice'));
    expect(offerOf(model, door)).toEqual({ ok: false, why: 'known', done: QUESTS_KNOWN - 1 });
    expect(use(model)).toBe(false);
    expect(model.hero.cottage ?? null).toBeNull();
    model.quests.tallyAt = () => ({ completed: QUESTS_KNOWN, of: 6 });
    model.hero.money = COTTAGE_PRICE - 1;
    expect(use(model)).toBe(false); // (too poor)
    model.hero.money = COTTAGE_PRICE + 5;
    expect(use(model)).toBe(true);
    expect(model.hero.money).toBe(5);
    expect(model.hero.cottage).toEqual({ door: expect.any(Number), built: [] });
    expect(model.inside!.furniture.some((f) => f.kind === 'saleNotice')).toBe(false);
    expect(model.inside!.furniture.filter((f) => f.kind === 'cottageSpot').map((f) => f.upgrade).sort()).toEqual([...BUILDABLE].sort()); // (each chalked out)
    expect(offerOf(model, door)).toEqual({ ok: false, why: 'home' }); // (one to a hero)
  });

  it('builds each upgrade at its spot, for its price, once', () => {
    const { model } = bought();
    for (const id of BUILDABLE) {
      const spot = piece(model, 'cottageSpot', id);
      before(model, spot);
      const action = homeAction(model);
      expect(action, id).toMatchObject({ kind: 'build', upgrade: id });
      const money = model.hero.money;
      expect(useHome(model, action!)).toBe(true);
      expect(money - model.hero.money).toBe(UPGRADES[id].price);
    }
    expect(model.hero.cottage!.built.sort()).toEqual([...BUILDABLE].sort());
    expect(model.inside!.furniture.some((f) => f.kind === 'cottageSpot')).toBe(false);
    for (const kind of ['bed', 'hearth', 'cauldron', 'homeChest', 'trophyWall'] as const) expect(piece(model, kind), kind).toBeTruthy();
  });

  it("opens the strongbox's store at its chest, and cooks at its hearth", () => {
    const { model } = bought();
    model.hero.money = 1000 * 100;
    for (const id of ['chest', 'hearth'] as const) {
      before(model, piece(model, 'cottageSpot', id));
      use(model);
    }
    before(model, piece(model, 'homeChest'));
    expect(strongboxInReach(model)).toBe(piece(model, 'homeChest'));
    expect(interactionOf(model)?.kind).toBe('strongbox');
    before(model, piece(model, 'hearth'));
    expect(model.cooking.fireInReach?.kind).toBe('hearth');
  });

  it('is slept in free of a night, the hero waking Well rested; a villager\'s chest is no strongbox', () => {
    const { model } = bought();
    before(model, piece(model, 'cottageSpot', 'bed'));
    use(model);
    const bed = piece(model, 'bed');
    model.minutes = 22 * 60;
    before(model, bed);
    expect(model.sitOrStand()).toBe(true); // (lain in)
    expect(roomAction(model)).toEqual({ kind: 'sleep' });
    const money = model.hero.money;
    sleepTillMorning(model);
    expect(model.hero.blessings?.some((b) => b.kind === 'rested')).toBe(true);
    expect(model.hero.money).toBe(money);
    model.update(0, 0, 1); // (a moment in it: no owner to turn them out)
    expect(model.seated?.seat.piece).toBe(bed);
    // By day, no sleep (only a lie-down).
    model.minutes = 24 * 60 + 12 * 60;
    expect(roomAction(model)).toBeNull();
    // Another house's chest isn't the strongbox.
    const other = model.entrances.find((e) => e.type === 'house' && !isCottage(e))!;
    model.enterRoom(other);
    const chest = model.inside!.furniture.find((f) => f.kind === 'chest');
    if (chest) before(model, chest);
    expect(strongboxInReach(model)).toBeNull();
  });

  it('takes trophies off bosses, captains and bounty targets, and hangs them on the wall', () => {
    const { model } = bought();
    expect(trophyOff('cryptLord')).toBe('lordSkull');
    expect(trophyOff('captain')).toBe('captainBlade');
    expect(trophyOff('wolf')).toBeNull();
    expect(bountyTrophy('beast', 'bear')).toBe('bearHead');
    expect(bountyTrophy('outlaw', 'bandit')).toBe('outlawPoster');
    model.report({ kind: 'slain', on: 'cryptLord', x: 0, y: 0, z: 0 });
    model.report({ kind: 'slain', on: 'cryptLord', x: 0, y: 0, z: 0 });
    model.report({ kind: 'slain', on: 'broodMother', x: 0, y: 0, z: 0 });
    model.report({ kind: 'slain', on: 'wolf', x: 0, y: 0, z: 0 });
    expect(model.hero.trophies).toEqual({ lordSkull: 2, broodFangs: 1 });
    expect(model.takeEvents().filter((e) => e.kind === 'homestead')).toHaveLength(3);
    before(model, piece(model, 'cottageSpot', 'trophies'));
    use(model);
    expect(piece(model, 'trophyWall').hung).toEqual(['lordSkull', 'broodFangs']);
    expect(homeAction(model)?.kind).toBe('trophies');
    expect(hungOf(Object.fromEntries(TROPHY_IDS.map((id) => [id, 1])))).toHaveLength(Math.min(WALL_PEGS, TROPHY_IDS.length));
  });

  it('is kept in a save, and an older save has none', () => {
    const { model } = bought();
    for (const id of ['bed', 'trophies'] as const) {
      before(model, piece(model, 'cottageSpot', id));
      use(model);
    }
    model.hero.trophies = { kingCrown: 1 };
    const saved = JSON.stringify(snapshot(model));
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(saved, model.seed)!);
    expect(again.hero.cottage).toEqual(model.hero.cottage);
    expect(again.hero.trophies).toEqual({ kingCrown: 1 });
    expect(again.inside!.furniture.find((f) => f.kind === 'trophyWall')?.hung).toEqual(['kingCrown']); // (in it still, as built)
    const older = JSON.parse(saved);
    delete older.hero.cottage;
    delete older.hero.trophies;
    const old = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(old, parseSave(JSON.stringify(older), model.seed)!);
    expect(old.hero.cottage).toBeNull();
    expect(old.hero.trophies).toEqual({});
    expect(old.inside!.furniture.some((f) => f.kind === 'saleNotice')).toBe(true); // (for sale still)
    expect(readCottage({ door: 5, built: ['bed', 'bed', 'garden', 'moat'] })).toEqual({ door: 5, built: ['bed'] });
    expect(readCottage('junk')).toBeNull();
    expect(readTrophies({ lordSkull: 2, dragon: 1, kingCrown: -1 })).toEqual({ lordSkull: 2 });
  });
});
