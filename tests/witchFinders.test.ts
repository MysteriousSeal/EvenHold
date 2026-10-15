// Witch-finders on the roads (model/roads/): what's heard of the hero by village (heat.ts: raised by a turning,
// cooling a point a day, kept in a save), the bishop's men in grey walking the roads in threes (patrols.ts: more
// after arc 2 and near the cathedral, a party more for the blood on the hero's hands), coming up for a word when
// they've heard of the hero; the answers (questioning.ts: a lie by chance, a bribe, a run, a fight); and the
// stocks (arrest.ts): a day of them on the nearest square, a fine, never a burning.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { DAY_MINUTES, hourAt } from '../src/model/clock';
import { MOST, SEIZE, WANTED } from '../src/model/roads/heat';
import { PARTY, type Party } from '../src/model/roads/patrols';
import { FOUGHT, RAN, fineFor } from '../src/model/roads/arrest';
import { bribeFor, lieChance } from '../src/model/roads/questioning';
import { foeStrikes } from '../src/model/hero/fighting';
import { PITCH_TELL } from '../src/model/enemies/wildMoves';
import type { Talk } from '../src/model/story/storyTypes';

const step = (model: GameModel, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) model.update(0, 0, 1 / 30);
};

// The world's one road (seed 1), its band, and a party set out on it, `along` tiles from its start.
function withParty(along = 30): { model: GameModel; party: Party } {
  const model = fresh();
  model.enemies.length = 0;
  const [[key, band]] = [...model.travellers.bands];
  const party = model.roads.patrols.setOut(`${key}:0`, band, 0, { along, way: 1 })!;
  return { model, party };
}

// The hero stood `d` tiles from the party's leader, heard of `heat` (at the village nearest).
function near(model: GameModel, party: Party, d: number, heat: number) {
  const [leader] = party.members;
  model.heat.raise(leader, heat);
  model.teleport(leader.x + d, leader.z);
  model.hero.x = leader.x + d; // (wherever it lands: beside them)
  model.hero.z = leader.z;
}

// The word they come up for: had once they've walked up.
function stopped(model: GameModel): Talk {
  for (let i = 0; i < 300; i++) {
    model.update(0, 0, 1 / 30);
    const come = model.roads.arrived();
    if (come) return come.talk;
  }
  throw new Error('never came for a word');
}

const pick = (talk: Talk, label: string) => talk.answers.find((a) => a.label.includes(label))!.pick();

describe('heat', () => {
  it('rises at the nearest village with a turning, a person more than a foe, and cools a point a day', () => {
    const model = fresh();
    const [village] = model.villages;
    const npc = model.npcs.find((n) => n.where === null) ?? model.npcs[0];
    model.heat.onEvent({ kind: 'transformed', who: npc, into: 'chicken' });
    expect(model.heat.of(model.heat.nearest(npc)!)).toBe(3);
    expect(model.heat.known(village)).toBeGreaterThan(0);
    model.heat.update();
    model.minutes += DAY_MINUTES;
    model.heat.update();
    expect(model.heat.of(model.heat.nearest(npc)!)).toBe(2);
    model.heat.raise(npc, 50);
    expect(model.heat.of(model.heat.nearest(npc)!)).toBe(MOST);
  });

  it('fades with distance from where it was heard of', () => {
    const model = fresh();
    const v = model.villages[0];
    model.heat.raise(v, 4);
    expect(model.heat.known(v)).toBe(4);
    expect(model.heat.known({ x: v.x + 1000, z: v.z })).toBe(0);
  });

  it('is kept in a save, with the blood on their hands; an older save has none', () => {
    const model = fresh();
    model.heat.raise(model.villages[0], 4);
    model.heat.blood = 2;
    const data = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    const again = fresh();
    restore(again, data);
    expect(again.heat.of(again.villages[0])).toBe(4);
    expect(again.heat.blood).toBe(2);
    const old = { ...data, heat: undefined, roads: undefined };
    const older = fresh();
    restore(older, old);
    expect([older.heat.of(older.villages[0]), older.heat.blood]).toEqual([0, 0]);
  });
});

describe('the patrols', () => {
  it('walk in threes, a leader and the rest a pace behind each other, in grey, with a torch', () => {
    const { model, party } = withParty();
    expect(party.members).toHaveLength(PARTY);
    expect(party.members.every((t) => t.role === 'finder' && model.travellers.list.includes(t))).toBe(true);
    expect(party.members.map((t) => t.leader)).toEqual([null, party.members[0].id, party.members[1].id]);
    expect(party.members.every((t) => t.equipment.head === 'findersHat' && t.equipment.torso === 'findersCoat' && t.equipment.offHand === 'torch')).toBe(true);
    step(model, 2);
    const [a, b] = party.members;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(2);
  });

  it('are likelier on a road after arc 2 begins, near the cathedral, and while the hero is wanted on sight', () => {
    const model = fresh();
    const at = { x: model.villages[0].x + 2000, z: model.villages[0].z };
    const base = model.roads.patrols.chanceAt(at, null);
    Object.defineProperty(model.roads.patrols, 'arcTwo', { get: () => true });
    const later = model.roads.patrols.chanceAt(at, null);
    expect(later).toBeGreaterThan(base);
    expect(model.roads.patrols.chanceAt(at, at)).toBeGreaterThan(later);
  });

  it('are set out only out of the hero\'s sight, and not saved (set out afresh)', () => {
    const model = fresh();
    Object.defineProperty(model.roads.patrols, 'chanceAt', { value: () => 1 });
    step(model, 3);
    for (const p of model.roads.patrols.parties.values()) expect(Math.hypot(p.members[0].x - model.hero.x, p.members[0].z - model.hero.z)).toBeGreaterThanOrEqual(30);
    expect(snapshot(model).travellers!.on.some(([, role]) => role === 'finder')).toBe(false);
  });

  it('leave a hero they have heard nothing of be', () => {
    const { model, party } = withParty();
    near(model, party, 4, 0);
    step(model, 4);
    expect(model.roads.arrived()).toBeNull();
    expect(party.coming).toBe(false);
  });

  it('a party more for each party cut down, three more at most', () => {
    const model = fresh();
    model.heat.blood = 1;
    expect(model.roads.patrols.size).toBe(PARTY + 1);
    model.heat.blood = 10;
    expect(model.roads.patrols.size).toBe(PARTY + 3);
  });
});

describe('a word with them', () => {
  it('stops a hero they have heard of, and a lie passes or fails by a chance that falls with the heat', () => {
    expect(lieChance(1)).toBeGreaterThan(lieChance(WANTED));
    expect(lieChance(5)).toBeGreaterThanOrEqual(0.1);
    const { model, party } = withParty();
    near(model, party, 5, 1);
    model.random = () => 0; // (the lie believed)
    model.hero.money = 1000;
    const talk = stopped(model);
    expect(talk.answers.map((a) => a.label).join()).toMatch(/Lie.*poor box.*Run.*Fight/);
    const after = pick(talk, 'Lie') as Talk;
    expect(after.lines[0]).toMatch(/On your way/);
    expect(model.roads.patrols.stopped).toBeNull();
    expect(party.going).toBe(true);
  });

  it('a bribe paid: the coin gone, the word quieter, on their way', () => {
    const { model, party } = withParty();
    near(model, party, 5, 2);
    model.hero.money = 1000;
    const talk = stopped(model);
    const bribe = bribeFor(2, model.hero.level);
    pick(talk, 'poor box');
    expect(model.hero.money).toBe(1000 - bribe);
    expect(model.heat.known(party.members[0])).toBe(1);
  });

  it('a lie caught, gone quietly: a day in the stocks on the nearest square and the fine, the slate wiped', () => {
    const { model, party } = withParty();
    near(model, party, 5, WANTED);
    model.hero.money = 1000;
    model.random = () => 0.99; // (the lie seen through)
    const caught = pick(stopped(model), 'Lie') as Talk;
    expect(caught.lines[0]).toMatch(/Liar/);
    const stocks = pick(caught, 'Go quietly') as Talk;
    const was = model.minutes;
    stocks.night!();
    expect(model.hero.money).toBe(1000 - fineFor(model.hero.level));
    expect(model.minutes - was).toBeGreaterThanOrEqual(12 * 60);
    expect(hourAt(model.minutes)).toBe(18);
    const village = model.heat.nearest(model.hero)!;
    expect(Math.hypot(model.hero.x - village.x, model.hero.z - village.z)).toBeLessThan(13);
    expect(model.heat.known(model.hero)).toBe(0);
    stocks.answers[0].pick(); // (served once: nothing more taken)
    expect(model.hero.money).toBe(1000 - fineFor(model.hero.level));
  });

  it('wanted on sight: no lie to tell', () => {
    const { model, party } = withParty();
    near(model, party, 5, SEIZE);
    const talk = stopped(model);
    expect(talk.answers.some((a) => a.label.includes('Lie'))).toBe(false);
    expect(talk.answers[0].label).toBe('Go quietly');
  });

  it('a fine never takes more than the purse holds', () => {
    const { model, party } = withParty();
    near(model, party, 5, SEIZE);
    model.hero.money = 7;
    const stocks = pick(stopped(model), 'Go quietly') as Talk;
    stocks.night!();
    expect(model.hero.money).toBe(0);
  });
});

describe('running and fighting', () => {
  it('a run: foes after the hero, whose blow takes hold of them (no harm) and to the stocks, the fine half again', () => {
    const { model, party } = withParty();
    near(model, party, 5, 2);
    model.hero.money = 1000;
    pick(stopped(model), 'Run');
    const hunt = model.roads.patrols.hunts[0];
    expect(hunt.mode).toBe('seize');
    expect(hunt.foes.every((e) => e.kind === 'witchFinder' && model.enemies.includes(e) && e.human?.equipment.head === 'findersHat')).toBe(true);
    expect(party.members.some((t) => model.travellers.list.includes(t))).toBe(false);
    const hp = model.hero.hp;
    const [foe] = hunt.foes;
    Object.assign(foe, { x: model.hero.x + 0.4, z: model.hero.z });
    foeStrikes(model, foe);
    expect(model.hero.hp).toBe(hp);
    const told = model.roads.arrived()!;
    expect(told.talk.lines.join(' ')).toMatch(/stocks/);
    told.talk.night!();
    expect(model.hero.money).toBe(1000 - fineFor(model.hero.level, RAN));
    expect(model.roads.patrols.hunts).toHaveLength(0);
  });

  it('outrun: they give up, back on the road, the word of it going round', () => {
    const { model, party } = withParty();
    near(model, party, 5, 2);
    pick(stopped(model), 'Run');
    const before = model.heat.known(party.members[0]);
    model.hero.x += 45; // (got away)
    step(model, 0.1);
    expect(model.roads.patrols.hunts).toHaveLength(0);
    expect(model.heat.known(party.members[0])).toBe(before + 1);
    expect(model.roads.patrols.parties.size).toBe(1);
  });

  it('a fight won: every one cut down, blood on the hero\'s hands, the next party a man more', () => {
    const { model, party } = withParty();
    near(model, party, 5, 1);
    pick(stopped(model), 'Fight');
    const hunt = model.roads.patrols.hunts[0];
    expect(hunt.mode).toBe('fight');
    for (const e of hunt.foes) [e.hp, e.state] = [0, 'dead'];
    step(model, 0.1);
    expect(model.heat.blood).toBe(1);
    expect(model.heat.known(party.members[0])).toBeGreaterThanOrEqual(5);
    expect(model.roads.patrols.size).toBe(PARTY + 1);
  });

  it('felled in a fight with them: woken in the stocks, not at an inn, the fine doubled, no purse dropped', () => {
    const { model, party } = withParty();
    near(model, party, 5, 1);
    model.hero.money = 1000;
    pick(stopped(model), 'Fight');
    model.fall();
    expect(model.purse).toBeNull();
    const told = model.roads.arrived()!;
    expect(told.talk.lines[0]).toMatch(/Still breathing/);
    step(model, 0.1); // (the talk shut some other way: served all the same)
    expect(model.hero.money).toBe(1000 - fineFor(model.hero.level, FOUGHT));
    expect(model.hero.hp).toBeGreaterThan(0);
  });

  it('in a fight, a pot of burning pitch thrown from a few tiles off, told on the ground first; never while they would take them alive', () => {
    for (const mode of ['Fight', 'Run'] as const) {
      const { model, party } = withParty();
      near(model, party, 5, 1);
      model.hero.money = 0;
      pick(stopped(model), mode);
      const hunt = model.roads.patrols.hunts[0];
      for (const e of hunt.foes.slice(1)) model.enemies.splice(model.enemies.indexOf(e), 1);
      const [foe] = hunt.foes;
      Object.assign(foe, { x: model.hero.x - 3, z: model.hero.z, state: 'chase', swingFor: null });
      model.enemiesFrozen = true;
      for (let t = 0; t < 2.2; t += 1 / 30) model.wild.update(1 / 30);
      expect(model.wild.pitches.moves.length > 0, mode).toBe(mode === 'Fight');
      if (mode === 'Run') continue;
      const hp = model.hero.hp;
      model.random = () => 0.99; // (no dodge)
      for (let t = 0; t < PITCH_TELL + 0.1; t += 1 / 30) model.wild.update(1 / 30);
      expect(model.hero.hp).toBeLessThan(hp);
    }
  });
});
