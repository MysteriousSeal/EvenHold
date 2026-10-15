// The second arc, "The Bishop's Saint" (story/quests/saintQuests*.ts, story/saint/): played headlessly from the end of
// the first village's line to both its endings, in a streamed world (home, a witch's village, Greyminster: its
// people set down by hand in a far village, as the cathedral town will); saved and loaded half way; an older
// save, the first line done, opening it; the witch's chain and the bishop's purse, each way.
import { describe, expect, it } from 'vitest';
import type { GameModel } from '../src/model/GameModel';
import { GameModel as Model } from '../src/model/GameModel';
import type { Npc } from '../src/model/npcs/npcs';
import { restore, snapshot } from '../src/model/save';
import { FIRST_QUESTS } from '../src/model/story/quests/catalog';
import type { Talk } from '../src/model/story/story';
import type { GameEvent } from '../src/model/types';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { fresh } from './support/testWorld';

const TOWN = ['bishop', 'deacon', 'captain', 'sister', 'pardoner', 'prisoner'] as const;
const NAMES = { bishop: 'Bishop Osric', deacon: 'Deacon Prosper', captain: 'Captain Grey', sister: 'Sister Agnes', pardoner: 'Gil', prisoner: 'Hob' };

// A streamed world, the first village's line done (as an older save has it: its states alone, by bare names), and
// Greyminster's people stood in a village far off (the cathedral town's, till it's built).
function world(chose = 'truth', extra: Record<string, string> = {}): GameModel {
  const model = new Model(7, STREAMED_SIZE);
  model.story.load({ ...Object.fromEntries(FIRST_QUESTS.map((q) => [q.id, 'done'])), ...extra });
  model.story.choices.take('theDoorman', chose);
  const home = model.story.people!.village;
  const far = model.villages.filter((v) => Math.hypot(v.x - home.x, v.z - home.z) > 500 && !model.npcs.some((n) => n.village === v && n.role === 'witch'))[0];
  const villager = model.npcs.find((n) => n.village === far && n.role === 'villager')!;
  TOWN.forEach((role, k) => model.npcs.push({ ...villager, id: 900_000 + k, role: role as Npc['role'], name: NAMES[role] }));
  return model;
}

const of = (model: GameModel, role: string, near?: { x: number; z: number }): Npc =>
  model.npcs.filter((n) => n.role === role).sort((a, b) => (near ? Math.hypot(a.village.x - near.x, a.village.z - near.z) - Math.hypot(b.village.x - near.x, b.village.z - near.z) : 0))[0];
const go = (model: GameModel, at: { x: number; z: number }) => void [Object.assign(model.hero, { x: at.x, z: at.z }), model.story.update()];
const say = (talk: Talk | null, label?: RegExp): Talk | void => (label ? talk!.answers.find((a) => label.test(a.label))! : talk!.answers[0]).pick();
const give = (model: GameModel, item: string, count: number) => void (model.hero.bag[item as keyof typeof model.hero.bag] = count);
const id = (model: GameModel, quest: string) => model.story.keysOf(quest)[0] ?? quest;

// The arc played from its start to Greyminster's stair (the witch's chain: `witch`).
function toTheStair(model: GameModel, witch: RegExp): { home: { x: number; z: number }; road: { x: number; z: number }; town: { x: number; z: number } } {
  const { story } = model;
  const home = story.people!.village;
  const herbalist = of(model, 'herbalist', home);
  const barmaid = of(model, 'barkeep', home);
  expect(story.saint.act).toBe(1);
  expect(story.carterInReach).toBe(null); // (gone up the road)
  // Act 1: the empty wagon.
  expect(story.markOf(herbalist)).toBe('offer');
  say(story.talk(herbalist));
  expect(story.stateOf(id(model, 'theEmptyWagon'))).toBe('taken');
  const wagon = story.people!.carter.wagon;
  go(model, wagon);
  expect(story.talk(herbalist)!.lines.join(' ')).toMatch(/whip/);
  say(story.talk(herbalist));
  say(story.talk(barmaid));
  model.report({ kind: 'shift', job: 'bar', served: 5, walkedOut: 0, tally: '', earned: 10, bonus: 0, early: false });
  expect(story.talk(barmaid)!.lines.join(' ')).toMatch(/danced/);
  say(story.talk(barmaid));
  const out = story.talk(herbalist)!;
  expect(out.quest!.name).toBe('The road out');
  say(out);
  const road = story.taken.find((t) => t.name === 'The road out')!.goal!;
  go(model, road);
  expect(story.did('theRoadOut')).toBe(true);
  expect(story.saint.act).toBe(2);
  // Act 2: the road of fires.
  const witchOf = of(model, 'witch', road);
  const a = model.npcs.filter((n) => n.village === witchOf.village && n.role === 'villager').sort((x, y) => x.id - y.id)[0];
  say(story.talk(a));
  const chained = story.talk(witchOf)!;
  expect(chained.lines.join(' ')).toMatch(/staple/);
  say(chained, witch);
  give(model, 'ale', 1);
  const villagerB = model.npcs.find((n) => n.village === witchOf.village && story.talk(n)?.quest?.name === 'What the carter said')!;
  say(story.talk(villagerB));
  expect(story.talk(villagerB)!.lines.join(' ')).toMatch(/nine ales/);
  say(story.talk(villagerB));
  say(story.talk(villagerB));
  const minster = story.taken.find((t) => t.name === 'On to Greyminster')!.goal!;
  go(model, minster);
  expect(story.saint.act).toBe(3);
  // Act 3: Greyminster.
  const sister = of(model, 'sister');
  say(story.talk(sister));
  give(model, 'bread', 3);
  say(story.talk(sister));
  const pardoner = of(model, 'pardoner');
  say(story.talk(pardoner));
  give(model, 'boneCharm', 3);
  expect(story.talk(pardoner)!.lines.join(' ')).toMatch(/goat/);
  say(story.talk(pardoner));
  say(story.talk(of(model, 'deacon')));
  expect(of(model, 'prisoner').name).toBe(story.saint.carterName); // (the cells' man: the carter, by his name)
  expect(story.talk(of(model, 'prisoner'))!.lines.join(' ')).toMatch(/under the floor/i);
  say(story.talk(of(model, 'prisoner')));
  const captain = of(model, 'captain');
  say(story.talk(captain));
  give(model, 'smallFry', 2);
  say(story.talk(captain));
  const bishop = of(model, 'bishop');
  say(story.talk(bishop));
  give(model, 'wine', 3);
  expect(story.talk(bishop)!.lines.join(' ')).toMatch(/knuckle/);
  say(story.talk(bishop));
  expect(story.saint.open).toBe(false);
  say(story.talk(sister));
  expect(story.saint.open).toBe(true);
  return { home, road, town: { x: sister.village.x, z: sister.village.z } };
}

// From the stair to the end, the bishop's purse taken or thrown back (`bargain`).
function toTheEnd(model: GameModel, bargain: RegExp, home: { x: number; z: number }): Talk {
  const { story } = model;
  const sister = of(model, 'sister');
  model.report({ kind: 'cleared', name: "the bishop's ossuary", place: 'reliquary' } as unknown as GameEvent); // (the Gilded Deacon fallen: the reliquary's to tell)
  expect(story.markOf(sister)).toBe('ready');
  say(story.talk(sister));
  say(story.talk(of(model, 'deacon')));
  const purse = story.talk(of(model, 'bishop'))!;
  expect(purse.answers.map((a) => a.label)).toEqual(['Out on the steps. Tell them all.', 'Take the purse. Say nothing.', 'Let me think on it.']);
  say(purse, bargain);
  expect(story.saint.act).toBe(4);
  say(story.talk(of(model, 'prisoner')));
  go(model, home);
  expect(story.did('theRoadHome')).toBe(true);
  expect(story.saint.carterGone).toBe(false);
  const herbalist = of(model, 'herbalist', home);
  const last = story.talk(herbalist)!;
  say(last);
  expect(story.did('theLastWord')).toBe(true);
  return last;
}

describe("the second arc: the bishop's saint", () => {
  it('is played from the end of the first line to the saint shown up: the witch freed, the town told, the herbalist pointing on to EvenHold', () => {
    const model = world('truth', { aCoinAtTheWell: 'done' });
    const { story } = model;
    const raised: Array<[number, string]> = [];
    Object.assign(model, { heat: { raise: (_: unknown, n: number, why: string) => void raised.push([n, why]), calm: () => {} } }); // (the roads' witch-finders' heat, roads/heat.ts)
    const { home } = toTheStair(model, /Kick the staple/);
    expect(story.saint.witch).toBe('freed');
    expect(raised).toEqual([[3, 'Chained to her own hearth: Kick the staple out. Hide.']]);
    expect(model.npcs.some((n) => n.role === 'witch' && story.keysOf('smokeOnTheRoad').length > 0)).toBe(true); // (she lies low: still there)
    const money = model.hero.money;
    const last = toTheEnd(model, /Out on the steps/, home);
    expect(story.saint.ending).toBe('exposed');
    expect(last.lines.join(' ')).toMatch(/EvenHold/);
    expect(model.hero.money).toBeGreaterThan(money);
    expect(Object.keys(model.hero.bag).some((k) => k.startsWith('sunwardAegis'))).toBe(true); // (the truth told: the herbalist's gift)
    expect(story.talk(of(model, 'herbalist', home), id(model, 'theLastWord'), true)!.lines.join(' ')).toMatch(/end of the road/);
  }, 60_000);

  it("ends the other way: the witch handed in (taken away for good), the bishop's gold taken, and the herbalist won't speak again", () => {
    const model = world('purse');
    const { story } = model;
    const witches = model.npcs.filter((n) => n.role === 'witch').length;
    const { home } = toTheStair(model, /Call the guard/);
    expect(story.saint.witch).toBe('handed');
    expect(model.npcs.filter((n) => n.role === 'witch').length).toBe(witches - 1);
    const money = model.hero.money;
    const last = toTheEnd(model, /Take the purse/, home);
    expect(story.saint.ending).toBe('kept');
    expect(model.hero.money - money).toBeGreaterThan(600); // (the purse, and the rest)
    expect(last.lines.join(' ')).toMatch(/not speak to you again/);
    expect(story.talk(of(model, 'herbalist', home), undefined, true)!.lines.join(' ')).toMatch(/^Pay, and go.$/);
    expect([story.talk(of(model, 'herbalist', home)), story.markOf(of(model, 'herbalist', home))]).toEqual([null, null]); // (her wares, and no quests of hers)
  }, 60_000);

  it('says who vouches for the hero in Greyminster by the bouncer\'s secret, and an old pilgrim if his coin went in a well', () => {
    for (const [chose, said] of [['truth', /brother wrote/], ['mercy', /cudgel/], ['purse', /Gil the pardoner/]] as const) {
      const model = world(chose, chose === 'mercy' ? { aCoinAtTheWell: 'done' } : {});
      toTheStair(model, /Leave her/);
      const offer = FIRST_QUESTS.length && model.story.stateOf(id(model, 'whoVouchesForYou'));
      expect(offer).toBe('done');
      const lines = (STORY_LINES(model, 'whoVouchesForYou') ?? []).join(' ');
      expect(lines).toMatch(said);
      expect(/kind eyes/.test(lines)).toBe(chose === 'mercy');
    }
  }, 120_000);

  it('is saved and loaded half way (the witch\'s village kept, the way chosen there, the road on to Greyminster under way)', () => {
    const model = world();
    const { story } = model;
    const herbalist = of(model, 'herbalist', story.people!.village);
    say(story.talk(herbalist));
    go(model, story.people!.carter.wagon);
    say(story.talk(herbalist));
    const barmaid = of(model, 'barkeep', story.people!.village);
    say(story.talk(barmaid));
    story.finish(id(model, 'everyPilgrimOneWay'));
    say(story.talk(barmaid));
    say(story.talk(herbalist));
    const road = story.taken.find((t) => t.name === 'The road out')!.goal!;
    const saved = snapshot(model);
    const again = world();
    restore(again, saved);
    expect(again.story.saint.act).toBe(1);
    expect(again.story.taken.map((t) => [t.name, t.goal])).toEqual([['The road out', road]]);
    go(again, road);
    expect(again.story.saint.act).toBe(2);
    expect((snapshot(again).story as { road?: unknown }).road).toEqual(road);
  }, 60_000);
});

describe('an older save (of 0.8, before the second arc)', () => {
  it('opens the second arc where the first line was done: the carter gone from his wagon, the herbalist with the empty wagon to tell of', () => {
    const model = fresh();
    const saved = snapshot(model) as unknown as { story: unknown };
    saved.story = { states: Object.fromEntries(FIRST_QUESTS.map((q) => [`${q.id}@first`, 'done'])), counted: {}, kept: {}, forced: {}, freed: [], staked: [], choices: { theDoorman: 'mercy' } }; // (as 0.8 kept it: no road, town nor carter)
    const again = fresh();
    restore(again, saved as never);
    const { story } = again;
    expect(story.saint).toMatchObject({ act: 1, witch: null, ending: null, open: false, carterGone: true });
    expect(story.carterInReach).toBe(null);
    const herbalist = of(again, 'herbalist', story.people!.village);
    expect(story.markOf(herbalist)).toBe('offer');
    expect(story.talk(herbalist)!.quest!.name).toBe('The empty wagon');
  });

  it('with the first line still under way, leaves the second unbegun and the carter by his wagon', () => {
    const model = fresh();
    const saved = snapshot(model) as unknown as { story: unknown };
    saved.story = { states: { wordToTheInn: 'done' } }; // (older still: its states alone)
    restore(model, saved as never);
    expect(model.story.saint).toMatchObject({ act: 0, carterGone: false, carterHeld: false });
    expect(model.story.stateOf('theEmptyWagon')).toBe('locked');
  });
});

// The lines a quest of the arc opened with, as told now (its `offer`, by the ways the hero has taken).
function STORY_LINES(model: GameModel, quest: string): string[] | undefined {
  const i = (model.story as unknown as { set: { all: Map<string, { quest: { offer(t: object): string[] } }> }; told(i: object): object }).set.all.get(id(model, quest));
  return i && i.quest.offer((model.story as unknown as { told(i: object): object }).told(i));
}
