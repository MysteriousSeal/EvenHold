// A shift as an inn's pleasure worker (model/jobs/roomShift.ts): the room upstairs theirs for it, no one knocking
// till they're in it; clients one at a time, of the other sex than the hero's, let in or turned away at a word; the
// time passing unseen (the clock, the hero's energy), then paid, or trouble; too tired for another, the shift over
// and all of it paid; the job's own costume, cut for a man or a woman; the pox, and a herbalist's salve for it.
import { describe, expect, it } from 'vitest';
import { comeIn, goUp, seeOut, startShift } from './support/roomWork';
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
import { doorway, stairsOf, useHallDoor } from '../src/model/interiors/upstairs';
import { JOBS, recordOf } from '../src/model/jobs/jobs';
import { PACES, paceOf } from '../src/model/jobs/room/pace';
import { FLAT, LET_IN, TEMPERS, TEMPER_IDS, THANKS, TURN_AWAY, type Tone } from '../src/model/jobs/room/roomLines';
import { TROUBLE } from '../src/model/jobs/room/roomTrouble';
import type { Pace } from '../src/model/jobs/room/pace';
import { PRICE, RoomShift } from '../src/model/jobs/room/roomShift';
import type { Talk } from '../src/model/story/story';
import { closeUpFigure } from '../src/view/meshes/human/figureMesh';
import { C, bodyPalette, buildTorso } from '../src/view/meshes/human/bodyVoxels';
import { NIPPLES, fineTorso, unclothed } from '../src/view/meshes/human/unclothed';
import { costumeFor, COSTUME_LOOKS, workCostume, workLook } from '../src/view/meshes/human/gear/costumes';

// At work in the first inn; `upstairs`: stood in the room that's theirs.
function atWork(upstairs = true): { model: GameModel; shift: RoomShift } {
  const model = fresh();
  const shift = startShift(model);
  expect(shift).toBeInstanceOf(RoomShift);
  if (upstairs) expect(goUp(model).locked).toBe(false); // (theirs for the shift)
  return { model, shift };
}
const until = (model: GameModel, what: () => unknown, most = 60): void => {
  for (let t = 0; t < most && !what(); t += 0.25) model.update(0, 0, 0.25);
};
// Whoever's at the door let in, the time passed: what they say after, and what may be answered.
// The hour's game with them: its pace, the word they had as the door shut, and what they say after it's played
// (`score`: how well their pace was kept, 0 to 1).
type Hour = Talk & { door: string; theirs: Pace };
function letIn(model: GameModel, tone: Tone = 'warm', score = 0.7): Hour {
  const met = model.work.meet()!;
  expect(met.talk.answers.map((a) => a.label)).toEqual([LET_IN.warm, LET_IN.plain, LET_IN.tease, TURN_AWAY]);
  const inside = comeIn(model, model.work.shift as RoomShift, ['warm', 'plain', 'tease'].indexOf(tone));
  expect(inside.lines.length).toBe(1); // (a word as the door shuts; then the hour, played)
  expect(inside.answers).toEqual([]);
  const after = inside.pace!.done(score);
  expect(after.lines.length).toBe(1); // (what they say going)
  return { ...after, door: inside.lines[0], theirs: inside.pace!.pace };
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
    expect(workCostume(model)).toEqual(costumeFor('innCompanion', model.hero.look.build)); // (in the job's costume till then)
    expect(workLook(model)).toBe(model.hero.look);
    Object.assign(model.hero, doorway(door, -0.45)); // (at it, inside)
    expect(useHallDoor(model)).toBe(true);
    expect(door.open).toBe(false);
    model.update(0, 0, 0.25);
    expect([shift.begun, door.locked]).toEqual([true, true]);
    expect(workCostume(model)).toEqual({}); // (the door shut behind them: nothing on, till the shift's over)
    // Nothing at all: their body drawn without its braies (skin where they were), the same body from frame to frame.
    const [own, stripped] = [model.hero.look, workLook(model)];
    expect(stripped).toMatchObject({ ...own, unclothed: true });
    expect(workLook(model)).toBe(stripped);
    expect(unclothed(own)).toBe(stripped); // (a look's one unclothed twin, whoever asks)
    expect(unclothed(stripped)).toBe(stripped);
    expect(own.unclothed).toBeUndefined(); // (their own look: as it was)
    const [dye, skin] = [bodyPalette(own)[10], bodyPalette(own)[0]];
    expect(dye).not.toBe(skin);
    const seen = (look: typeof own) => new Set(closeUpFigure(look, {}, {}).palette);
    expect(seen(own).has(dye)).toBe(true);
    expect(seen(stripped).has(dye)).toBe(false);
    expect(closeUpFigure(stripped, {}, {}).grid.cells.filter((c) => c).length).toBe(closeUpFigure(own, {}, {}).grid.cells.filter((c) => c).length); // (the same shape: nothing added)
    // A nipple in the middle of each side of the chest, for him and for her: drawn twice as fine as the game's voxels
    // (a whole one can't sit in the middle of a bust two wide), each a fine two by two, mirrored about the middle.
    for (const build of ['male', 'female'] as const) {
      const [coarse, fine] = [buildTorso(build, true), fineTorso(build)];
      expect(coarse.cells.filter((c) => c === C.cheek).length).toBe(0);
      expect(fine.size).toEqual(coarse.size.map((n) => n * 2));
      expect(fine.cells.filter((c) => c === C.cheek).length).toBe(8);
      const [w, h] = fine.size;
      const pink = NIPPLES[build];
      expect(pink.every(([x, y, z]) => fine.cells[x + w * (y + h * z)] === C.cheek)).toBe(true);
      const left = pink.filter(([x]) => x < w / 2);
      const right = pink.filter(([x]) => x >= w / 2);
      expect([left.length, right.length]).toEqual([4, 4]);
      const mean = (points: typeof pink, axis: 0 | 1) => points.reduce((sum, p) => sum + p[axis] + 0.5, 0) / points.length;
      expect(mean(left, 0) + mean(right, 0)).toBeCloseTo(w, 9); // (mirrored)
      expect(mean(left, 1)).toBe(build === 'female' ? 10 : 14); // (between the chest's two rows: his 6 and 7, of the game's voxels; hers 4 and 5, where her breast stands furthest)
      // In the middle of its side of the chest: as much skin to its left as to its right, on its row.
      const row = (y: number, z: number) => Array.from({ length: w }, (_, x) => fine.cells[x + w * (y + h * z)]);
      const side = (build === 'female' ? row(10, left[0][2]) : row(13, 9)).map((c, x) => (c && x < w / 2 - 1 ? x : -1)).filter((x) => x >= 0);
      const [first, last] = [Math.min(...side.filter((x) => x >= 2)), Math.max(...side)];
      expect(mean(left, 0), build).toBeCloseTo((first + last + 1) / 2, 9);
    }
    // Close up too (the talk's figure, their sheet): the same eight fine voxels.
    const pinkIn = (look: typeof own) => closeUpFigure(look, {}, {}).grid.cells.filter((c) => c === C.cheek).length;
    expect(pinkIn(stripped) - pinkIn(own)).toBe(8);
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

  it('is called on by people each of a temper: all they say comes of it, their pace is their own, and keeping it earns a tip', () => {
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
      const well = n % 4 < 2; // (their pace well kept, or hardly)
      const [earned, price] = [shift.earned, Math.round(PRICE * shift.rank.tips)]; // (the house's price, at their rank)
      const after = letIn(model, tone, well ? 0.9 : 0.2);
      expect(all(client.temper, 'inside')).toContain(after.door);
      expect(after.theirs.periods).toBe(PACES[client.temper]); // (their own pace)
      expect(after.theirs.band).toBeCloseTo(paceOf(client.temper, tone === liked ? 'liked' : 'disliked').band, 9); // (the tone to their taste: the easier kept)
      expect(after.answers.map((a) => a.label)).toEqual([THANKS[tone]]);
      after.answers[0].pick();
      seeOut(shift);
      if (well) {
        expect(all(client.temper, 'after')).toContain(after.lines[0]);
        expect(shift.earned).toBeGreaterThan(earned + price); // (and something over)
        seen.pleased++;
      } else {
        expect(FLAT).toContain(after.lines[0]);
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
    expect(workCostume(model)).toBeNull(); // (their own gear again)
    expect(workLook(model)).toBe(hero.look);
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

describe('a shift in a room, the hero taken out of it', () => {
  it('is over there and then: no one kept knocking at an empty room, no door to be let back in by', () => {
    const { model, shift } = atWork();
    const { hero } = model;
    until(model, () => shift.client);
    while (shift.client?.kind !== 'plain') [shift.client && model.work.meet()!.talk.answers.at(-1)!.pick(), until(model, () => shift.client)];
    letIn(model).answers[0].pick();
    seeOut(shift);
    const [money, owed] = [hero.money, shift.earned];
    until(model, () => shift.client); // (another at the door)
    // Collapsed, say, and carried down to the hearth: downstairs, the room's door fast behind them.
    const inn = shift.inn;
    model.enterRoom(inn);
    model.takeEvents();
    for (let t = 0; t < 1 && model.work.shift; t += 1 / 30) model.update(0, 0, 1 / 30);
    expect(model.work.shift).toBeNull();
    expect(hero.money).toBeGreaterThanOrEqual(money + owed); // (what they'd earned: paid)
    expect(model.takeEvents().some((e) => e.kind === 'shift')).toBe(true);
    expect([shift.client, shift.visitor, model.work.held]).toEqual([null, null, false]);
    expect((letUntil(inn) ?? 0) <= model.minutes).toBe(true);
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
