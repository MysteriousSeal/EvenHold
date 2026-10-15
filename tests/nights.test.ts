// A night spent with someone (model/story/nights.ts): the hero wakes in that person's place, the two of them by its
// bed: the herbalist's house, the smithy, and for the inn's bouncer the room let upstairs; whoever it is goes back to
// their day after.
import { describe, expect, it } from 'vitest';
import type { GameModel } from '../src/model/GameModel';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { letUntil } from '../src/model/inn/roomLetting';
import type { Npc, NpcRole } from '../src/model/npcs/npcs';
import { walkAlong } from '../src/model/npcs/npcWalk';
import { everyKindOfWorld, fresh } from './support/testWorld';

const DAY = 24 * 60;

// The quest's night told with the first `role` about, from wherever the hero stands: taken (the cheat's replay),
// what it asks done, the talk's night passed (in the evening: by day, not yet).
function night(model: GameModel, role: NpcRole, quest: string): Npc {
  const { story } = model;
  const who = model.npcs.find((n) => n.role === role)!;
  const key = story.replay(quest, who)!;
  expect(key, quest).toBeTruthy();
  story.talk(who, key)!.answers[0].pick();
  expect(story.finish(key)).toBe(true);
  // By day: not handed in, a word to come back after dark (not a whole day slept away); in the evening, the night.
  model.minutes = Math.floor(model.minutes / DAY) * DAY + 12 * 60;
  expect(story.talk(who, key)!.lines[0]).toMatch(/after dark/);
  model.minutes += 8 * 60;
  const talk = story.talk(who, key)!;
  expect(talk.quest?.state).toBe('handIn');
  talk.night!();
  return who;
}

describe('a way worked out for someone', () => {
  it('is walked point to point as it stands; out of sight, they are at its end', () => {
    const npc = { x: 0, z: 0, facing: 0, moving: false } as Npc;
    const path = [{ x: 1, z: 0 }, { x: 1, z: 2 }];
    expect(walkAlong(npc, path, true, 0.5)).toBe(false);
    expect(npc.x).toBeGreaterThan(0.3);
    expect(npc.z).toBe(0);
    expect(npc.moving).toBe(true);
    let steps = 0;
    while (!walkAlong(npc, path, true, 0.1) && steps++ < 200);
    expect([Math.round(npc.x * 100) / 100, Math.round(npc.z * 100) / 100]).toEqual([1, 2]);
    expect(steps).toBeGreaterThan(10); // (on foot: no leap)
    const other = { x: 0, z: 0, facing: 0, moving: false } as Npc;
    expect(walkAlong(other, [{ x: 4, z: 0 }, { x: 4, z: 6 }], false, 0.1)).toBe(true);
    expect([other.x, other.z]).toEqual([4, 6]);
  });
});

describe('a quest that ends in a night together', () => {
  it("is offered only by someone of the other sex than the hero's", () => {
    const model = everyKindOfWorld().at(-1)!;
    const { story, hero } = model;
    hero.bags.fill(null);
    // A herbalist who has it, the quest before it done.
    const supper = story.keysOf('supperForTwo')[0];
    const broth = supper.replace('supperForTwo', 'meatForTheBroth');
    story.accept(broth);
    expect(story.finish(broth)).toBe(true);
    expect(story.handIn(broth)).toBe(true);
    const herbalist = model.npcs.find((n) => n.role === 'herbalist' && story.talk(n, supper))!;
    const other = herbalist.look.build === 'male' ? 'female' : 'male';
    hero.look.build = herbalist.look.build;
    expect(story.stateOf(supper)).toBe('locked');
    expect(story.talk(herbalist, supper)?.quest ?? null).toBeNull();
    expect(story.accept(supper)).toBe(false);
    hero.look.build = other;
    expect(story.stateOf(supper)).toBe('offered');
    expect(story.talk(herbalist, supper)?.quest).toMatchObject({ name: 'Supper for two', state: 'offered' });
    // Taken, it's kept whatever the hero then looks like; the cheat's replay offers it to anyone.
    expect(story.accept(supper)).toBe(true);
    hero.look.build = herbalist.look.build;
    expect(story.stateOf(supper)).toBe('taken');
    expect(story.replay('supperForTwo', herbalist)).toBe(supper);
    expect(story.stateOf(supper)).toBe('offered');
  });
});

describe('a night quest handed in at night', () => {
  it.each([
    ['herbalist', 'supperForTwo'],
    ['smith', 'aDrinkAfterHours'],
  ] as const)('the %s abed (past eleven) still takes it in, by a word: only their shop is shut', (role, quest) => {
    const model = fresh();
    const { story } = model;
    const who = model.npcs.find((n) => n.role === role)!;
    const key = story.replay(quest, who)!;
    story.talk(who, key)!.answers[0].pick();
    expect(story.finish(key)).toBe(true);
    model.enterRoom(who.home);
    model.minutes = Math.floor(model.minutes / DAY) * DAY + 23 * 60 + 30;
    for (let t = 0; t < 20; t += 1 / 10) model.update(0, 0, 1 / 10);
    if (role === 'herbalist') expect(who.seat?.lying).toBe(true); // (abed)
    const talk = story.talk(who)!; // (what E says first: their word on the quest, before any trade)
    expect(talk.quest).toMatchObject({ state: 'handIn' });
    talk.night!();
    talk.answers[0].pick();
    expect(story.stateOf(key)).toBe('done');
    expect(model.minutes % DAY).toBe(8 * 60);
  });
});

describe('a night spent with someone', () => {
  it.each([
    ['herbalist', 'supperForTwo'],
    ['smith', 'aDrinkAfterHours'],
  ] as const)("wakes the hero in the %s's own place, the two of them together, at eight", (role, quest) => {
    const model = everyKindOfWorld().at(-1)!;
    const { hero } = model;
    const who = night(model, role, quest);
    const inside = model.inside!;
    expect(inside.entrance).toBe(who.home);
    expect(inside.below).toBeUndefined();
    expect(who.where).toBe(who.home);
    expect(model.minutes % (24 * 60)).toBe(8 * 60);
    expect(Math.hypot(who.x - hero.x, who.z - hero.z)).toBeLessThan(3);
    expect(Math.hypot(who.x - hero.x, who.z - hero.z)).toBeGreaterThan(0.5);
    expect(bumpsFurniture(inside.furniture, who.x, who.z, 0.2)).toBe(false);
    // In its bed, where there's one (the smithy has none: stood by the forge); up from it onto the floor beside.
    const bed = inside.furniture.find((f) => f.kind === 'bed');
    expect(!!model.seated?.seat.lying).toBe(!!bed);
    if (bed) expect(model.seated!.seat.piece).toBe(bed);
    else expect(bumpsFurniture(inside.furniture, hero.x, hero.z, 0.2)).toBe(false);
    const from = model.seated?.from ?? hero;
    expect(bumpsFurniture(inside.furniture, from.x, from.z, 0.2)).toBe(false);
    // Their bed the hero's to lie in again that morning (the herbalist at their work: as good as away): up, and back in it, not turned out.
    if (bed) {
      model.sitOrStand();
      expect(model.seated).toBeNull();
      for (let x = 0; x < inside.room.width && model.seatInReach?.piece !== bed; x += 0.25) for (let z = 0; z < inside.room.depth && model.seatInReach?.piece !== bed; z += 0.25) Object.assign(hero, { x, z });
      model.sitOrStand();
      model.update(0, 0, 0);
      expect(model.seated?.seat.piece).toBe(bed);
    }
    // Handed in after: no second night, and still there.
    model.story.talk(who)!.answers[0].pick();
    expect(model.minutes % (24 * 60)).toBe(8 * 60);
    expect(model.inside?.entrance).toBe(who.home);
  });

  it("wakes them in the inn's room upstairs with its bouncer, the room theirs till ten; the bouncer back at the door after", () => {
    const model = everyKindOfWorld().at(-1)!;
    const { hero } = model;
    const who = night(model, 'bouncer', 'afterClosing');
    const inside = model.inside!;
    expect(inside.below).toBe(who.home); // (upstairs at the inn)
    expect(who.where).toBe(inside.entrance);
    expect(model.folk).toContain(who);
    expect(letUntil(who.home)).toBeGreaterThan(model.minutes);
    expect(Math.hypot(who.x - hero.x, who.z - hero.z)).toBeLessThan(3);
    expect(bumpsFurniture(inside.furniture, who.x, who.z, 0.2)).toBe(false);
    expect(model.seated?.seat.lying).toBe(true); // (in the room's bed)
    expect(['roomBed', 'doubleBed']).toContain(model.seated!.seat.piece.kind);
    // As the talk ends (the game running again): out by the room's door, opened, and along the hallway on foot.
    const woke = { x: who.x, z: who.z };
    for (let t = 0; t < 2; t += 0.1) model.update(0, 0, 0.1);
    expect(Math.hypot(who.x - woke.x, who.z - woke.z)).toBeGreaterThan(0.5); // (on their way within two seconds)
    const seen: Array<{ x: number; z: number }> = [];
    for (let t = 0; t < 60 && who.where === inside.entrance; t += 0.1) [model.update(0, 0, 0.1), who.where === inside.entrance && seen.push({ x: who.x, z: who.z })];
    expect(inside.furniture.find((f) => f.kind === 'hallDoor' && f.open)).toBeDefined();
    expect(seen.length).toBeGreaterThan(30); // (some seconds of walking)
    expect(Math.max(...seen.slice(1).map((p, i) => Math.hypot(p.x - seen[i].x, p.z - seen[i].z)))).toBeLessThan(0.3); // (step by step)
    const stairs = inside.furniture.find((f) => f.kind === 'stairwell')!;
    expect(Math.hypot(seen.at(-1)!.x - stairs.x, seen.at(-1)!.z - (stairs.z - 1))).toBeLessThan(0.6); // (to the head of the stairs)
    expect(who.where).toBe(who.home); // (gone down to the door)
    expect(model.inside?.below).toBe(who.home); // (the hero where they woke)
  });
});
