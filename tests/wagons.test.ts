// The wagons between villages (villages/wagons.ts): any village been to is a stop; from a board, a ride to any other,
// for a fare and hours on the road by how far; paid, the hours gone, set down on that village's square. Kept.
import { describe, expect, it } from 'vitest';
import { fareFor, hoursFor, readStops, ridesFrom, takeRide } from '../src/model/villages/wagons';
import { restore, snapshot } from '../src/model/save';
import { fresh } from './support/testWorld';

const visit = (model: ReturnType<typeof fresh>, i: number) => {
  const v = model.villages[i];
  model.teleport(v.x + 1, v.z + 1);
  model.update(0, 0, 0.05);
};

describe('the wagons', () => {
  it('stop at every village been to; from one, a ride to each other, the nearest first, dearer and longer the farther', () => {
    const model = fresh();
    for (const i of [0, 1]) visit(model, i);
    expect(model.welcome.stops.size).toBe(2);
    const here = model.villages[0];
    const rides = ridesFrom(model.welcome.stops, here);
    expect(rides).toHaveLength(1); // (not to the one they're at)
    const d = (r: { x: number; z: number }) => Math.hypot(r.x - here.x, r.z - here.z);
    expect(rides[0].fare).toBe(fareFor(d(rides[0])));
    const far = { name: 'Far', level: 9, x: here.x + 900, z: here.z };
    const more = ridesFrom(new Map([...model.welcome.stops, ['far', far]]), here);
    expect(more.map((r) => r.name).at(-1)).toBe('Far'); // (the nearest first)
    expect(more[1].fare).toBeGreaterThan(more[0].fare);
    expect([hoursFor(10), hoursFor(900)]).toEqual([1, 18]);
  });

  it('paid for, the hours gone by, set down there; not without the fare', () => {
    const model = fresh();
    for (const i of [0, 1]) visit(model, i);
    const here = model.villages[0];
    const [ride] = ridesFrom(model.welcome.stops, here);
    model.hero.money = ride.fare - 1;
    expect(takeRide(model, model.welcome.stops, here, ride.key)).toBe('too poor');
    model.hero.money = ride.fare + 5;
    const minutes = model.minutes;
    expect(takeRide(model, model.welcome.stops, here, ride.key)).toBe('ridden');
    expect([model.hero.money, model.minutes - minutes]).toEqual([5, ride.hours * 60]);
    expect([model.hero.x, model.hero.z]).toEqual([ride.x, ride.z]);
    expect(takeRide(model, model.welcome.stops, here, 'nowhere')).toBe('no such ride');
  });

  it('kept in the save; anything unsound left out', () => {
    const model = fresh();
    for (const i of [0, 1]) visit(model, i);
    const again = fresh();
    restore(again, snapshot(model));
    expect([...again.welcome.stops.entries()]).toEqual([...model.welcome.stops.entries()]);
    expect(readStops([{ key: 'a', name: 'A', level: 1, x: 1, z: 2 }, { key: 'b', name: 3 }, null]).size).toBe(1);
  });
});
