// The second arc in a classic world (an older save's: no Greyminster on it, nor off it): played from the first
// village's line done to what the carter said; then, with no Greyminster to go on to, it closes on a line of its own
// (nothing left waiting on a town that isn't there).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import type { Npc } from '../src/model/npcs/npcs';
import { FIRST_QUESTS, SAINT_QUESTS } from '../src/model/story/quests/catalog';
import type { Talk } from '../src/model/story/story';

const of = (model: GameModel, role: string, near: { x: number; z: number }): Npc =>
  model.npcs.filter((n) => n.role === role).sort((a, b) => Math.hypot(a.village.x - near.x, a.village.z - near.z) - Math.hypot(b.village.x - near.x, b.village.z - near.z))[0];
const go = (model: GameModel, at: { x: number; z: number }) => void [Object.assign(model.hero, { x: at.x, z: at.z }), model.story.update()];
const say = (talk: Talk | null): Talk | void => talk!.answers[0].pick();

describe('the second arc in a classic world', () => {
  it('closes on a line after what the carter said, nothing left waiting', () => {
    const model = new GameModel(3, { width: 2048, depth: 2048 });
    expect(model.cathedralTown()).toBe(null);
    const { story } = model;
    story.load(Object.fromEntries(FIRST_QUESTS.map((q) => [q.id, 'done'])));
    story.choices.take('theDoorman', 'truth');
    const home = story.people!.village;
    const herbalist = of(model, 'herbalist', home);
    const barmaid = of(model, 'barkeep', home);
    say(story.talk(herbalist));
    go(model, story.people!.carter.wagon);
    say(story.talk(herbalist));
    say(story.talk(barmaid));
    model.report({ kind: 'shift', job: 'bar', served: 5, walkedOut: 0, tally: '', earned: 10, bonus: 0, early: false });
    say(story.talk(barmaid));
    say(story.talk(herbalist));
    go(model, story.taken.find((t) => t.name === 'The road out')!.goal!);
    expect(story.saint.act).toBe(2);
    const witch = of(model, 'witch', model.hero);
    const a = model.npcs.filter((n) => n.village === witch.village && n.role === 'villager').sort((x, y) => x.id - y.id)[0];
    say(story.talk(a));
    say(story.talk(witch));
    model.hero.bag.ale = 1;
    const b = model.npcs.find((n) => n.village === witch.village && story.talk(n)?.quest?.name === 'What the carter said')!;
    say(story.talk(b));
    say(story.talk(b));
    expect(story.did('whatTheCarterSaid')).toBe(true);
    // (No Greyminster: the arc closed on a line, said by her, and over.)
    const last = story.talk(b)!;
    expect(last.lines.join(' ')).toMatch(/another life/i);
    say(last);
    expect(story.saint.act).toBe(4);
    expect(story.markOf(b)).toBe(null);
    for (const q of SAINT_QUESTS) expect(['offered', 'taken']).not.toContain(story.stateOf(story.keysOf(q.id)[0] ?? q.id));
    expect(story.taken.filter((t) => SAINT_QUESTS.some((q) => q.name === t.name))).toEqual([]);
  });
});
