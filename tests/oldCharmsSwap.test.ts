// The moon-turn charm, played whole (support/oldCharmStage.ts; oldCharmsWholeGame.test.ts has it cast at everyone,
// kept in a save and cast back): both ways, a man to a woman and a woman to a man, across the test seeds; whoever's
// changed living the very day they'd have lived (a game beside it where no charm was cast: the same place, the same
// errand, minute by minute), their trade, their quests and what's under way with them untouched; changed still when
// the hero's left the room and come back; a dungeon's foe only for that visit; cattle made of them after, by the sex
// they have now; and turned after, lost like anyone, with nothing of the change left to trip a save.
import { describe, expect, it } from 'vitest';
import { about, goIn, pickOut, reloaded, type Where } from './support/charmStage';
import { game, settled } from './support/oldCharmStage';
import { TEST_SEEDS } from './support/testWorld';
import { STYLES_OF } from '../src/model/human/humanoid';
import { interactionOf } from '../src/model/hero/interaction';
import { titleOf, type Npc } from '../src/model/npcs/npcs';
import { castSpell } from '../src/model/spells/casting';
import { humanOf, isFoe, isNpc } from '../src/model/spells/beings';

const PEOPLE: readonly Where[] = ['bandit', 'villager out', 'villager in', 'smith', 'barkeep', 'server', 'herbalist', 'traveller', 'stronghold'];

describe('the moon-turn, both ways', () => {
  it('makes a woman of a man and a man of a woman, on every seed: hair of the other sex, no beard on a woman, another name, the same skin and hair colour', () => {
    const ways = { male: 0, female: 0 };
    const names = new Set<string>();
    for (const seed of TEST_SEEDS) {
      for (const where of PEOPLE) {
        const made = settled(seed, where);
        if (!made) continue;
        const { model, who } = made;
        const said = `${where}, seed ${seed}`;
        const body = humanOf(who)!;
        const [was, name, worn] = [body.look, isFoe(who) ? null : who.name, JSON.stringify(body.equipment)];
        expect(castSpell(model, 'swap'), said).toBe('cast');
        const now = body.look;
        expect(JSON.stringify(body.equipment), said).toBe(worn); // (what they wear: the same)
        ways[was.build]++;
        expect(now.build, said).toBe(was.build === 'male' ? 'female' : 'male');
        expect(STYLES_OF[now.build], said).toContain(now.hairStyle);
        expect([now.skin, now.hair, now.dye, now.expression], said).toEqual([was.skin, was.hair, was.dye, was.expression]);
        if (now.build === 'female') expect(now.beard, said).toBe(false);
        if (!isFoe(who)) {
          expect(who.name, said).not.toBe(name);
          names.add(who.name);
          if (isNpc(who) && who.role !== 'villager') expect(titleOf(who), said).toMatch(new RegExp(`^${who.name} \\(`)); // (called by their trade still, as they are now)
        }
      }
    }
    expect(ways.male).toBeGreaterThan(10);
    expect(ways.female).toBeGreaterThan(10);
    expect(names.size).toBeGreaterThan(10); // (names of their own, not the one name for all)
  });
});

describe('whoever is changed, otherwise themselves', () => {
  it('lives the same day as in a game where no charm was cast: the same place and errand, minute by minute, for villagers and keepers', () => {
    for (const seed of TEST_SEEDS.slice(0, 2)) {
      for (const where of ['villager out', 'villager in', 'smith', 'barkeep', 'herbalist'] as const) {
        const [made, twin] = [settled(seed, where)!, settled(seed, where)!];
        const [one, other] = [made.who as Npc, twin.who as Npc];
        const said = `${where}, seed ${seed}`;
        expect(other.id, said).toBe(one.id);
        expect(castSpell(made.model, 'swap'), said).toBe('cast');
        made.model.moves.breath = twin.model.moves.breath; // (the Breath spent: nothing of theirs)
        const day = (npc: Npc) => ({ x: Math.round(npc.x * 1000), z: Math.round(npc.z * 1000), where: npc.where && [npc.where.x, npc.where.z], home: [npc.home.x, npc.home.z], role: npc.role, stop: npc.stop, step: npc.steps[0]?.kind, seat: npc.seat?.piece.kind, salt: npc.salt });
        expect(day(one), said).toEqual(day(other));
        for (let minute = 0; minute < 4; minute++) {
          for (const model of [made.model, twin.model]) for (let t = 0; t < 60; t += 0.1) model.update(0, 0, 0.1);
          expect(day(one), `${said}, minute ${minute + 1}`).toEqual(day(other));
        }
        expect(one.look.build, said).not.toBe(other.look.build); // (and changed still)
      }
    }
  });

  it("keeps their trade and their quests: what E does with them the same, a quest taken from them under way still, through the change and back", () => {
    let withQuests = 0;
    for (const seed of TEST_SEEDS.slice(0, 4)) {
      for (const where of ['smith', 'herbalist', 'barkeep'] as const) {
        const { model, who } = settled(seed, where)!;
        const { story } = model;
        const npc = who as Npc;
        const said = `${where}, seed ${seed}`;
        const key = story.questsOf(npc).find((q) => q.set)?.key;
        if (key) {
          story.replay(key.split('@')[0], npc);
          story.accept(key);
          withQuests++;
        }
        const state = () => ({ does: interactionOf(model)?.kind, taken: story.taken.map((t) => t.id), theirs: story.questsOf(npc).map((q) => [q.key, q.set]), shops: [...model.shops.keys()], where: npc.where });
        const before = state();
        if (key) expect(before.taken, said).toContain(key);
        expect(castSpell(model, 'swap'), said).toBe('cast');
        expect(state(), said).toEqual(before);
        expect(JSON.stringify(reloaded(model).story.taken.map((t) => t.id)), said).toBe(JSON.stringify(before.taken)); // (and in a save)
        model.moves.breath = 100;
        expect(castSpell(model, 'swap'), said).toBe('cast');
        expect(state(), said).toEqual(before);
      }
    }
    expect(withQuests).toBeGreaterThan(4);
  });

  it('is changed still when the hero has left the room and come back, and the day gone on meanwhile', () => {
    for (const seed of TEST_SEEDS.slice(0, 4)) {
      const { model, who } = settled(seed, 'smith')!;
      const door = model.inside!.entrance;
      expect(castSpell(model, 'swap'), `seed ${seed}`).toBe('cast');
      const now = { look: humanOf(who)!.look, name: (who as Npc).name };
      model.inside = null; // (out, as the door puts them)
      model.teleport(door.x, door.z);
      for (let t = 0; t < 60; t += 0.1) model.update(0, 0, 0.1);
      goIn(model, door);
      for (let t = 0; t < 2; t += 0.1) model.update(0, 0, 0.1);
      expect([model.npcs.includes(who as Npc), humanOf(who)!.look, (who as Npc).name, model.swaps.has(who)], `seed ${seed}`).toEqual([true, now.look, now.name, true]);
    }
  });
});

describe("the moon-turn on a dungeon's foe", () => {
  it('lasts that visit only: as it first was when the hero comes down again, nothing of it in a save; cast twice down there, back at once', () => {
    let seen = 0;
    for (const seed of TEST_SEEDS) {
      const made = settled(seed, 'stronghold');
      if (!made) continue;
      seen++;
      const { model, who } = made;
      const said = `seed ${seed}`;
      const [door, was] = [model.inside!.entrance, humanOf(who)!.look];
      expect(castSpell(model, 'swap'), said).toBe('cast');
      expect([humanOf(who)!.look.build === was.build, model.swaps.has(who), model.swaps.save()], said).toEqual([false, true, []]);
      // Up and out, and down again: made afresh, as the seed has them.
      model.inside = null;
      Object.assign(model as unknown as { below: null }, { below: null }); // (out, as the door puts them)
      model.teleport(door.x, door.z);
      goIn(model, door);
      const again = model.foes.find((e) => e.id === who.id && e.kind === (who as { kind: string }).kind)!;
      expect([again === who, again.human!.look, model.swaps.has(again)], said).toEqual([false, was, false]);
      // Twice down there: back at once. (Another looked at first: the focus, asked for a foe of the number it last
      // had, gives the one from the visit before, oldCharmsKnown.test.ts.)
      const other = model.foes.find((e) => e.id !== again.id)!;
      model.focus(other.id);
      expect(model.focused, said).toBe(other);
      pickOut(model, again);
      expect(model.focused, said).toBe(again);
      model.moves.breath = 100;
      expect([castSpell(model, 'swap'), again.human!.look.build === was.build], said).toEqual(['cast', false]);
      model.moves.breath = 100;
      expect([castSpell(model, 'swap'), again.human!.look, model.swaps.has(again)], said).toEqual(['cast', was, false]);
    }
    expect(seen).toBeGreaterThan(5);
  });
});

describe('someone changed, then turned', () => {
  it('into cattle: by the sex they have now, a man made a woman a cow, a woman made a man a bull; and back again, as they first were', () => {
    const seen = new Set<string>();
    for (const seed of TEST_SEEDS) {
      for (const where of ['bandit', 'villager out', 'smith', 'server', 'traveller'] as const) {
        for (const casts of [1, 2]) {
          const made = settled(seed, where);
          if (!made) continue;
          const { model, who } = made;
          const first = humanOf(who)!.look.build;
          for (let i = 0; i < casts; i++) {
            model.moves.breath = 100;
            expect(castSpell(model, 'swap'), `${where}, seed ${seed}`).toBe('cast');
          }
          const build = humanOf(who)!.look.build;
          expect(build === first, `${where}, seed ${seed}`).toBe(casts === 2);
          model.moves.breath = 100;
          expect(castSpell(model, 'cow'), `${where}, seed ${seed}`).toBe('cast');
          const beast = model.chickens.hens[model.chickens.hens.length - 1];
          expect(beast.kind, `${where}, seed ${seed}, a ${build} (first a ${first})`).toBe(build === 'male' ? 'bull' : 'cow');
          seen.add(`${first}>${build}`);
        }
      }
    }
    expect([...seen].sort()).toEqual(['female>female', 'female>male', 'male>female', 'male>male']);
  });

  it('is lost like anyone, and a save of it is read without a fault: gone still, no one else changed for it', () => {
    for (const where of ['villager out', 'smith', 'traveller', 'bandit'] as const) {
      const { model, who } = settled(TEST_SEEDS[0], where)!;
      expect(castSpell(model, 'swap'), where).toBe('cast');
      model.moves.breath = 100;
      expect(castSpell(model, 'chicken'), where).toBe('cast');
      const again = reloaded(model);
      expect([about(again, who), again.chickens.hens.map((h) => h.kind)], where).toEqual([false, ['chicken']]);
      const fresh = game(TEST_SEEDS[0]);
      const looks = (m: typeof fresh) => [...m.npcs.map((n) => [n.id, n.look.build, n.name]), ...m.travellers.list.map((t) => [t.id, t.look.build, t.name])];
      const others = (m: typeof fresh) => looks(m).filter(([id]) => isFoe(who) || id !== who.id);
      expect(others(again), where).toEqual(others(fresh)); // (everyone else as the seed has them)
      for (let t = 0; t < 3; t += 0.1) again.update(0, 0, 0.1);
    }
  });
});
