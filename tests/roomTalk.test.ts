// @vitest-environment happy-dom
// A word with whoever knocks at a pleasure worker's door, as the talk scene tells it (controller/story/talkPanel.ts,
// model/jobs/roomShift.ts): an answer may lead on to more, said in the same breath; Escape takes the way out (the
// one turned away, trouble let go), never an answer that lets someone in or calls the bouncer.
import { describe, expect, it } from 'vitest';
import { comeIn } from './support/roomWork';
import { fresh } from './support/testWorld'; // (first: the game's own order of loading)
import { createTalkPanel } from '../src/controller/story/talkPanel';
import { maxEnergyOf } from '../src/model/hero/attributes';
import { interactionOf } from '../src/model/hero/interaction';
import { inLetRoom, letDoor } from '../src/model/inn/roomLetting';
import { roomsOff, stairsOf, upstairsInside } from '../src/model/interiors/upstairs';
import { LET_IN } from '../src/model/jobs/roomLines';
import type { RoomShift } from '../src/model/jobs/roomShift';

function atWork() {
  const model = fresh();
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  model.work.start(inn, 'innCompanion');
  const below = model.inside!;
  const inside = (model.inside = upstairsInside(inn, below.room, stairsOf(below)!, model.seed, model.fullWalls));
  const [x, z] = roomsOff(inside.furniture, inside.room).find((r) => r.doors.includes(letDoor(inside.furniture)!))!.tiles[0];
  Object.assign(model.hero, { x, z });
  const shift = model.work.shift as RoomShift;
  const panel = createTalkPanel(model, { setPaused: () => {} });
  // Someone of `kind` at the door (those who aren't: turned away).
  const knock = (trouble: boolean) => {
    for (let n = 0; n < 200; n++) {
      model.hero.energy = maxEnergyOf(model.hero);
      shift.left = 100;
      for (let t = 0; t < 40 && !shift.client; t++) shift.update([], 1);
      if ((shift.client!.kind !== 'plain') === trouble) return shift.client!;
      model.work.meet()!.talk.answers.at(-1)!.pick();
    }
    throw new Error('no such client came');
  };
  return { model, shift, panel, knock };
}
const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const scene = () => document.body.querySelector('.talk-scene:last-of-type') as HTMLElement;
const labels = () => Array.from(scene().querySelectorAll('.talk-answer span')).map((b) => b.textContent);

describe("a word at a pleasure worker's door", () => {
  it('leads on, let in, to what they say inside and after; Escape at the door turns them away', () => {
    const { model, shift, panel, knock } = atWork();
    knock(false);
    const met = model.work.meet()!;
    const away = shift.turnedAway;
    expect(panel.show(met.who, met.talk)).toBe(true);
    key('Escape'); // (out: turned away, not let in)
    expect(panel.menu.isOpen).toBe(false);
    expect([shift.turnedAway, shift.served, shift.client]).toEqual([away + 1, 0, null]);
    // Let in, by an answer: the scene stays up, their next word begun.
    knock(false);
    const again = model.work.meet()!;
    panel.show(again.who, again.talk);
    key('Space');
    key('Space'); // (their line written out, then the hero's turn)
    expect(labels()[0]).toBe(LET_IN.warm);
    key('Digit2');
    // Let in: the word at the door's over; they're seen to come in (the hero held where they stand, the door open),
    // and once it's shut behind them, their own word begins.
    expect(panel.menu.isOpen).toBe(false);
    expect(shift.client).not.toBeNull(); // (not yet paid)
    const door = letDoor(model.inside!.furniture)!;
    const visitor = shift.visitor!;
    expect([door.open, model.work.held, model.folk.includes(visitor)]).toEqual([true, true, true]);
    expect(interactionOf(model)).toBeNull();
    const from = { x: visitor.x, z: visitor.z };
    for (let t = 0; t < 0.6; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect([visitor.x, visitor.z, door.open]).toEqual([from.x, from.z, true]); // (waiting on the door, as it swings open)
    // (Under the whole game, as it's played: its villagers' rounds, its marks, what E does, each frame.)
    let come = null as ReturnType<typeof model.work.arrived>;
    let shutFor = 0;
    for (let t = 0; t < 30 && !come; t += 1 / 30) {
      model.update(1, 0, 1 / 30); // (pressing on: held all the same)
      for (const n of model.folk) model.story.markOf(n);
      interactionOf(model);
      come = model.work.arrived();
      if (!door.open && !come) shutFor += 1 / 30; // (seen shut behind them, while they walk on and before they speak)
    }
    expect(shutFor).toBeGreaterThan(0.8);
    expect(come).not.toBeNull();
    expect(Math.hypot(visitor.x - from.x, visitor.z - from.z)).toBeGreaterThan(1); // (walked in)
    expect(inLetRoom(model.inside!, { x: Math.round(visitor.x), z: Math.round(visitor.z) })).toBe(true);
    expect([door.open, door.locked, model.work.held]).toEqual([false, true, false]);
    // Stood before the hero, a pace or two off, turned to them; and on the door's side of them, not round behind.
    const { hero } = model;
    const apart = Math.hypot(visitor.x - hero.x, visitor.z - hero.z);
    expect(apart).toBeGreaterThanOrEqual(0.9);
    expect(apart).toBeLessThanOrEqual(2.4);
    expect(Math.cos(visitor.facing - Math.atan2(hero.x - visitor.x, hero.z - visitor.z))).toBeGreaterThan(0.99);
    expect(Math.cos(hero.facing - Math.atan2(visitor.x - hero.x, visitor.z - hero.z))).toBeGreaterThan(0.99);
    expect(model.work.arrived()).toBeNull(); // (said once)
    expect(panel.show(come!.who, come!.talk)).toBe(true);
    expect(come!.talk.night).toBeDefined();
    panel.menu.close();
    // Paid and gone: out by the door, it shut after them, no one left in the room.
    come!.talk.night!();
    come!.talk.answers[0].pick();
    expect([door.open, model.work.held]).toEqual([true, true]);
    // Gone only once the door's swung shut on them: still there as it closes (out in the hallway, stood still), for
    // as long as it takes to; never seen walking on behind it.
    let [seenShut, walked] = [0, 0];
    for (let t = 0; t < 40 && shift.visitor; t += 1 / 30) {
      const at = { x: visitor.x, z: visitor.z };
      model.update(0, 0, 1 / 30);
      if (shift.visitor && !door.open) [seenShut, walked] = [seenShut + 1 / 30, walked + Math.hypot(visitor.x - at.x, visitor.z - at.z)];
    }
    expect(seenShut).toBeGreaterThan(0.6); // (the door's swing)
    expect(seenShut).toBeLessThan(1);
    expect(walked).toBeLessThan(0.05);
    expect(inLetRoom(model.inside!, { x: Math.round(visitor.x), z: Math.round(visitor.z) })).toBe(false);
    expect([shift.visitor, door.open, model.work.held]).toEqual([null, false, false]);
  });

  it("gives trouble nothing by Escape: let go, the bouncer left where he is", () => {
    const { model, shift, panel, knock } = atWork();
    const client = knock(true);
    const after = comeIn(model, shift); // (let in)
    after.night!();
    panel.show(client, after);
    const earned = shift.earned;
    key('Escape');
    expect(panel.menu.isOpen).toBe(false);
    expect(shift.client).toBeNull();
    if (client.kind === 'skinflint') expect(shift.earned).toBeLessThan(earned + 22); // (his half, no more)
    else expect([shift.earned, shift.unpaid]).toEqual([earned, 1]);
  });
});
