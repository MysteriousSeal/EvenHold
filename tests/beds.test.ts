// Beds that aren't the hero's (hero/setbacks.ts): in a villager's house, its owner home turns them out of it; away, it
// rests them only as a bedroll would. A night in an inn's room, paid for (inn/roomLetting.ts): Well rested a few
// hours after (hero/blessing.ts), kept in a save.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import type { Furniture } from '../src/model/interiors/furniture';
import { layIn } from '../src/model/interiors/indoors';
import { NOT_YOURS } from '../src/model/hero/setbacks';
import { RESTED_TIME, breathFactor, feed, tiring, tossCoin } from '../src/model/hero/blessing';
import { sleepTillMorning } from '../src/model/inn/roomLetting';
import { restore, snapshot } from '../src/model/save';
import { takeSpeech } from '../src/model/npcs/speech';
import type { Npc } from '../src/model/npcs/npcs';

// In a house of the world with its owner, stood by its bed: the owner (home, or away), and the bed.
function inAHouse(model: GameModel, home: boolean): { owner: Npc; bed: Furniture } {
  for (const house of model.entrances.filter((e) => e.type === 'house')) {
    const owner = model.folk.find((n) => n.home === house);
    if (!owner) continue;
    model.enterRoom(house);
    const bed = model.inside!.furniture.find((f) => f.kind === 'bed');
    if (!bed) continue;
    owner.where = home ? house : null;
    const { width, depth } = model.inside!.room;
    for (let x = 0; x < width; x += 0.25) for (let z = 0; z < depth; z += 0.25) {
      Object.assign(model.hero, { x, z });
      if (model.seatInReach?.piece === bed) return { owner, bed };
    }
  }
  throw new Error('no house with an owner and a bed by it');
}
const said = () => takeSpeech().flatMap((e) => (e.kind === 'say' ? [e.text] : []));

describe("a bed in someone else's house", () => {
  it('its owner home: they object, and the hero is turned out of it at once, no rest', () => {
    const model = fresh();
    inAHouse(model, true);
    takeSpeech();
    model.sitOrStand();
    expect(model.seated).toBeNull();
    expect(NOT_YOURS).toContain(said()[0]);
  });

  it('its owner away: rests them as a bedroll would (half a bed), with no Well rested; turned out once they come home', () => {
    const model = fresh();
    const { owner } = inAHouse(model, false);
    model.sitOrStand();
    expect(model.seated?.seat.lying).toBe(true);
    model.hero.energy = 10;
    model.update(0, 0, 1);
    expect(model.hero.energy - 10).toBeCloseTo(1, 1); // (a bed's 2 a second, halved)
    expect(model.hero.blessings?.some((b) => b.kind === 'rested') ?? false).toBe(false);
    takeSpeech();
    owner.where = owner.home; // (home)
    model.update(0, 0, 0.1);
    expect(model.seated).toBeNull();
    expect(NOT_YOURS).toContain(said()[0]);
  });

  it('laid in it with its owner home (a night of a quest’s, their guest): left be', () => {
    const model = fresh();
    const { bed } = inAHouse(model, true);
    expect(layIn(model.inside!, model.hero, bed, { x: model.hero.x, z: model.hero.z })).toBe(true);
    takeSpeech();
    for (let t = 0; t < 1; t += 0.25) model.update(0, 0, 0.25);
    expect(model.seated?.seat.piece).toBe(bed);
    expect(said()).toEqual([]);
  });
});

describe('a night in an inn’s room', () => {
  it('leaves the hero Well rested a few hours: breath back faster, tiring slower; kept through a meal, a well and a save', () => {
    const model = fresh();
    expect([tiring(model.hero), breathFactor(model.hero)]).toEqual([1, 1]);
    sleepTillMorning(model);
    expect(model.hero.blessings).toContainEqual({ kind: 'rested', left: RESTED_TIME });
    expect(RESTED_TIME).toBeGreaterThanOrEqual(3 * 60); // (three or four hours of the clock: a second a minute)
    expect(RESTED_TIME).toBeLessThanOrEqual(4 * 60);
    expect([tiring(model.hero), breathFactor(model.hero)]).toEqual([0.75, 1.25]);
    feed(model.hero, 'fed', 60);
    model.hero.money = 1000;
    tossCoin(model.hero, 0);
    expect(model.hero.blessings!.some((b) => b.kind === 'rested')).toBe(true);
    const again = fresh();
    restore(again, JSON.parse(JSON.stringify(snapshot(model))));
    expect(again.hero.blessings!.find((b) => b.kind === 'rested')?.left).toBe(RESTED_TIME);
    for (let t = 0; t < RESTED_TIME + 1; t += 1) again.update(0, 0, 1);
    expect(again.hero.blessings!.some((b) => b.kind === 'rested')).toBe(false);
  });
});
