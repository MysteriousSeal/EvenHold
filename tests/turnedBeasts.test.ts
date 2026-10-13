// The charms that turn someone into a farm beast or a small creature (model/spells/turned.ts, turnedKinds.ts): a
// pig, a sheep, a goat, a donkey; a toad, a rat, a cat. Each turns a foe (gone as if slain, nothing had for it) and
// a villager (lost to their village), the beast where they stood; each in one of its kind's coats by chance (COATS),
// told with its turning and kept in a save, a broken or older save's read soundly; each going about in its own way
// (GAIT): the farm beasts strolling and standing as a cow does, each at its own pace; a rat in short quick dashes,
// stopping often; a cat a few steps and sat a long while; a toad sat, then a hop of half a tile, told as it's made.
import { describe, expect, it } from 'vitest';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { makeEnemy } from '../src/model/enemies/enemies';
import { parseSave, restore, snapshot } from '../src/model/save';
import { castSpell } from '../src/model/spells/casting';
import { SPELLS, SPELL_IDS, learn, spellText } from '../src/model/spells/spells';
import { BEASTS, COATS, COW_COATS, GAIT, INTO, ROAM, coatsOf, type Hen } from '../src/model/spells/turned';
import type { GameEvent } from '../src/model/types';

const FARM = ['pig', 'sheep', 'goat', 'donkey'] as const;
const SMALL = ['toad', 'rat', 'cat'] as const;
const KINDS = [...FARM, ...SMALL];
type Kind = (typeof KINDS)[number];

// A game with a wolf a little ahead of the hero, focused, the hero knowing the charm; what's told kept.
function withWolf(charm: Kind) {
  const model = fresh();
  const { hero } = model;
  model.enemies.length = 0;
  hero.facing = 0;
  const foe = { ...makeEnemy(900, 'wolf', hero.x, hero.z + 2), hp: 500, maxHp: 500 }; // (one of the world's own, by its number)
  model.enemies.push(foe);
  model.focus(foe.id);
  learn(hero, charm);
  const told: GameEvent[] = [];
  const report = model.report;
  model.report = (event) => [told.push(event), report.call(model, event)];
  return { model, hero, foe, told };
}
// A game with one of that kind, turned from a wolf, the hero well off it (never in its way).
function withBeast(kind: Kind): { model: GameModel; beast: Hen } {
  const { model, hero, foe } = withWolf(kind);
  expect(model.chickens.turn(foe, kind)).toBe(true);
  const beast = model.chickens.hens[0];
  model.isOpenTile = () => true; // (open ground all about it: its going its own, not the land's)
  model.isBlocked = () => false;
  Object.assign(hero, { x: beast.x + 20, z: beast.z });
  return { model, beast };
}
// What one does over `seconds`, a tenth of a second at a time: each go it made (how far, how long), each rest (how long).
function watch(model: GameModel, beast: Hen, seconds: number, each?: () => void) {
  const [goes, rests]: [Array<{ far: number; took: number; fastest: number }>, number[]] = [[], []];
  let [moving, from, since, fastest] = [false, { x: beast.x, z: beast.z }, 0, 0];
  for (let t = 0; t < seconds; t += 0.1) {
    const [x, z] = [beast.x, beast.z];
    model.chickens.update(0.1);
    const moved = Math.hypot(beast.x - x, beast.z - z);
    if (moved > 1e-9 !== moving) {
      if (moving) goes.push({ far: Math.hypot(x - from.x, z - from.z), took: since, fastest });
      else if (since > 0) rests.push(since);
      [moving, from, since, fastest] = [!moving, { x, z }, 0, 0];
    }
    [since, fastest] = [since + 0.1, Math.max(fastest, moved / 0.1)];
    each?.();
  }
  return { goes, rests };
}

describe('the ten more charms', () => {
  it('are charms like the rest: for anyone picked out, never the hero, no wait, each turning into its own kind', () => {
    for (const id of [...KINDS, 'ghost', 'painting', 'doll'] as const) {
      expect(SPELL_IDS).toContain(id);
      expect(INTO).toContain(id);
      expect(SPELLS[id], id).toMatchObject({ aim: 'anyone', turns: id, needsTarget: true, cooldown: 0, range: 5 });
      expect(SPELLS[id].name.length, id).toBeGreaterThan(5);
      expect(SPELLS[id].about.length, id).toBeGreaterThan(60);
      expect(spellText(id)).toContain(`into a ${id}`);
    }
    expect(new Set(SPELL_IDS.map((id) => SPELLS[id].name)).size).toBe(SPELL_IDS.length); // (no two of a name)
    expect(BEASTS).not.toContain('doll'); // (a thing on the ground: none of the kept)
    expect(BEASTS).not.toContain('tree');
  });

  it('give each kind its coats: a pig 3, a sheep 2, a goat 3, a donkey 2, a toad 2, a rat 2, a cat 4; cattle 4 still', () => {
    expect(COATS).toEqual({ cow: 4, bull: 4, pig: 3, sheep: 2, goat: 3, donkey: 2, toad: 2, rat: 2, cat: 4 });
    expect(COW_COATS).toBe(4);
    for (const kind of ['chicken', 'horse', 'statue', 'ghost', 'painting', 'doll', 'tree'] as const) expect(coatsOf(kind), kind).toBe(0);
  });
});

describe.each(KINDS)('someone turned into a %s', (kind) => {
  it('is a foe gone as if slain, nothing had for it, the beast where it stood, in a coat of its kind told with its turning', () => {
    const { model, hero, foe, told } = withWolf(kind);
    const [xp, level, money, breath] = [hero.xp, hero.level, hero.money, model.moves.breath];
    expect(castSpell(model, kind)).toBe('cast');
    expect(model.moves.breath).toBe(breath - SPELLS[kind].breath);
    expect(model.enemies).not.toContain(foe); // (no more)
    expect(model.slain.has(foe.id)).toBe(true); // (the world's record: never back)
    expect([hero.xp, hero.level, hero.money]).toEqual([xp, level, money]); // (nothing had for it)
    expect(model.loot.length + model.coins.length).toBe(0);
    expect(model.chickens.hens).toHaveLength(1);
    const beast = model.chickens.hens[0];
    expect(beast).toMatchObject({ kind, x: foe.x, z: foe.z, at: null, from: { x: foe.x, z: foe.z } });
    expect(model.chickens.here).toEqual([beast]);
    expect(Number.isInteger(beast.coat)).toBe(true);
    expect(beast.coat).toBeGreaterThanOrEqual(0);
    expect(beast.coat).toBeLessThan(COATS[kind]);
    const event = told.find((e) => e.kind === 'transformed')!;
    expect(event).toMatchObject({ into: kind, coat: beast.coat, who: { id: foe.id, kind: 'wolf' } });
    expect(beast.stone).toBeUndefined(); // (itself: of no one)
    expect(beast.hung).toBeUndefined();
  });

  it('is a villager lost to their village for good, the beast where they stood; kept so in a save, with its coat', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const villager = model.npcs.find((n) => n.role === 'villager' && !n.led)!;
    const [x, z, at] = [villager.x, villager.z, villager.where];
    model.random = () => 0.99; // (the last of its coats)
    expect(model.chickens.turn(villager, kind)).toBe(true);
    expect(model.npcs).not.toContain(villager);
    expect(model.folk).not.toContain(villager);
    expect(model.chickens.lost.has(villager.id)).toBe(true);
    const beast = model.chickens.hens[0];
    expect(beast).toMatchObject({ kind, x, z, coat: COATS[kind] - 1 });
    expect(beast.at === null).toBe(at === null); // (in their house, if they were)
    const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    expect(again.npcs.some((n) => n.id === villager.id)).toBe(true);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.npcs.some((n) => n.id === villager.id)).toBe(false); // (still lost)
    expect(again.chickens.hens.map((h) => [h.kind, h.coat, h.at])).toEqual([[kind, beast.coat, beast.at]]);
    expect(again.chickens.hens[0].x).toBeCloseTo(beast.x, 1);
    expect(again.chickens.hens[0].z).toBeCloseTo(beast.z, 1);
  });

  it('has each of its coats some time, and never one it has not', () => {
    const coats = new Set<number>();
    for (let i = 0; i < 24; i++) {
      const next = withWolf(kind);
      const roll = i === 0 ? 0.999999 : (i * 0.137) % 1;
      next.model.random = () => roll;
      castSpell(next.model, kind);
      const coat = next.model.chickens.hens[0].coat!;
      expect(coat).toBeLessThan(COATS[kind]);
      expect((next.told.find((e) => e.kind === 'transformed') as { coat?: number }).coat).toBe(coat);
      coats.add(coat);
    }
    expect([...coats].sort()).toEqual(Array.from({ length: COATS[kind] }, (_, i) => i));
  });

  it("is read soundly from a broken save, or an older one: its first coat for one it can't have, or none said", () => {
    const again = fresh();
    again.chickens.load({ hens: [[1, 1, null, 1, 1, kind, 99], [2, 2, null, 2, 2, kind], [3, 3, null, 3, 3, kind, -1], [4, 4, null, 4, 4, kind, 0.5], [5, 5, null, 5, 5, kind, COATS[kind] - 1], ['x', 6, null, 6, 6, kind, 0], [7, 7, null, 7], 'nonsense'], lost: [] });
    expect(again.chickens.hens.map((h) => [h.kind, h.coat])).toEqual([[kind, 0], [kind, 0], [kind, 0], [kind, 0], [kind, COATS[kind] - 1]]);
    expect(again.chickens.hens.every((h) => h.to === null && (kind === 'toad' ? h.hop === 0 : h.hop === undefined))).toBe(true);
    for (const hen of again.chickens.hens) expect(Number.isFinite(hen.y)).toBe(true);
  });

  it('wanders for ever within reach of where it was turned, no faster than its pace', () => {
    const { model, beast } = withBeast(kind);
    const { x, z } = beast.from;
    const { goes } = watch(model, beast, 240, () => expect(Math.hypot(beast.x - x, beast.z - z)).toBeLessThanOrEqual(ROAM + 1e-6));
    expect(goes.length).toBeGreaterThan(0);
    for (const go of goes) expect(go.fastest).toBeLessThanOrEqual(GAIT[kind].pace + 1e-6);
  });
});

describe('how each goes about', () => {
  it('the farm beasts stroll and stand as a cow does, each at its own pace', () => {
    const paces = [...FARM, 'cow', 'bull', 'horse'].map((kind) => GAIT[kind as Kind].pace);
    expect(new Set(paces).size).toBe(paces.length); // (no two the same)
    for (const kind of FARM) {
      expect(GAIT[kind], kind).not.toHaveProperty('dash'); // (a stroll anywhere within reach, as hers)
      expect(GAIT[kind].stood[0], kind).toBeGreaterThanOrEqual(2); // (and a good while stood)
      const { model, beast } = withBeast(kind);
      const { goes, rests } = watch(model, beast, 400);
      const moving = goes.filter((go) => go.took > 0.5);
      expect(moving.length, kind).toBeGreaterThan(2);
      for (const go of moving) expect(go.far / go.took, kind).toBeLessThanOrEqual(GAIT[kind].pace + 1e-6);
      expect(Math.max(...moving.map((go) => go.fastest)), kind).toBeCloseTo(GAIT[kind].pace, 5); // (at its own pace, in its stride)
      for (const rest of rests.slice(1)) expect(rest, kind).toBeGreaterThanOrEqual(GAIT[kind].stood[0] - 0.11);
      expect(beast.hop, kind).toBeUndefined();
    }
  });

  it('a rat scurries in short quick dashes and stops often; a cat walks a little and sits for long spells', () => {
    const [rat, cat] = (['rat', 'cat'] as const).map((kind) => ({ ...withBeast(kind), kind })).map(({ model, beast, kind }) => ({ kind, ...watch(model, beast, 600) }));
    for (const go of rat.goes) expect(go.far).toBeLessThanOrEqual(GAIT.rat.dash! + 1e-6); // (short)
    for (const go of rat.goes) expect(go.took).toBeLessThanOrEqual(GAIT.rat.dash! / GAIT.rat.pace + 0.21); // (and soon over)
    expect(GAIT.rat.pace).toBeGreaterThan(Math.max(...FARM.map((kind) => GAIT[kind].pace), GAIT.horse.pace, GAIT.cat.pace)); // (quick: the quickest of them)
    for (const rest of rat.rests) expect(rest).toBeLessThanOrEqual(GAIT.rat.stood[1] + 0.25);
    expect(rat.goes.length).toBeGreaterThan(200); // (stopping often: a dash every couple of seconds)
    for (const go of cat.goes) expect(go.far).toBeLessThanOrEqual(GAIT.cat.dash! + 1e-6); // (a little way)
    for (const rest of cat.rests.slice(1)) expect(rest).toBeGreaterThanOrEqual(GAIT.cat.stood[0] - 0.11); // (sat long)
    expect(cat.goes.length).toBeLessThan(rat.goes.length / 5);
    const share = (seen: typeof cat) => seen.rests.reduce((sum, rest) => sum + rest, 0) / 600;
    expect(share(cat)).toBeGreaterThan(0.7); // (most of its day sat)
    expect(share(cat)).toBeGreaterThan(share(rat));
  });

  it('a toad sits, then hops a short way: `hop` 0 while sat, rising through each hop to 1 as it lands, then 0 again', () => {
    const { model, beast } = withBeast('toad');
    expect(beast.hop).toBe(0);
    let [before, hops, highest] = [0, 0, 0];
    const { goes, rests } = watch(model, beast, 300, () => {
      const hop = beast.hop!;
      expect(hop).toBeGreaterThanOrEqual(0);
      expect(hop).toBeLessThanOrEqual(1);
      if (hop > 0) {
        if (before === 0) hops++;
        expect(hop).toBeGreaterThan(before); // (ever further through it)
        expect(beast.to).not.toBeNull();
        expect(beast.peck).toBeLessThanOrEqual(0);
        highest = Math.max(highest, hop);
      } else if (before > 0) {
        expect(beast.to).toBeNull(); // (landed: sat again)
        expect(beast.peck).toBeGreaterThan(0);
      }
      before = hop;
    });
    expect(hops).toBeGreaterThan(20);
    expect(highest).toBe(1); // (a whole hop, to its landing)
    for (const go of goes) expect(go.far).toBeLessThanOrEqual(GAIT.toad.dash! + 1e-6); // (a short way: half a tile)
    expect(Math.max(...goes.map((go) => go.far))).toBeGreaterThan(GAIT.toad.dash! * 0.8);
    for (const rest of rests.slice(1)) expect(rest).toBeGreaterThanOrEqual(GAIT.toad.stood[0] - 0.11); // (sat between)
    for (const kind of [...FARM, 'rat', 'cat'] as const) expect(GAIT[kind].hops, kind).toBeUndefined(); // (the toad alone)
  });

  it('a toad with nowhere to land stays sat, and never leaves the ground', () => {
    const { model, beast } = withBeast('toad');
    model.isOpenTile = () => false;
    const [x, z] = [beast.x, beast.z];
    watch(model, beast, 60, () => expect([beast.x, beast.z, beast.hop]).toEqual([x, z, 0]));
  });
});
