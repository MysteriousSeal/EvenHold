// Each of the six older charms (a hen, cattle, a horse, the moon-turn, a statue, a tree) cast through the real game
// (support/oldCharmStage.ts: charmStage's scenes, whoever's indoors set down where they stand first), on every test
// seed, at everyone a player might cast it at: a wolf, a bandit, a villager out of doors and one at home, a smith, a
// barkeep, a server and a herbalist where they work, someone on the road, and a foe down a crypt, a cave and a
// stronghold. Each time: taken or refused as the charm's meant to be (stone and a tree out of doors only, the
// moon-turn on a man's or woman's body only), a refusal told and nothing spent, one telling of it when it's taken,
// whoever it was gone the once (or, the moon-turn: there still, and changed), what they became where they stood,
// nothing had for it, no one left picked out; then the game played on and saved and loaded. And whoever's never to
// be turned: a dungeon's boss, a camp's chief, the slain, no one, someone out of reach, someone turned already.
import { describe, expect, it } from 'vitest';
import { WHERE, about, goIn, pickOut, reloaded, telling, type Scene, type Where } from './support/charmStage';
import { OLD_CHARMS, TURNING, banners, game, settled, words, type OldCharm } from './support/oldCharmStage';
import { TEST_SEEDS, slay } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { isBoss } from '../src/model/enemies/enemyLevels';
import { isWorldFoe } from '../src/model/enemies/foeIds';
import { castSpell } from '../src/model/spells/casting';
import { humanOf, isFoe, isNpc, type Being } from '../src/model/spells/beings';
import { SPELLS } from '../src/model/spells/spells';
import { COW_COATS, ROAM, placeOf } from '../src/model/spells/turned';
import type { GameEvent, Tree } from '../src/model/types';

// Whether the charm's meant to take, there, on them (turned.ts may, swaps.ts maySwap).
const meant = (charm: OldCharm, place: Scene['place'], who: Being): boolean => (charm === 'swap' ? !!humanOf(who) : charm === 'statue' || charm === 'tree' ? place === 'out' : true);
// What a refusal's to say.
const REFUSAL: Partial<Record<OldCharm, string>> = { statue: 'Not under a roof.', tree: 'Not under a roof.', swap: 'It finds neither man nor woman there.' };

// What the game counts, to be the same after a refusal and but for the one thing after a cast.
const counts = (model: GameModel) => ({ hens: model.chickens.hens.length, trees: model.chickens.trees.length, worldTrees: model.trees.length, loot: model.groundHere.loot.length, coins: model.groundHere.coins.length, foes: model.foes.length, npcs: model.npcs.length, road: model.travellers.list.length, slain: model.slain.size, lost: model.chickens.lost.size, swapped: model.swaps.save().length, xp: model.hero.xp, level: model.hero.level, money: model.hero.money, taken: model.story.taken.length });
// Who someone is, but for their body: what a moon-turn's to leave alone.
const self = (model: GameModel, who: Being) => ({ id: who.id, equipment: humanOf(who)?.equipment, ...(isFoe(who) ? { kind: who.kind, hp: who.hp, level: who.level } : { role: who.role }), ...(isNpc(who) ? { home: who.home, where: who.where, village: who.village, quests: model.story.questsOf(who).map((q) => [q.key, q.set]) } : {}) });
const played = (model: GameModel, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += 0.1) {
    model.update(0, 0, 0.1);
    model.hero.hp = Math.max(model.hero.hp, 20); // (whatever's about: the hero not felled by it)
    each?.();
  }
};

function turned(made: Scene, charm: Exclude<OldCharm, 'swap'>, said: string): void {
  const { model, who, place, told } = made;
  const [stood, before, build] = [{ x: who.x, z: who.z }, counts(model), humanOf(who)?.look.build];
  const heroTile = [Math.round(model.hero.x), Math.round(model.hero.z)];
  const result = castSpell(model, charm);
  if (charm === 'tree' && result === 'noTarget') {
    // (Out of doors, and no natural ground beside them: a village's street.)
    expect([banners(told), words(told).length, counts(model), about(model, who)], said).toEqual([['No ground free here for them to root in.'], 1, before, true]);
    return;
  }
  if (charm === 'statue' && result === 'noTarget') {
    // (Out of doors, on their own doorstep still: whoever came out after them would be in the stone.)
    expect([banners(told), words(told).length, counts(model), about(model, who)], said).toEqual([['No room here for them to stand: a doorway, or stone there already.'], 1, before, true]);
    expect(model.entrances.some((door) => Math.hypot(door.x - who.x, door.z - who.z) < 0.45), said).toBe(true);
    return;
  }
  expect(result, said).toBe('cast');
  expect(model.moves.breath, said).toBe(100 - SPELLS[charm].breath);
  expect(words(told), said).toEqual(['cast', 'transformed']); // (told the once)
  const event = told[1] as Extract<GameEvent, { kind: 'transformed' }>;
  // Cattle: a man a bull, a woman a cow; a beast, either.
  const into = charm === 'cow' ? (build ? (build === 'male' ? 'bull' : 'cow') : event.into) : charm;
  expect(['bull', 'cow', 'chicken', 'horse', 'statue', 'tree'], said).toContain(into);
  expect(event, said).toMatchObject({ into, who: { id: who.id, x: stood.x, z: stood.z } });
  // Gone, the once; no one picked out; nothing had for it, nothing dropped.
  expect(about(model, who), said).toBe(false);
  expect([model.focused, model.chosen.person], said).toEqual([null, null]);
  const tree = charm === 'tree';
  const after = { ...before, hens: before.hens + (tree ? 0 : 1), trees: before.trees + (tree ? 1 : 0), worldTrees: before.worldTrees + (tree ? 1 : 0) };
  if (isFoe(who)) {
    expect(who.state, said).toBe('dead');
    expect({ ...counts(model), taken: before.taken }, said).toEqual({ ...after, foes: before.foes - 1, slain: before.slain + (isWorldFoe(who.id) ? 1 : 0) });
  } else if (isNpc(who)) {
    expect({ ...counts(model), taken: before.taken }, said).toEqual({ ...after, npcs: before.npcs - 1, lost: before.lost + 1 });
    expect([model.chickens.lost.has(who.id), model.folk.includes(who), model.story.questsOf(who).filter((q) => q.set)], said).toEqual([true, false, []]); // (their quests: no more of them)
  } else expect(counts(model), said).toEqual({ ...after, road: before.road - 1 });
  // What they became, where they stood.
  if (tree) {
    const rooted = model.chickens.trees[model.chickens.trees.length - 1];
    expect(event.tree, said).toBe(rooted);
    expect([Number.isInteger(rooted.x), Number.isInteger(rooted.z), rooted.planted, model.trees.filter((t) => t === rooted).length], said).toEqual([true, true, true, 1]);
    expect(Math.max(Math.abs(rooted.x - stood.x), Math.abs(rooted.z - stood.z)), said).toBeLessThanOrEqual(1.5);
    expect([rooted.x, rooted.z], said).not.toEqual(heroTile);
    expect([model.tiles.surface(rooted.x, rooted.z), model.tiles.lake(rooted.x, rooted.z), model.isOpenTile(rooted.x, rooted.z)], said).toEqual(['natural', false, false]); // (in the way, from now)
    played(model, 15);
  } else {
    const beast = model.chickens.hens[model.chickens.hens.length - 1];
    expect(beast, said).toMatchObject({ kind: into, at: place === 'out' ? null : placeOf(model.inside!.entrance), from: stood, x: stood.x, z: stood.z });
    expect(model.chickens.here, said).toContain(beast);
    if (into === 'cow' || into === 'bull') expect(Number.isInteger(beast.coat) && beast.coat! >= 0 && beast.coat! < COW_COATS, said).toBe(true);
    else expect(beast.coat, said).toBeUndefined();
    expect(event.coat, said).toBe(beast.coat);
    if (into === 'statue') {
      expect(beast.stone, said).toMatchObject({ id: who.id, ...(isFoe(who) ? { foe: who.kind } : {}), ...(humanOf(who) ? { human: { look: humanOf(who)!.look } } : {}) });
      expect(model.isBlocked(stood.x, stood.z, 0.05), said).toBe(true); // (in the way)
    } else expect(beast.stone, said).toBeUndefined();
    // Played on a while: it keeps to where it was turned (stone: to the spot), and nothing breaks.
    played(model, 15, () => {
      expect(Math.hypot(beast.x - stood.x, beast.z - stood.z), said).toBeLessThanOrEqual(into === 'statue' ? 0 : ROAM + 1e-6);
      expect([beast.x, beast.y, beast.z].every(Number.isFinite), said).toBe(true);
    });
    expect(model.chickens.hens, said).toContain(beast); // (for good)
  }
  expect(about(model, who), said).toBe(false);
  // Saved and loaded: gone still, what they became kept as it is. (A dungeon's foes are made afresh: its record of
  // the cleared is its own.)
  const again = reloaded(model);
  const kept = (m: GameModel) => ({ hens: m.chickens.hens.map((h) => [h.kind, h.at, h.coat, h.stone?.id, Math.round(h.x * 100), Math.round(h.z * 100)]), trees: m.chickens.trees.map((t: Tree) => [t.x, t.z, t.kind, t.shape, t.quarterTurns, t.groundTier]), lost: [...m.chickens.lost], slain: [...m.slain].sort() });
  expect(kept(again), said).toEqual(kept(model));
  if (!isFoe(who) || isWorldFoe(who.id)) expect(about(again, who), said).toBe(false);
  if (tree) expect([again.trees.filter((t) => t.x === event.tree!.x && t.z === event.tree!.z).length, again.isOpenTile(event.tree!.x, event.tree!.z)], said).toEqual([1, false]);
  if (into === 'statue') expect(again.isBlocked(stood.x, stood.z, 0.05), said).toBe(true);
  played(again, 3);
  expect(kept(again).hens.length, said).toBe(kept(model).hens.length);
}

function swapped(made: Scene, said: string): void {
  const { model, who, told } = made;
  const body = humanOf(who)!;
  const [before, was, wasSelf, name] = [counts(model), body.look, self(model, who), isFoe(who) ? null : who.name];
  expect(castSpell(model, 'swap'), said).toBe('cast');
  expect([model.moves.breath, words(told)], said).toEqual([100 - SPELLS.swap.breath, ['cast', 'swapped']]);
  expect(told[1], said).toMatchObject({ who, before: { look: was } });
  // There still, where they were, picked out still; the other sex, and (no foe) under another name; all else theirs.
  expect([about(model, who), isFoe(who) ? model.focused : model.chosen.person], said).toEqual([true, who]);
  expect(body.look, said).toMatchObject({ build: was.build === 'male' ? 'female' : 'male', skin: was.skin, hair: was.hair, ...(was.build === 'male' ? { beard: false } : {}) });
  if (!isFoe(who)) expect(who.name, said).not.toBe(name);
  expect(self(model, who), said).toEqual(wasSelf);
  expect(counts(model), said).toEqual({ ...before, swapped: before.swapped + (isFoe(who) && !isWorldFoe(who.id) ? 0 : 1) }); // (a dungeon's own: for that visit, none of it kept)
  expect(model.swaps.has(who), said).toBe(true);
  const now = { look: body.look, name: isFoe(who) ? null : who.name };
  // Cast again: as they were, in every part; and once more: changed as before.
  model.moves.breath = 100;
  expect(castSpell(model, 'swap'), said).toBe('cast');
  expect([body.look, isFoe(who) ? null : who.name, self(model, who), model.swaps.has(who), counts(model)], said).toEqual([was, name, wasSelf, false, before]);
  model.moves.breath = 100;
  expect(castSpell(model, 'swap'), said).toBe('cast');
  expect([body.look, isFoe(who) ? null : who.name, self(model, who)], said).toEqual([now.look, now.name, wasSelf]);
  played(model, 15);
  expect([about(model, who), body.look, isFoe(who) ? null : who.name], said).toEqual([true, now.look, now.name]);
  // Saved and loaded: changed still (a dungeon's foe: made afresh, as it first was).
  const again = reloaded(model);
  const theirs: Being | undefined = isFoe(who) ? again.foes.find((e) => e.id === who.id && e.kind === who.kind) : isNpc(who) ? again.npcs.find((n) => n.id === who.id) : again.travellers.list.find((t) => t.id === who.id);
  expect(!!theirs, said).toBe(true);
  if (isFoe(who) && !isWorldFoe(who.id)) expect([humanOf(theirs!)!.look, again.swaps.has(theirs!)], said).toEqual([was, false]);
  else {
    expect([humanOf(theirs!)!.look, isFoe(theirs!) ? null : theirs!.name, again.swaps.has(theirs!)], said).toEqual([now.look, now.name, true]);
    // And cast on them there: as they first were.
    expect(again.swaps.swap(theirs!), said).toBe(true);
    expect([humanOf(theirs!)!.look, isFoe(theirs!) ? null : theirs!.name, again.swaps.save()], said).toEqual([was, name, []]);
  }
}

function cast(seed: number, where: Where, charm: OldCharm): 'cast' | 'refused' | 'none' {
  const made = settled(seed, where);
  if (!made) return 'none';
  const { model, who, place, told } = made;
  const said = `${charm} at ${where}, seed ${seed}`;
  if (meant(charm, place, who)) return charm === 'swap' ? (swapped(made, said), 'cast') : (turned(made, charm, said), 'cast');
  // Refused: said why, and nothing else: nothing spent, no one and nothing changed, picked out still.
  const before = counts(model);
  expect(castSpell(model, charm), said).toBe('noTarget');
  expect([words(told), model.moves.breath, counts(model), about(model, who)], said).toEqual([[`banner: ${REFUSAL[charm]}`], 100, before, true]);
  expect(told[0], said).toMatchObject({ title: SPELLS[charm].name });
  expect(isFoe(who) ? model.focused : model.chosen.person, said).toBe(who);
  return 'refused';
}

describe('each older charm, through the real game', () => {
  for (const where of WHERE)
    it(`cast at ${where}, on every test seed: taken or refused as meant, the target gone once or changed, and kept so`, () => {
      const seen = { cast: 0, refused: 0, none: 0 };
      for (const seed of TEST_SEEDS) for (const charm of OLD_CHARMS) seen[cast(seed, where, charm)]++;
      expect(seen.cast, where).toBeGreaterThan(0); // (some seed has it; and some charm's taken there)
    });
});

describe('whoever an older charm is never cast at', () => {
  it("a dungeon's boss and a camp's chief are never turned, on any seed: nothing spent; the moon-turn changes those of them with a body for it", () => {
    let seen = 0;
    for (const seed of TEST_SEEDS) {
      for (const lair of ['cave', 'stronghold', 'chief'] as const) {
        const model = game(seed);
        const door = lair === 'chief' ? null : model.entrances.find((e) => e.type === lair);
        if (door) goIn(model, door);
        const boss = lair === 'chief' ? model.enemies.find((e) => e.kind === 'banditChief') : door && model.foes.find((e) => isBoss(e.kind));
        if (!boss) continue;
        seen++;
        if (lair === 'chief') model.teleport(Math.round(boss.x), Math.round(boss.z));
        pickOut(model, boss);
        const told = telling(model);
        const before = counts(model);
        for (const charm of TURNING) expect(castSpell(model, charm), `${charm} at ${boss.kind}, seed ${seed}`).toBe('noTarget');
        expect([words(told), model.moves.breath, counts(model), model.focused], `${boss.kind}, seed ${seed}`).toEqual([[], 100, before, boss]);
        const [build, hp] = [boss.human?.look.build, boss.hp];
        expect(castSpell(model, 'swap'), `${boss.kind}, seed ${seed}`).toBe(build ? 'cast' : 'noTarget');
        if (build) expect([boss.human!.look.build === build, boss.hp, model.foes.includes(boss)], `${boss.kind}, seed ${seed}`).toEqual([false, hp, true]); // (changed, and no harm in it)
      }
    }
    expect(seen).toBeGreaterThan(16);
  });

  it('none is cast at the slain, at no one, at someone out of reach or short of the Breath for it: nothing spent, nothing told', () => {
    for (const seed of TEST_SEEDS.slice(0, 3)) {
      for (const charm of OLD_CHARMS) {
        const said = `${charm}, seed ${seed}`;
        const { model, who, told } = settled(seed, 'bandit')!;
        const before = counts(model);
        model.moves.breath = SPELLS[charm].breath - 1;
        expect([castSpell(model, charm), model.moves.breath], said).toEqual(['breath', SPELLS[charm].breath - 1]);
        model.moves.breath = 100;
        const near = { x: model.hero.x, z: model.hero.z };
        Object.assign(model.hero, { x: who.x + SPELLS[charm].range + 0.2, z: who.z });
        expect(castSpell(model, charm), said).toBe('noTarget');
        Object.assign(model.hero, near);
        model.focus(null);
        expect(castSpell(model, charm), said).toBe('noTarget'); // (no one picked out: never the hero themselves)
        expect([told, model.moves.breath, counts(model), about(model, who)], said).toEqual([[], 100, before, true]);
        // The slain.
        const dead = settled(seed, 'wolf')!;
        slay(dead.model, dead.who as never);
        dead.model.focus(dead.who.id);
        dead.model.moves.breath = 100;
        dead.told.length = 0;
        const [hens, trees] = [dead.model.chickens.hens.length, dead.model.chickens.trees.length];
        expect([castSpell(dead.model, charm), dead.model.moves.breath, dead.told, dead.model.chickens.hens.length, dead.model.chickens.trees.length], said).toEqual(['noTarget', 100, [], hens, trees]);
      }
    }
  });

  it('someone turned already is no one to cast at again: every one of the six refused, nothing spent, what they became left as it is', () => {
    for (const where of ['wolf', 'villager out', 'traveller', 'smith', 'stronghold'] as const) {
      for (const first of ['chicken', 'cow', 'statue', 'tree'] as const) {
        const { model, who, place } = settled(TEST_SEEDS[0], where)!;
        if (!meant(first, place, who)) continue;
        if (castSpell(model, first) !== 'cast') continue; // (a tree, and no ground for it)
        model.moves.breath = 100;
        const before = counts(model);
        for (const charm of OLD_CHARMS) expect(castSpell(model, charm), `${charm} again at ${where}, a ${first}`).toBe('noTarget');
        expect([counts(model), model.moves.breath, about(model, who)], `${where}, a ${first}`).toEqual([before, 100, false]);
      }
    }
  });
});
