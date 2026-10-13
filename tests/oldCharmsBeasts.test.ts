// A hen, a cow, a bull and a horse, kept (support/oldCharmStage.ts: the real game). Ten minutes of each on every
// test seed, turned of a wolf's pack, at a camp, in a village, on the road, in a house and a smithy, down a crypt, a
// cave and a stronghold: on ground a body can walk, never past ROAM from where they were turned, out of water
// and off any shut tile, off the room's furniture, and wandering all the while. The coat rolled the coat told, kept and
// saved; cattle by sex, a beast either; what's kept the same, number for number, after a save and a load and a save
// of that; an older save's rows read. And what a careful hand would try besides: a quest giver turned mid-quest by
// each charm, the last of a kind turned, a whole village, every bar slot full.
import { describe, expect, it } from 'vitest';
import { grantCharm } from '../src/controller/cheats/charmCheats';
import { about, pickOut, reloaded, type Scene } from './support/charmStage';
import { OLD_CHARMS, TURNING, game, settled } from './support/oldCharmStage';
import { TEST_SEEDS } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { ACTION_SLOTS } from '../src/model/hero/actionBar';
import { roomFree } from '../src/model/npcs/npcWalk';
import type { Npc } from '../src/model/npcs/npcs';
import { parseSave, restore, snapshot } from '../src/model/save';
import { castSpell } from '../src/model/spells/casting';
import { humanOf, isFoe, type Being } from '../src/model/spells/beings';
import { knows, spellKey } from '../src/model/spells/spells';
import { COW_COATS, GAIT, ROAM, mayTurn } from '../src/model/spells/turned';
import type { GameEvent } from '../src/model/types';

const BEASTLY = ['chicken', 'cow', 'horse', 'cow'] as const;
const FRAME = 0.2; // seconds a step of the ten minutes (a beast's pace at most a sixth of a tile of it)
// Those about whoever the scene's of, to be turned with them (up to four in all).
function company({ model, who, place }: Scene, where: string): Being[] {
  const near = (b: Being) => Math.hypot(b.x - who.x, b.z - who.z) < 12;
  const others: Being[] = place === 'dungeon' ? model.foes.filter(mayTurn) : place === 'room' ? model.folk.filter((n) => n.where === model.inside!.entrance && !n.led && !n.seat) : where === 'traveller' ? [...model.travellers.list] : where === 'villager out' ? model.npcs.filter((n) => !n.where && !n.led && !n.seat && near(n)) : model.enemies.filter((e) => mayTurn(e) && near(e));
  return [who, ...others.filter((b) => b !== who)].slice(0, 4);
}

describe('a hen, cattle and a horse, ten minutes on every seed', () => {
  for (const where of ['wolf', 'bandit', 'villager out', 'traveller', 'villager in', 'smith', 'herbalist', 'crypt', 'cave', 'stronghold'] as const)
    it(`turned at ${where}: on walkable ground, within their roam, out of water, walls and furniture, and wandering`, () => {
      let [beasts, wandered] = [0, 0];
      for (const seed of TEST_SEEDS) {
        const made = settled(seed, where);
        if (!made) continue;
        const { model, place } = made;
        const heroAt = { x: model.hero.x, z: model.hero.z };
        company(made, where).forEach((one, i) => {
          pickOut(model, one);
          model.moves.breath = 100;
          expect(castSpell(model, BEASTLY[i]), `seed ${seed}`).toBe('cast');
        });
        model.foes.splice(0); // (no one left to fell the hero while they're watched)
        const { hens } = model.chickens;
        // The hero stood by, clear of every one of them (a beast gives the hero a third of a tile, and one stood on stays put).
        const clear = [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8], [0.8, 0.8], [-0.8, -0.8]].map(([dx, dz]) => ({ x: heroAt.x + dx, z: heroAt.z + dz })).find((p) => hens.every((hen) => Math.hypot(hen.x - p.x, hen.z - p.z) > 0.6));
        Object.assign(model.hero, clear ?? heroAt);
        const floor = place === 'room' ? roomFree(model.seed, model.inside!.entrance) : null;
        const [went, last] = [new Map(hens.map((hen) => [hen, 0])), new Map(hens.map((hen) => [hen, { x: hen.x, z: hen.z }]))];
        for (let t = 0; t < 600; t += FRAME) {
          model.update(0, 0, FRAME);
          expect(model.chickens.here, `seed ${seed}`).toEqual(hens); // (where the hero is, all of them, for good)
          for (const hen of hens) {
            const said = `a ${hen.kind} at ${hen.x.toFixed(2)}, ${hen.z.toFixed(2)} after ${t.toFixed(1)} s, seed ${seed}`;
            const was = last.get(hen)!;
            const step = Math.hypot(hen.x - was.x, hen.z - was.z);
            expect(step, said).toBeLessThanOrEqual(GAIT[hen.kind].pace * FRAME + 1e-9); // (at its own pace, no faster)
            expect(Math.hypot(hen.x - hen.from.x, hen.z - hen.from.z), said).toBeLessThanOrEqual(ROAM + 1e-6);
            if (floor) expect(floor(hen.x, hen.z), said).toBe(true);
            else if (place === 'dungeon') expect(model.dungeon!.free(hen.x, hen.z, 0.1), said).toBe(true);
            else {
              expect([model.tiles.lake(Math.round(hen.x), Math.round(hen.z)), model.isOpenTile(Math.round(hen.x), Math.round(hen.z))], said).toEqual([false, true]); // (dry, and no house or tree's tile: a fence along its edge is another matter, oldCharmsKnown.test.ts)
              expect(hen.y, said).toBeCloseTo(model.getGroundY(hen.x, hen.z), 6); // (on the ground, wherever it's gone)
            }
            went.set(hen, went.get(hen)! + step);
            last.set(hen, { x: hen.x, z: hen.z });
          }
        }
        beasts += hens.length;
        wandered += [...went.values()].filter((far) => far > 1).length;
      }
      expect(beasts, where).toBeGreaterThan(3);
      expect(wandered, where).toBe(beasts); // (every one of them, a way)
    });
});

describe('cattle, by sex and by coat', () => {
  it('a man is a bull and a woman a cow, wherever they are; a beast one or the other; the coat told the coat kept, in a save too', () => {
    const [made, coats] = [{ bull: 0, cow: 0, beastBull: 0, beastCow: 0 }, { bull: new Set<number>(), cow: new Set<number>() }];
    for (const seed of TEST_SEEDS) {
      for (const where of ['wolf', 'bandit', 'villager out', 'villager in', 'smith', 'barkeep', 'server', 'herbalist', 'traveller', 'cave', 'stronghold'] as const) {
        const scene = settled(seed, where);
        if (!scene) continue;
        const { model, told } = scene;
        const said = `${where}, seed ${seed}`;
        const turnedSo: Array<[string, number]> = [];
        for (const one of company(scene, where)) {
          const build = humanOf(one)?.look.build;
          pickOut(model, one);
          model.moves.breath = 100;
          told.length = 0;
          expect(castSpell(model, 'cow'), said).toBe('cast');
          const event = told.find((e): e is Extract<GameEvent, { kind: 'transformed' }> => e.kind === 'transformed')!;
          const beast = model.chickens.hens[model.chickens.hens.length - 1];
          const kind = beast.kind as 'cow' | 'bull';
          if (build) expect(kind, said).toBe(build === 'male' ? 'bull' : 'cow');
          made[build ? kind : kind === 'bull' ? 'beastBull' : 'beastCow']++;
          expect([event.into, event.coat], said).toEqual([kind, beast.coat]);
          expect(Number.isInteger(beast.coat) && beast.coat! >= 0 && beast.coat! < COW_COATS, said).toBe(true);
          coats[kind].add(beast.coat!);
          turnedSo.push([kind, beast.coat!]);
        }
        for (let t = 0; t < 5; t += 0.1) model.update(0, 0, 0.1);
        expect(model.chickens.hens.map((h) => [h.kind, h.coat]), said).toEqual(turnedSo); // (kept as rolled)
        expect(reloaded(model).chickens.hens.map((h) => [h.kind, h.coat]), said).toEqual(turnedSo); // (and saved so)
      }
    }
    expect(Object.values(made).every((n) => n > 5), JSON.stringify(made)).toBe(true); // (men and women, and beasts both ways)
    expect([coats.bull.size, coats.cow.size]).toEqual([COW_COATS, COW_COATS]); // (every coat, some time)
  });

  it('a hen and a horse have the one coat: none told, none kept', () => {
    for (const charm of ['chicken', 'horse'] as const) {
      const { model, told } = settled(TEST_SEEDS[0], 'wolf')!;
      expect(castSpell(model, charm)).toBe('cast');
      expect([(told[1] as { coat?: number }).coat, model.chickens.hens[0].coat, reloaded(model).chickens.hens[0].coat]).toEqual([undefined, undefined, undefined]);
    }
  });
});

describe('what is kept of the turned, in a save', () => {
  it('is the same number for number after a save and a load, and a save of that: every seed, out of doors, in a room and down a dungeon', () => {
    for (const seed of TEST_SEEDS) {
      const model = game(seed);
      // A wolf each of the five that turn, where the hero first stands; then a keeper in their room; then a foe down a stronghold.
      const cast = (who: Being, charm: (typeof OLD_CHARMS)[number]) => {
        pickOut(model, who);
        model.moves.breath = 100;
        return castSpell(model, charm);
      };
      TURNING.forEach((charm) => {
        const wolf = model.enemies.find((e) => !e.human && mayTurn(e))!;
        model.teleport(Math.round(wolf.x), Math.round(wolf.z));
        expect(cast(wolf, charm), `${charm}, seed ${seed}`).toBe('cast');
      });
      const bandit = model.enemies.find((e) => e.kind === 'bandit')!;
      model.teleport(Math.round(bandit.x), Math.round(bandit.z));
      expect(cast(bandit, 'swap'), `seed ${seed}`).toBe('cast');
      const smith = model.npcs.find((n) => n.role === 'smith' && n.where)!;
      model.teleport(smith.where!.x, smith.where!.z);
      model.enterRoom(smith.where!);
      for (let i = 0; i < 5; i++) model.update(0, 0, 0.1);
      expect(cast(smith, 'cow'), `seed ${seed}`).toBe('cast');
      model.inside = null;
      const down = model.entrances.find((e) => e.type === 'stronghold')!;
      model.teleport(down.x, down.z);
      model.enterRoom(down);
      expect(cast(model.foes.find(mayTurn)!, 'horse'), `seed ${seed}`).toBe('cast');
      model.foes.splice(0); // (the rest of them: no one to fell the hero meanwhile)
      for (let t = 0; t < 10; t += 0.1) model.update(0, 0, 0.1);
      const first = JSON.parse(JSON.stringify(snapshot(model)));
      expect([first.chickens.hens.length, first.chickens.trees.length, first.chickens.lost, first.swaps], `seed ${seed}`).toEqual([6, 1, [smith.id], [`f:${bandit.id}`]]);
      const again = reloaded(model);
      const second = JSON.parse(JSON.stringify(snapshot(again)));
      expect([second.chickens, second.swaps], `seed ${seed}`).toEqual([first.chickens, first.swaps]);
      const third = JSON.parse(JSON.stringify(snapshot(reloaded(again))));
      expect([third.chickens, third.swaps], `seed ${seed}`).toEqual([first.chickens, first.swaps]);
      // And in the game taken up: each where it was, the one down the stronghold there with the hero.
      expect(again.chickens.hens.map((h) => [h.kind, h.at, h.coat]), `seed ${seed}`).toEqual(model.chickens.hens.map((h) => [h.kind, h.at, h.coat]));
      expect(again.chickens.here.map((h) => h.kind), `seed ${seed}`).toEqual(['horse']);
      expect([again.npcs.some((n) => n.id === smith.id), again.enemies.find((e) => e.id === bandit.id)?.human!.look], `seed ${seed}`).toEqual([false, bandit.human!.look]);
    }
  });

  it('an older save is read: a hen of five numbers, a cow or a bull with no coat said (its first), no trees, no one changed; a statue of no one left out', () => {
    const model = game(TEST_SEEDS[0]);
    const wolves = model.enemies.filter((e) => !e.human && mayTurn(e)).slice(0, 4);
    (['chicken', 'cow', 'horse', 'statue'] as const).forEach((into, i) => expect(model.chickens.turn(wolves[i], into)).toBe(true));
    const saved = JSON.parse(JSON.stringify(snapshot(model)));
    const kinds = model.chickens.hens.map((h) => h.kind);
    // As it was written before coats, before stone, before trees and the moon-turn.
    saved.chickens = { hens: saved.chickens.hens.map((row: unknown[], i: number) => (i === 0 ? row.slice(0, 5) : row.slice(0, 6))), lost: [] };
    delete saved.swaps;
    delete saved.floors;
    const again = game(TEST_SEEDS[0]);
    restore(again, parseSave(JSON.stringify(saved), again.seed)!);
    expect(again.chickens.hens.map((h) => [h.kind, h.coat, h.at])).toEqual([['chicken', undefined, null], [kinds[1], 0, null], ['horse', undefined, null]]); // (the statue: of no one, none)
    expect([again.chickens.trees, again.swaps.save(), wolves.some((w) => again.enemies.some((e) => e.id === w.id))]).toEqual([[], [], false]);
    for (let t = 0; t < 30; t += 0.1) again.update(0, 0, 0.1);
    expect(again.chickens.hens.every((h) => Math.hypot(h.x - h.from.x, h.z - h.from.z) <= ROAM + 1e-6)).toBe(true);
    // And with nothing of the turned in it at all.
    delete saved.chickens;
    const bare = game(TEST_SEEDS[0]);
    restore(bare, parseSave(JSON.stringify(saved), bare.seed)!);
    expect([bare.chickens.hens, bare.chickens.trees, [...bare.chickens.lost]]).toEqual([[], [], []]);
  });
});

describe('what a careful hand would try', () => {
  it('a quest giver turned mid-quest, by each charm that turns: their quest let go, no more of theirs, the game played on and saved', () => {
    for (const charm of TURNING) {
      const model = game(TEST_SEEDS[0]);
      const { story } = model;
      const giver = model.npcs.find((n) => n.role === 'herbalist' && story.questsOf(n).some((q) => q.set))!;
      const key = story.questsOf(giver).find((q) => q.set)!.key;
      story.replay(key.split('@')[0], giver);
      story.accept(key);
      expect(story.taken.some((t) => t.id === key), charm).toBe(true);
      // (Stone and a tree: out of doors only; she's brought out to her door.)
      if (charm === 'statue' || charm === 'tree') {
        Object.assign(giver, { where: null, x: giver.home.x + giver.home.outX * 3, z: giver.home.z + giver.home.outZ * 3 });
        model.teleport(Math.round(giver.x), Math.round(giver.z));
      } else {
        model.teleport(giver.home.x, giver.home.z);
        model.enterRoom(giver.home);
        for (let i = 0; i < 5; i++) model.update(0, 0, 0.1);
      }
      pickOut(model, giver);
      const cast = castSpell(model, charm);
      if (charm === 'tree' && cast === 'noTarget') continue; // (no natural ground by her door)
      expect(cast, charm).toBe('cast');
      expect([story.taken.some((t) => t.id === key), story.questsOf(giver).filter((q) => q.set), about(model, giver)], charm).toEqual([false, [], false]);
      for (let t = 0; t < 30; t += 0.1) model.update(0, 0, 0.1);
      const again = reloaded(model);
      expect([again.story.taken.some((t) => t.id === key), about(again, giver)], charm).toEqual([false, false]);
      for (let t = 0; t < 5; t += 0.1) again.update(0, 0, 0.1);
    }
  });

  it('the last of a kind turned: every wolf, everyone on the roads, a whole village and its keepers; the day goes on, and a save of it', () => {
    for (const seed of TEST_SEEDS.slice(0, 3)) {
      const model = game(seed);
      const said = `seed ${seed}`;
      const village = model.villages[0];
      const folk = model.npcs.filter((n) => n.village === village && !n.led);
      const all: Being[] = [...model.enemies.filter((e) => e.kind === 'wolf' && mayTurn(e)), ...model.travellers.list, ...folk];
      const [slain, road] = [model.slain.size, model.travellers.list.length];
      all.forEach((one, i) => expect(model.chickens.turn(one, (['chicken', 'cow', 'horse'] as const)[i % 3]), said).toBe(true));
      const wolves = all.filter((b) => isFoe(b)).length;
      expect([model.enemies.some((e) => e.kind === 'wolf'), model.travellers.list.length, model.npcs.some((n) => n.village === village), model.slain.size - slain, model.chickens.hens.length], said).toEqual([false, 0, false, wolves, all.length]);
      expect(road + folk.length + wolves, said).toBe(all.length);
      // A day in the emptied village, and at its inn.
      model.teleport(village.x, village.z);
      for (let t = 0; t < 300; t += 0.25) model.update(0, 0, 0.25);
      const inn = model.entrances.find((e) => e.type === 'inn' && folk.some((n: Npc) => n.home === e || n.where === e));
      if (inn) {
        model.teleport(inn.x, inn.z);
        model.enterRoom(inn);
        for (let t = 0; t < 30; t += 0.1) model.update(0, 0, 0.1);
        model.inside = null;
      }
      const again = reloaded(model);
      expect([again.enemies.some((e) => e.kind === 'wolf'), again.travellers.list.length, again.npcs.some((n) => n.village === village), again.chickens.hens.length, again.chickens.lost.size], said).toEqual([false, 0, false, all.length, folk.length]);
      for (let t = 0; t < 60; t += 0.25) again.update(0, 0, 0.25);
    }
  });

  it('every slot of the bar full: an older charm handed out is known all the same, said to have no room, and not cast from the bar', () => {
    const model: GameModel = game(TEST_SEEDS[0]);
    const { hero } = model;
    hero.spells = [];
    hero.actionBar = Array.from({ length: ACTION_SLOTS }, () => 'bedroll' as const);
    const said = OLD_CHARMS.map((charm) => grantCharm(model, charm));
    expect(said.every((line) => /bar is full/.test(line)), said.join(' | ')).toBe(true);
    expect([OLD_CHARMS.every((charm) => knows(hero, charm)), hero.actionBar.some((slot) => OLD_CHARMS.some((charm) => slot === spellKey(charm)))]).toEqual([true, false]);
    expect(OLD_CHARMS.every((charm) => knows(reloaded(model).hero, charm))).toBe(true);
  });
});
