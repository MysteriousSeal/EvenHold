// The dead walk at night (model/roads/nightDead.ts): from 22:00, near a crypt within reach of the hero, a band of
// four of the barrow dead rises on the nearest road, out of the hero's sight, a level under the land's own foes (a
// draugr among them from level 4), and walks the road; each crypt's band once a night (cut down, it stays down,
// kept in a save); dawn sends those still walking back, gone, and says so.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import type { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { DAY_MINUTES } from '../src/model/clock';
import { BAND, DAWN, RISE, deadHours, nightOf } from '../src/model/roads/nightDead';
import { enemyLevel } from '../src/model/enemies/enemyLevels';
import { spawnOf } from '../src/model/map/grid';

const dead = (model: GameModel) => model.enemies.filter((e) => e.id >= 2 ** 47 + 2 ** 46 + 2 ** 44); // (the night's dead's ids: roads/nightDead.ts)
const at = (day: number, hour: number) => day * DAY_MINUTES + hour * 60;

// A world at night (seed 1: its crypt by its one road), the hero far enough from the road for them to rise unseen.
function night(hour = 23): GameModel {
  const model = fresh();
  model.enemies.length = 0;
  model.minutes = at(1, hour);
  const [crypt] = model.crypts;
  model.hero.x = Math.min(model.size.width - 2, crypt.middle.x + 30);
  model.hero.z = crypt.middle.z;
  return model;
}

describe('the dead walk at night', () => {
  it('only between their hours, a night counted from its evening', () => {
    expect([deadHours(at(1, RISE)), deadHours(at(1, 2)), deadHours(at(1, DAWN)), deadHours(at(1, 12))]).toEqual([true, true, false, false]);
    expect(nightOf(at(1, 23))).toBe(nightOf(at(2, 3)));
    expect(nightOf(at(2, 23))).toBe(nightOf(at(2, 3)) + 1);
  });

  it('rise in fours by the crypt\'s road, a level under the land\'s own, never by day', () => {
    const day = night(12);
    day.update(0, 0, 0.05);
    expect(dead(day)).toHaveLength(0);
    const model = night();
    model.update(0, 0, 0.05);
    const band = dead(model);
    expect(band).toHaveLength(BAND);
    expect(band.every((e) => e.kind === 'skeleton' || e.kind === 'draugr')).toBe(true);
    for (const e of band) {
      expect(Math.hypot(e.x - model.hero.x, e.z - model.hero.z)).toBeGreaterThanOrEqual(21);
      expect(e.level).toBeLessThanOrEqual(enemyLevel(spawnOf(model.size), e.homeX, e.homeZ, 0) + 1);
    }
    expect(model.takeEvents().some((e) => e.kind === 'banner' && e.title === 'The dead walk')).toBe(true);
  });

  it('walk the road, their home going along it', () => {
    const model = night();
    model.update(0, 0, 0.05);
    const [first] = dead(model);
    const home = { x: first.homeX, z: first.homeZ };
    for (let i = 0; i < 300; i++) model.update(0, 0, 1 / 30);
    expect(Math.hypot(first.homeX - home.x, first.homeZ - home.z)).toBeGreaterThan(1);
  });

  it('a band cut down stays down that night, kept in a save; the next night it rises again', () => {
    const model = night();
    model.update(0, 0, 0.05);
    for (const e of dead(model)) [e.hp, e.state] = [0, 'dead'];
    model.update(0, 0, 0.05);
    model.update(0, 0, 0.05);
    expect(dead(model).filter((e) => e.state !== 'dead')).toHaveLength(0);
    const data = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    const again = fresh();
    restore(again, data);
    again.enemies.length = 0;
    Object.assign(again.hero, { x: model.hero.x, z: model.hero.z });
    again.update(0, 0, 0.05);
    expect(dead(again)).toHaveLength(0);
    again.minutes = at(2, 23);
    again.update(0, 0, 1.1); // (a look round, a second on)
    expect(dead(again)).toHaveLength(BAND);
  });

  it('dawn sends them back: gone, and told', () => {
    const model = night(4);
    model.update(0, 0, 0.05);
    expect(dead(model)).toHaveLength(BAND);
    model.takeEvents();
    model.minutes = at(2, DAWN) + 1;
    Object.assign(model.hero, { x: dead(model)[0].x + 5, z: dead(model)[0].z });
    model.update(0, 0, 0.05);
    expect(dead(model)).toHaveLength(0);
    expect(model.takeEvents().some((e) => e.kind === 'banner' && e.title === 'Dawn')).toBe(true);
  });

  it('let go once the hero is far behind them, and risen again if they come back that night', () => {
    const model = night();
    model.update(0, 0, 0.05);
    model.roads.night.bands[0].foes.forEach((e) => Object.assign(e, { x: e.x + 500 })); // (as if the hero had walked off: far from them)
    model.update(0, 0, 1.1); // (let go, and a look round, a second on)
    expect(model.roads.night.bands).toHaveLength(1); // (gone, and risen again: the hero's still near their crypt)
  });

  it('a band cut into is spent for the night: neither a save nor walking off raises it whole again', () => {
    const model = night();
    model.update(0, 0, 0.05);
    const [band] = model.roads.night.bands;
    for (const e of band.foes.slice(0, BAND - 1)) [e.hp, e.state] = [0, 'dead']; // (three cut down, one still walking)
    const data = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    expect(data.roads && JSON.stringify(data.roads)).toContain(band.key); // (spent, in the save)
    band.foes.forEach((e) => Object.assign(e, { x: e.x + 500 })); // (walked off: let go)
    model.update(0, 0, 1.1);
    expect(model.roads.night.bands.filter((b) => b.key === band.key)).toHaveLength(0); // (not risen whole again)
  });
});

describe('the Gilded Deacon calling them (the story\'s act 3)', () => {
  it('a second band near Greyminster from act 3 till the story ends', () => {
    for (const [act, ending, bands] of [[2, null, 1], [3, null, 2], [4, 'exposed', 1]] as const) {
      const model = night();
      Object.defineProperty(model.story, 'saint', { value: { act, witch: null, ending, town: { x: model.crypts[0].middle.x, z: model.crypts[0].middle.z } }, configurable: true }); // (the story's state, stood in)
      model.update(0, 0, 0.05);
      expect(model.roads.night.bands.length, `act ${act}`).toBe(bands);
    }
  });
});

