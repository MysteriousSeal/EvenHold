// A room at the inn: let by the barmaid from four in the afternoon till six in the morning, till ten the next day.

import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { roomsOff, takeStairs, useHallDoor } from '../src/model/interiors/upstairs';
import { parseSave, restore, snapshot } from '../src/model/save';
import { ROOM_PRICE, checkOutAfter, letBed, letDoor, letUntil, lettingHours, rentRoom, sleepTillMorning, sleepingHours } from '../src/model/inn/roomLetting';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { barmaidHere } from '../src/controller/trade/barOrder';
import { takeSpeech } from '../src/model/npcs/speech';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const H = 60;
const atTheInn = (hour: number) => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  enterNearest(model, 'inn', new Set());
  model.minutes = 3 * 24 * H + hour * H;
  return model;
};
const upstairs = (model: GameModel) => {
  const stairs = model.inside!.furniture.find((f) => f.kind === 'stairs')!;
  Object.assign(model.hero, { x: stairs.x + stairs.w, z: stairs.z });
  expect(takeStairs(model)).toBe(true);
};
const said = () => takeSpeech().map((e) => (e.kind === 'say' ? e.text : ''));

describe('a room at the inn', () => {
  it('is let from four in the afternoon till six in the morning, to be left by ten the next', () => {
    expect([15.9, 16, 23, 0, 5.9, 6, 12].map((h) => lettingHours(h * H))).toEqual([false, true, true, true, true, false, false]);
    expect(checkOutAfter(17 * H)).toBe(24 * H + 10 * H); // (the evening: ten tomorrow)
    expect(checkOutAfter(24 * H + 2 * H)).toBe(24 * H + 10 * H); // (after midnight: ten this morning)
  });

  it('out of hours, she says to come back later: nothing paid, nothing let', () => {
    const model = atTheInn(12);
    model.hero.money = 500;
    takeSpeech();
    expect(rentRoom(model, barmaidHere(model)!)).toBe('closed');
    expect(said().join(' ')).toMatch(/come back later/i);
    expect(model.hero.money).toBe(500);
    expect(letUntil(model.inside!.entrance)).toBeNull();
  });

  it('too poor, none let', () => {
    const model = atTheInn(20);
    model.hero.money = ROOM_PRICE - 1;
    model.takeEvents();
    expect(rentRoom(model, barmaidHere(model)!)).toBe('poor');
    expect(model.takeEvents().some((e) => e.kind === 'poor')).toBe(true);
  });

  it('let, paid to her: its door upstairs unlocked (the rest not) till ten the next morning, kept in a save; then locked, the hero shown out', () => {
    const model = atTheInn(20);
    model.hero.money = 500;
    const purse = { money: 0 };
    expect(rentRoom(model, barmaidHere(model)!, purse)).toBe('let');
    expect([model.hero.money, purse.money]).toEqual([500 - ROOM_PRICE, ROOM_PRICE]);
    expect(rentRoom(model, barmaidHere(model)!, purse)).toBe('taken'); // (once)
    expect(model.hero.money).toBe(500 - ROOM_PRICE);
    upstairs(model);
    const door = letDoor(model.inside!.furniture)!;
    expect(door.locked).toBe(false);
    expect(model.inside!.furniture.filter((f) => f.kind === 'hallDoor' && f !== door).every((f) => f.locked)).toBe(true);
    Object.assign(model.hero, { x: door.x - 0.5 + door.w / 2, z: door.z - 0.8 });
    expect(useHallDoor(model)).toBe(true);
    expect(door.open).toBe(true);
    const again = new GameModel(model.seed, TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    expect(letDoor(again.inside!.furniture)!.locked).toBe(false);
    // In it, at ten the next morning: out before its door, locked behind them.
    Object.assign(model.hero, { x: door.x, z: door.z + 1 });
    model.minutes = checkOutAfter(model.minutes) - 0.5;
    model.update(0, 0, 1);
    expect(letUntil(model.inside!.below!)).toBeNull();
    expect([door.locked, door.open]).toEqual([true, false]);
    expect(model.hero.z).toBeLessThan(door.z - 0.4);
  });

  it('its bed slept in at night (by it, or lying in it): all health and energy back, up at eight; not by day, nor another bed', () => {
    expect([16, 23, 2, 7.9, 8, 12].map((h) => sleepingHours(h * H))).toEqual([true, true, true, true, false, false]);
    const model = atTheInn(21);
    model.hero.money = 500;
    rentRoom(model, barmaidHere(model)!);
    upstairs(model);
    const door = letDoor(model.inside!.furniture)!;
    door.open = true;
    const room = roomsOff(model.inside!.furniture, model.inside!.room).find((r) => r.doors.includes(door))!;
    const inRoom = (f: { x: number; z: number }) => room.tiles.some(([x, z]) => x === f.x && z === f.z);
    const bed = model.inside!.furniture.find((f) => f.kind === 'roomBed' && inRoom(f))!;
    const other = model.inside!.furniture.find((f) => (f.kind === 'roomBed' || f.kind === 'doubleBed') && !inRoom(f))!;
    const byBed = (b: typeof bed) => {
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        Object.assign(model.hero, { x: b.x + dx * 0.6, z: b.z + 0.5 + dz * 0.6 });
        if (model.seatInReach?.piece === b) return true;
      }
      return false;
    };
    expect(byBed(other)).toBe(true);
    expect(letBed(model)).toBeNull(); // (not theirs)
    expect(byBed(bed)).toBe(true);
    expect(letBed(model)?.piece).toBe(bed);
    model.sitOrStand();
    expect(letBed(model)?.piece).toBe(bed); // (lying in it)
    Object.assign(model.hero, { hp: 1, energy: 1 });
    sleepTillMorning(model);
    expect(Math.floor(model.minutes / H) % 24).toBe(8);
    expect(model.minutes % H).toBe(0);
    expect(model.hero.hp).toBe(maxHpOf(model.hero));
    expect(model.hero.energy).toBe(maxEnergyOf(model.hero));
    expect(letBed(model)).toBeNull(); // (morning: no more sleeping)
    expect(letUntil(model.inside!.below!)).not.toBeNull(); // (the room theirs till ten still)
  });
});
