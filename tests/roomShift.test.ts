// A shift as an inn's pleasure worker (model/jobs/roomShift.ts): the room upstairs theirs for it, no one knocking
// till they're in it; clients one at a time, of the other sex than the hero's, let in or turned away at a word; the
// time passing unseen (the clock, the hero's energy), then paid, or trouble; too tired for another, the shift over
// and all of it paid; the job's own costume, cut for a man or a woman; the pox, and a herbalist's salve for it.
import { describe, expect, it } from 'vitest';
import { comeIn, seeOut } from './support/roomWork';
import { fresh } from './support/testWorld'; // (first: the game's own order of loading, the villagers' rounds before the shifts that call on them)
import type { GameModel } from '../src/model/GameModel';
import { maxEnergyOf } from '../src/model/hero/attributes';
import { POX_TIME, curePox, givePox, hasPox, tiring } from '../src/model/hero/blessing';
import { recover } from '../src/model/hero/heroStats';
import { interactionOf } from '../src/model/hero/interaction';
import { standUp } from '../src/model/interiors/indoors';
import { SALVE, poxTalk } from '../src/model/hero/pox';
import { inLetRoom, letDoor, letUntil, setLet } from '../src/model/inn/roomLetting';
import { restore, snapshot } from '../src/model/save';
import { doorway, roomsOff, stairsOf, upstairsInside, useHallDoor } from '../src/model/interiors/upstairs';
import { JOBS, recordOf } from '../src/model/jobs/jobs';
import { FLAT, LET_IN, TEMPERS, TEMPER_IDS, THANKS, TURN_AWAY, type Tone } from '../src/model/jobs/roomLines';
import { TROUBLE } from '../src/model/jobs/roomTrouble';
import { PRICE, RoomShift } from '../src/model/jobs/roomShift';
import type { Talk } from '../src/model/story/story';
import { closeUpFigure } from '../src/view/meshes/human/figureMesh';
import { costumeFor, COSTUME_LOOKS } from '../src/view/meshes/human/gear/costumes';

// At work in the first inn; `upstairs`: stood in the room that's theirs.
function atWork(upstairs = true): { model: GameModel; shift: RoomShift } {
  const model = fresh();
  const inn = model.entrances.find((e) => e.type === 'inn')!;
  model.enterRoom(inn);
  expect(model.work.start(inn, 'innCompanion')).toBe(true);
  const shift = model.work.shift as RoomShift;
  expect(shift).toBeInstanceOf(RoomShift);
  if (upstairs) goUp(model);
  return { model, shift };
}
function goUp(model: GameModel): void {
  const below = model.inside!;
  const inside = (model.inside = upstairsInside(below.entrance, below.room, stairsOf(below)!, model.seed, model.fullWalls));
  const door = letDoor(inside.furniture)!;
  expect(door.locked).toBe(false); // (theirs for the shift)
  const [x, z] = roomsOff(inside.furniture, inside.room).find((r) => r.doors.includes(door))!.tiles[0];
  Object.assign(model.hero, { x, z });
}
const until = (model: GameModel, what: () => unknown, most = 60): void => {
  for (let t = 0; t < most && !what(); t += 0.25) model.update(0, 0, 0.25);
};
// Whoever's at the door let in, the time passed: what they say after, and what may be answered.
function letIn(model: GameModel, tone: Tone = 'warm'): Talk {
  const met = model.work.meet()!;
  expect(met.talk.answers.map((a) => a.label)).toEqual([LET_IN.warm, LET_IN.plain, LET_IN.tease, TURN_AWAY]);
  const after = comeIn(model, model.work.shift as RoomShift, ['warm', 'plain', 'tease'].indexOf(tone));
  expect(after.lines.length).toBe(2); // (a word as the door shuts; then, the night passed, what they say going)
  expect(after.later).toBe('A while later'); // (what the black says: no night's passed)
  after.night!();
  return after;
}

describe('a pleasure worker', () => {
  it('has the job posted with the others, and is dressed for it: a cut for a man, another for a woman', () => {
    expect(JOBS.innCompanion.name).toBe('Pleasure worker');
    const [hers, his] = [costumeFor('innCompanion', 'female'), costumeFor('innCompanion', 'male')];
    expect(hers.torso).not.toBe(his.torso);
    expect([hers.legs, hers.feet]).toEqual([his.legs, his.feet]);
    for (const look of [...Object.values(hers), ...Object.values(his)]) expect(COSTUME_LOOKS[look!]).toBeDefined();
    expect(hers.head ?? hers.hands ?? hers.shoulders).toBeUndefined(); // (bare-headed, bare-handed)
    expect(costumeFor('innServer', 'male')).toBe(costumeFor('innServer', 'female'));
    // Close up (the talk scene's figure), they're seen in it too: its silk, none of the gear under it.
    const { hero } = fresh();
    const [own, atWork] = [closeUpFigure(hero.look, hero.equipment), closeUpFigure(hero.look, hero.equipment, costumeFor('innCompanion', hero.look.build))];
    expect(own.palette).not.toContain(0xa3233f);
    expect(atWork.palette).toContain(0xa3233f);
  });

  it('must go up to the room: no one knocks before, and at work only the stairs and its doors answer E', () => {
    const { model, shift } = atWork(false);
    for (let t = 0; t < 20; t += 0.25) model.update(0, 0, 0.25);
    expect(shift.client).toBeNull();
    expect(shift.inRoom).toBe(false);
    expect(model.work.shift).toBe(shift); // (still at it)
    const stairs = stairsOf(model.inside!)!;
    Object.assign(model.hero, { x: stairs.x + stairs.w + 0.2, z: stairs.z });
    expect(interactionOf(model)?.kind).toBe('stairs');
    expect(model.useDoor()).toBe(false); // (no leaving the inn at work)
    goUp(model);
    expect(shift.inRoom).toBe(true);
    // In the room, its door still open: not begun (no clock, no knock). Shut: begun, and fast till the shift's over.
    const door = letDoor(model.inside!.furniture)!;
    door.open = true;
    const left = shift.left;
    for (let t = 0; t < 20; t += 0.25) model.update(0, 0, 0.25);
    expect([shift.begun, shift.client, shift.left]).toEqual([false, null, left]);
    Object.assign(model.hero, doorway(door, -0.45)); // (at it, inside)
    expect(useHallDoor(model)).toBe(true);
    expect(door.open).toBe(false);
    model.update(0, 0, 0.25);
    expect([shift.begun, door.locked]).toEqual([true, true]);
    expect(shift.left).toBeLessThan(left);
    expect(useHallDoor(model)).toBe(true); // (tried: it won't open)
    expect(door.open).toBe(false);
    expect(model.work.shift).toBe(shift); // (upstairs is at work too)
    until(model, () => shift.client);
    expect(shift.client).not.toBeNull();
    expect(model.work.action).toMatchObject({ kind: 'client' });
    expect(interactionOf(model)?.kind).toBe('work');
  });

  it("is called on by the other sex than the hero's; let in, the time passes, and they pay", () => {
    for (const build of ['male', 'female'] as const) {
      const { model, shift } = atWork(false);
      model.hero.look.build = build;
      goUp(model);
      const { hero } = model;
      let plain = 0;
      for (let n = 0; n < 12 && !plain; n++) {
        hero.energy = maxEnergyOf(hero);
        until(model, () => shift.client);
        const client = shift.client!;
        expect(client.look.build).not.toBe(build);
        expect(client.name.length).toBeGreaterThan(2);
        if (client.kind !== 'plain') {
          model.work.meet()!.talk.answers.at(-1)!.pick(); // (trouble: turned away)
          expect(shift.client).toBeNull();
          continue;
        }
        const [minutes, energy, earned, served] = [model.minutes, hero.energy, shift.earned, shift.served];
        const after = letIn(model);
        expect(model.minutes).toBeGreaterThan(minutes + 20);
        expect(model.seated?.seat.lying).toBe(true); // (found in the room's bed, as the black lifts)
        expect(shift.inRoom).toBe(true);
        expect(hero.energy).toBeLessThan(energy);
        expect(after.answers.map((a) => a.label)).toEqual([THANKS.warm]);
        expect(after.answers[0].pick()).toBeUndefined();
        seeOut(shift);
        expect(shift.earned).toBeGreaterThanOrEqual(earned + PRICE);
        expect(shift.served).toBe(served + 1);
        until(model, () => shift.client); // (the next knocks, lying there or not)
        expect(shift.client).not.toBeNull();
        expect(interactionOf(model)?.kind).toBe('work');
        model.work.meet()!.talk.answers.at(-1)!.pick();
        expect(recordOf(hero, 'innCompanion').xp).toBe(shift.served);
        plain++;
      }
      expect(plain).toBe(1);
      expect(shift.turnedAway + shift.served).toBeGreaterThan(0);
    }
  });

  it('is called on by people each of a temper: all they say comes of it, and the tone taken to their taste earns a tip', () => {
    const { model, shift } = atWork();
    const { hero } = model;
    const all = (temper: (typeof TEMPER_IDS)[number], of: 'knocks' | 'inside' | 'after') => [...TEMPERS[temper][of], ...TEMPERS[temper].male[of], ...TEMPERS[temper].female[of]];
    const tones: Tone[] = ['warm', 'plain', 'tease'];
    const seen = { pleased: 0, flat: 0, tempers: new Set<string>() };
    for (let n = 0; n < 60 && (seen.pleased < 3 || seen.flat < 3); n++) {
      hero.energy = maxEnergyOf(hero);
      shift.left = 100;
      until(model, () => shift.client);
      const client = shift.client!;
      const met = model.work.meet()!;
      if (client.kind !== 'plain') {
        expect(TROUBLE[client.kind].knocks).toContain(met.talk.lines[0]); // (trouble has its own)
        met.talk.answers.at(-1)!.pick();
        continue;
      }
      seen.tempers.add(client.temper);
      expect(all(client.temper, 'knocks')).toContain(met.talk.lines[0]);
      const liked = TEMPERS[client.temper].likes;
      const tone = n % 2 ? liked : tones.find((t) => t !== liked)!;
      const [earned, price] = [shift.earned, Math.round(PRICE * shift.rank.tips)]; // (the house's price, at their rank)
      const after = letIn(model, tone);
      expect(all(client.temper, 'inside')).toContain(after.lines[0]);
      expect(after.answers.map((a) => a.label)).toEqual([THANKS[tone]]);
      after.answers[0].pick();
      seeOut(shift);
      if (tone === liked) {
        expect(all(client.temper, 'after')).toContain(after.lines[1]);
        expect(shift.earned).toBeGreaterThan(earned + price); // (and something over)
        seen.pleased++;
      } else {
        expect(FLAT).toContain(after.lines[1]);
        expect(shift.earned).toBe(earned + price); // (the price, no more)
        seen.flat++;
      }
    }
    expect(seen.pleased).toBeGreaterThanOrEqual(3);
    expect(seen.flat).toBeGreaterThanOrEqual(3);
    expect(seen.tempers.size).toBeGreaterThan(2);
  });

  it('has its lines written whole, each said by one temper alone', () => {
    const lines: string[] = [...FLAT];
    for (const id of TEMPER_IDS) {
      const t = TEMPERS[id];
      for (const of of ['knocks', 'inside', 'after'] as const) {
        expect(t[of].length, `${id} ${of}`).toBeGreaterThan(3);
        lines.push(...t[of], ...t.male[of], ...t.female[of]);
      }
    }
    for (const t of Object.values(TROUBLE)) lines.push(...t.knocks, ...t.inside, ...t.after, ...t.holds);
    // What a man or a woman alike may say names no one's body and no one's spouse, and isn't said from under anyone.
    const either = [...FLAT, ...TEMPER_IDS.flatMap((id) => [...TEMPERS[id].knocks, ...TEMPERS[id].inside, ...TEMPERS[id].after]), ...Object.values(TROUBLE).flatMap((t) => [...t.knocks, ...t.inside, ...t.after, ...t.holds])];
    for (const line of either) expect(line, line).not.toMatch(/\b(cock|balls|pussy|cunt|tits|wife|husband|dress|breeches|king's man)\b|to be fucked|you just did|got fucked|been fucked|take me from|bend me|inside me|sit down for a week/i);
    for (const id of TEMPER_IDS) for (const of of ['knocks', 'inside', 'after'] as const) expect(TEMPERS[id].male[of].length > 0 || TEMPERS[id].female[of].length > 0, `${id} ${of}`).toBe(true);
    expect(new Set(lines).size).toBe(lines.length); // (none said twice over)
    expect(lines.length).toBeGreaterThan(250);
    for (const line of lines) expect(line, line).toMatch(/^[A-Z].*[.!?]$/);
    expect(new Set(TEMPER_IDS.map((id) => TEMPERS[id].likes))).toEqual(new Set(['warm', 'plain', 'tease'])); // (every tone is someone's taste)
  });

  it('meets trouble now and then: insisted with, the bouncer called, or let go', () => {
    const { model, shift } = atWork();
    const { hero } = model;
    const seen = new Set<string>();
    for (let n = 0; n < 80 && seen.size < 3; n++) {
      hero.energy = maxEnergyOf(hero);
      shift.left = 100;
      until(model, () => shift.client);
      const client = shift.client!;
      if (client.kind === 'plain') {
        model.work.meet()!.talk.answers.at(-1)!.pick();
        continue;
      }
      const [earned, unpaid, hp] = [shift.earned, shift.unpaid, hero.hp];
      const after = letIn(model);
      const labels = after.answers.map((a) => a.label);
      expect(labels[0]).toBe('Pay what you owe me.');
      expect(labels.at(-1)).toBe('Let it go.');
      const way = seen.has('insist') ? (seen.has('let') ? 'bouncer' : 'let') : 'insist';
      const answer = way === 'insist' ? after.answers[0] : way === 'let' ? after.answers.at(-1)! : after.answers.find((a) => a.label === 'Call the bouncer.');
      if (!answer) break; // (an inn with no bouncer: no calling him)
      const said = answer.pick();
      if (way === 'let') expect(said).toBeUndefined();
      else expect((said as Talk).answers).toEqual([]); // (their last word, and gone)
      expect(shift.client).toBeNull();
      seeOut(shift);
      expect(shift.earned).toBeGreaterThanOrEqual(earned);
      expect(shift.earned > earned || shift.unpaid === unpaid + 1).toBe(true); // (paid something, or told as unpaid)
      expect(hero.hp).toBeGreaterThanOrEqual(Math.min(hp, 1));
      seen.add(way);
    }
    expect(seen.has('insist') && seen.has('let')).toBe(true);
  });

  it('is done when too tired for another: paid all at once, the room locked again', () => {
    const { model, shift } = atWork();
    const { hero } = model;
    const inn = shift.inn;
    until(model, () => shift.client);
    while (shift.client?.kind !== 'plain') [shift.client && model.work.meet()!.talk.answers.at(-1)!.pick(), until(model, () => shift.client)];
    letIn(model).answers[0].pick();
    seeOut(shift);
    const [money, owed] = [hero.money, shift.earned];
    expect(owed).toBeGreaterThan(0);
    expect(hero.money).toBe(money); // (owed till the end)
    standUp(model.inside!, hero); // (up out of the bed: lying there, they'd rest)
    hero.energy = maxEnergyOf(hero) * 0.05; // (not enough left for another)
    model.takeEvents();
    until(model, () => !model.work.shift);
    expect(model.work.shift).toBeNull();
    expect(hero.money).toBeGreaterThanOrEqual(money + owed);
    expect(model.takeEvents().find((e) => e.kind === 'shift')).toMatchObject({ job: 'Pleasure worker', served: 1, early: false });
    expect(recordOf(hero, 'innCompanion').shifts).toBe(1);
    for (let t = 0; t < 1; t += 0.25) model.update(0, 0, 0.25);
    expect((letUntil(inn) ?? 0) <= model.minutes).toBe(true); // (the room's let over)
    expect(letDoor(model.inside!.furniture)!.locked).toBe(true);
    expect(model.seated).toBeNull(); // (up out of the bed, and out of the room)
    expect(inLetRoom(model.inside!, { x: Math.round(hero.x), z: Math.round(hero.z) })).toBe(false);
  });
});

describe('a shift in a room, and the save', () => {
  it("leaves no room let for nothing: saved as it was let before (not at all: its time up)", () => {
    const { model, shift } = atWork();
    expect(letUntil(shift.inn)).toBeGreaterThan(model.minutes + 60); // (held for the shift)
    const saved = snapshot(model);
    const kept = saved.lets!.find((l) => l.until !== undefined)!;
    expect(saved.lets).toHaveLength(1);
    expect(kept.until).toBe(model.minutes); // (not let before: up now, so whoever's saved in it is shown out)
    // Let already (their own night there): that let kept.
    const again = atWork(false);
    again.model.work.end(true);
    setLet(again.shift.inn, again.model.minutes + 300);
    again.model.work.start(again.shift.inn, 'innCompanion');
    expect(snapshot(again.model).lets![0].until).toBe(again.model.minutes + 300);
  });

  it('keeps the pox its hours through a save', () => {
    const model = fresh();
    givePox(model.hero);
    const again = fresh();
    restore(again, JSON.parse(JSON.stringify(snapshot(model))));
    expect(hasPox(again.hero)).toBe(true);
    expect(again.hero.blessings!.find((b) => b.kind === 'poxed')!.left).toBe(POX_TIME);
  });
});

describe('the pox', () => {
  it('tires the hero faster, and is ended by a herbalist\'s salve, paid for', () => {
    const model = fresh();
    const { hero } = model;
    const herbalist = { name: 'Edda' };
    expect(poxTalk(model, herbalist)).toBeNull();
    const spent = () => {
      hero.energy = maxEnergyOf(hero);
      recover(hero, 10);
      return maxEnergyOf(hero) - hero.energy;
    };
    const well = spent();
    givePox(hero);
    expect(hasPox(hero)).toBe(true);
    expect(tiring(hero)).toBeGreaterThan(1);
    expect(spent()).toBeCloseTo(well * tiring(hero), 5);
    // No coin for it: told so, and still poxed.
    hero.money = SALVE - 1;
    const poor = poxTalk(model, herbalist)!;
    expect(poor.answers.map((a) => a.label)).toEqual([`Pay ${SALVE} copper for the salve.`, 'Later.', 'Show me your wares.']);
    expect((poor.answers[0].pick() as Talk).lines[0]).toMatch(/coin/);
    expect(hasPox(hero)).toBe(true);
    // Paid: gone.
    hero.money = SALVE + 5;
    expect((poxTalk(model, herbalist)!.answers[0].pick() as Talk).answers).toEqual([]);
    expect(hero.money).toBe(5);
    expect(hasPox(hero)).toBe(false);
    expect(spent()).toBeCloseTo(well, 5);
    givePox(hero);
    curePox(hero);
    expect(poxTalk(model, herbalist)).toBeNull();
    // Whatever else she has to say comes after: the salve left for later, on to it.
    givePox(hero);
    const quest: Talk = { speaker: 'Edda', lines: ['I need three cuts of boar.'], answers: [] };
    const first = poxTalk(model, herbalist, () => quest)!;
    expect(first.lines[0]).toMatch(/pox/);
    const later = first.answers.find((a) => a.out)!;
    expect(later.label).toBe('Later.');
    expect(later.pick()).toBe(quest);
    expect(poxTalk(model, herbalist, () => null)!.answers.find((a) => a.out)!.pick()).toBeUndefined();
  });
});
