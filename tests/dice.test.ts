// Hazard at the inn (inn/hazard.ts, diceTable.ts, diceSharps.ts, diceHall.ts): the rules and their odds, simulated;
// the stakes; the villagers' purses and patience; the sharps' fullams, caught out or not, and crying foul blind a
// loser's game; a sharp at their table of an evening, thrown out and kept away; and the save.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { parseSave, restore, snapshot } from '../src/model/save';
import { seatOf } from '../src/model/interiors/furniture';
import { doorNumber } from '../src/model/interiors/interiors';
import { mulberry32 } from '../src/util/random';
import { DAY_MINUTES } from '../src/model/clock';
import { MAINS, casterOdds, firstThrow, fullamsAgainst, laterThrow, throwDice, type Main } from '../src/model/inn/hazard';
import { STAKE_CAP, SWITCH, castDice, cryFoul, sitDown, stakesAt, startGame, walkOut, type Sitting } from '../src/model/inn/diceTable';
import { AWAY, SHARPS, nightOf, sharpTonight } from '../src/model/inn/diceSharps';
import { tableOf } from '../src/model/inn/diceHall';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// A whole game played out on `main` at `stake`: what the hero's purse came to.
const playOut = (s: Sitting, hero: { money: number }, main: Main, stake: number, rng: () => number) => {
  startGame(s, hero, main, stake, rng);
  while (s.game && !s.game.result) castDice(s, hero, rng);
  return s.game!;
};

describe('the rules of hazard', () => {
  it('a nick on the main, crabs on two and three, eleven and twelve by the main, else a chance thrown for', () => {
    expect(firstThrow(7, 7)).toBe('nick');
    expect(firstThrow(7, 11)).toBe('nick');
    expect(firstThrow(7, 12)).toBe('crabs');
    expect(firstThrow(6, 12)).toBe('nick');
    expect(firstThrow(8, 11)).toBe('crabs');
    expect(firstThrow(5, 2)).toBe('crabs');
    expect(firstThrow(5, 3)).toBe('crabs');
    expect(firstThrow(5, 8)).toBe(8);
    expect(laterThrow(5, 8, 8)).toBe('won');
    expect(laterThrow(5, 8, 5)).toBe('lost');
    expect(laterThrow(5, 8, 7)).toBe(null);
  });

  it('the caster a shade under evens on every main, as the exact odds and a long run of games both say', () => {
    for (const main of MAINS) {
      const exact = casterOdds(main);
      expect(exact).toBeGreaterThan(0.485);
      expect(exact).toBeLessThan(0.5);
      const rng = mulberry32(main * 977);
      let won = 0;
      const games = 200_000;
      for (let i = 0; i < games; i++) {
        let chance: number | null = null;
        for (;;) {
          const [a, b] = throwDice(rng);
          if (chance === null) {
            const first = firstThrow(main, a + b);
            if (first === 'nick') won++;
            if (typeof first !== 'number') break;
            chance = first;
          } else {
            const later = laterThrow(main, chance, a + b);
            if (later === 'won') won++;
            if (later) break;
          }
        }
      }
      expect(Math.abs(won / games - exact)).toBeLessThan(0.005);
    }
  });

  it("a sharp's fullams take the caster well under: a third or so on most mains, under 45% on any", () => {
    for (const main of MAINS) expect(casterOdds(main, fullamsAgainst(main))).toBeLessThan(0.45);
    expect(casterOdds(7, fullamsAgainst(7))).toBeLessThan(0.36);
  });
});

describe('the stakes', () => {
  it('small at a first village, more further out, never past the cap', () => {
    expect(stakesAt(1)).toEqual([2, 4, 8]);
    expect(stakesAt(12)).toEqual([8, 16, 32]);
    expect(Math.max(...stakesAt(40))).toBe(STAKE_CAP);
    for (let level = 1; level < 40; level++) expect(stakesAt(level + 1)[0]).toBeGreaterThanOrEqual(stakesAt(level)[0]);
  });

  it("a stake down is held on the table; won, back doubled; lost, theirs; the hero can't stake what they haven't got", () => {
    const hero = { money: 5 };
    const s = sitDown('Aldric', null, 1, 0.5);
    expect(startGame(s, hero, 7, 8, Math.random)).toBe(null); // (too poor)
    expect(startGame(s, hero, 7, 3, Math.random)).toBe(null); // (not one of the inn's stakes)
    const g = playOut(s, hero, 7, 4, mulberry32(3));
    expect(hero.money).toBe(g.result === 'won' ? 9 : 1);
    expect(s.net).toBe(g.result === 'won' ? 4 : -4);
  });

  it("walked out of mid-game, the stake on the table is theirs", () => {
    const hero = { money: 50 };
    const s = sitDown('Aldric', null, 1, 0.5);
    startGame(s, hero, 7, 8, () => 0.5);
    walkOut(s);
    expect([hero.money, s.net, s.game!.result]).toEqual([42, -8, 'lost']);
  });
});

describe("a villager's purse and patience", () => {
  it('they stop once cleaned out, or once they have had enough', () => {
    const rng = mulberry32(11);
    for (let k = 0; k < 50; k++) {
      const hero = { money: 10_000 };
      const s = sitDown('Aldric', null, 1, k / 50);
      let games = 0;
      while (!s.over && games < 100) (playOut(s, hero, 7, s.stakes[0], rng), games++);
      expect(['cleaned out', 'enough']).toContain(s.over);
      expect(games).toBeLessThanOrEqual(10);
      expect(s.net).toBeLessThanOrEqual(12 * s.stakes[0]); // (never more off them than they brought)
    }
  });
});

describe('the sharps', () => {
  const wat = SHARPS[0];

  it('slip fullams in about a game in three, never on an honest villager', () => {
    const rng = mulberry32(5);
    let loaded = 0;
    for (let i = 0; i < 4000; i++) {
      const s = sitDown(wat.name, wat, 1, 0);
      startGame(s, { money: 100 }, 7, 2, rng);
      if (s.game!.loaded) loaded++;
      const honest = sitDown('Aldric', null, 1, 0);
      startGame(honest, { money: 100 }, 7, 2, rng);
      expect(honest.game!.loaded).toBe(null);
    }
    expect(Math.abs(loaded / 4000 - SWITCH)).toBeLessThan(0.03);
  });

  it('caught out on loaded dice: the stake back, theirs besides, and all they had won off the hero; the sitting over', () => {
    const hero = { money: 100 };
    const s = sitDown(wat.name, wat, 1, 0);
    s.net = -20; // (lost to them already)
    hero.money = 80;
    let rng = 0;
    do startGame(s, hero, 7, 4, () => ((rng = (rng + 0.137) % 1), rng)), s.game!.loaded || walkOut(s);
    while (!s.game!.loaded);
    const [before, lost] = [hero.money, -s.net];
    const cried = cryFoul(s, hero)!;
    expect(cried).toEqual({ caught: true, paid: 8 + lost });
    expect(hero.money).toBe(before + 8 + lost);
    expect(s.net).toBe(4);
    expect(s.over).toBe('caught');
  });

  it('cried foul on honest dice: the stake lost and as much again for the insult; the sitting over', () => {
    const hero = { money: 100 };
    const s = sitDown('Aldric', null, 1, 0);
    startGame(s, hero, 7, 8, () => 0.5);
    const cried = cryFoul(s, hero)!;
    expect([cried.caught, cried.paid, hero.money, s.over]).toEqual([false, 16, 84, 'wronged']);
  });

  it('crying foul blind loses; watching the dice for their tell pays', () => {
    const rng = mulberry32(17);
    const trials = 20_000;
    let [blind, watched] = [0, 0];
    for (let i = 0; i < trials; i++) {
      // Blind: foul cried after the first cast of a game, every game.
      const a = sitDown(wat.name, wat, 1, 0);
      const ha = { money: 1000 };
      startGame(a, ha, 7, 8, rng);
      castDice(a, ha, rng);
      if (!a.game!.result) cryFoul(a, ha);
      else walkOut(a);
      blind += ha.money - 1000;
      // Watched: cried only on being seen slipping them in, or on aces thrown twice running.
      const b = sitDown(wat.name, wat, 1, 0);
      const hb = { money: 1000 };
      startGame(b, hb, 7, 8, rng);
      const aces = () => b.game!.casts.slice(-2).filter(([x, y]) => x === 1 || y === 1).length === 2;
      while (!b.game!.result) {
        if (b.game!.seen || (b.game!.casts.length >= 2 && aces())) {
          cryFoul(b, hb);
          break;
        }
        castDice(b, hb, rng);
      }
      watched += hb.money - 1000;
    }
    expect(blind / trials).toBeLessThan(-2); // (of an 8-copper stake: well under)
    expect(watched / trials).toBeGreaterThan(0);
  });

  it('one about one inn-night in four, only of an evening, and none while kept away', () => {
    let seen = 0;
    for (let inn = 0; inn < 400; inn++) {
      const at = 2 * DAY_MINUTES + 20 * 60;
      const sharp = sharpTonight(7, inn * 31, at);
      if (sharp) seen++;
      expect(sharpTonight(7, inn * 31, 2 * DAY_MINUTES + 12 * 60)).toBe(null); // (noon)
      if (sharp) expect(sharpTonight(7, inn * 31, at, { [sharp.key]: nightOf(at) + 1 })).toBe(null);
      expect(sharpTonight(7, inn * 31, at + 5 * 60)).toBe(sharp); // (past midnight: the same night's)
    }
    expect(seen / 400).toBeGreaterThan(0.18);
    expect(seen / 400).toBeLessThan(0.32);
  });
});

// The nearest inn of an evening a sharp's there: the hero inside, sat at a free chair at the sharp's table.
function atTheSharpsTable() {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  enterNearest(model, 'inn', new Set());
  const door = doorNumber(model.inside!.entrance);
  let day = 1;
  while (!sharpTonight(model.seed, door, day * DAY_MINUTES + 19 * 60)) day++;
  model.minutes = day * DAY_MINUTES + 19 * 60;
  const sharp = model.folk.find((n) => n.id < -8000)!;
  expect(sharp).toBeTruthy();
  const { furniture } = model.inside!;
  const table = tableOf(furniture, sharp.seat!.piece)!;
  const chair = furniture.find((c) => c.kind === 'chair' && c !== sharp.seat!.piece && tableOf(furniture, c) === table)!;
  model.inside!.seated = { seat: seatOf(chair)!, from: { x: chair.x, z: chair.z } };
  return { model, sharp };
}

describe('a sharp at the inn', () => {
  it('sat at a table of an evening, among the folk; the hero sat at it may play them', () => {
    const { model, sharp } = atTheSharpsTable();
    expect(SHARPS.map((s) => s.name)).toContain(sharp.name);
    expect(sharp.seat?.piece.kind).toBe('chair');
    expect(model.dice.across(model.folk)).toBe(sharp);
    const at = model.dice.play(sharp)!;
    expect(at.sitting.sharp?.name).toBe(sharp.name);
    expect(sharp.dicing).toBe(true);
  });

  it('caught out: thrown out, walked to the door and gone, kept away AWAY days; the save keeps it', () => {
    const { model, sharp } = atTheSharpsTable();
    const at = model.dice.play(sharp)!;
    model.hero.money = 100;
    let r = 0;
    do startGame(at.sitting, model.hero, 7, at.sitting.stakes[0], () => ((r = (r + 0.211) % 1), r)), at.sitting.game!.loaded || walkOut(at.sitting);
    while (!at.sitting.game!.loaded);
    expect(cryFoul(at.sitting, model.hero)!.caught).toBe(true);
    model.dice.rise();
    model.dice.throwOut();
    const key = SHARPS.find((s) => s.name === sharp.name)!.key;
    expect(model.dice.away[key]).toBe(nightOf(model.minutes) + 1 + AWAY);
    for (let i = 0; i < 600 && model.folk.includes(sharp); i++) model.dice.update(model.folk, 0.1);
    expect(model.folk.some((n) => n.name === sharp.name)).toBe(false); // gone out the door, and not back tonight
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.dice.away[key]).toBe(model.dice.away[key]);
    expect(again.dice.knows(SHARPS.find((s) => s.key === key)!)).toBe(true);
  });

  it('caught out, they swing at the hero (never a fall) and the bouncer comes over and throws them out', () => {
    const { model, sharp } = atTheSharpsTable();
    model.dice.play(sharp);
    model.hero.hp = 1.05;
    const brawl = model.dice.caughtOut(model.folk)!;
    expect(brawl.sharp).toBe(sharp);
    expect(model.hero.hp).toBe(1);
    model.dice.rise();
    for (let i = 0; i < 400 && model.folk.includes(sharp); i++) {
      model.update(0, 0, 0.05);
      model.dice.update(model.folk, 0.05);
    }
    expect(model.folk.includes(sharp)).toBe(false);
  });

  it('saved mid-game: the stake on the table back in the purse', () => {
    const { model, sharp } = atTheSharpsTable();
    const at = model.dice.play(sharp)!;
    model.hero.money = 100;
    startGame(at.sitting, model.hero, 7, at.sitting.stakes[0], () => 0.9);
    expect(model.hero.money).toBe(100 - at.sitting.stakes[0]);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(again.hero.money).toBe(100);
  });

  it('an older save, with no dice in it, loads with no sharp away', () => {
    const { model } = atTheSharpsTable();
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    delete data.dice;
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(data), model.seed)!);
    expect(again.dice.away).toEqual({});
  });
});
