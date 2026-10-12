// @vitest-environment happy-dom
// The quests' cheat (model/story/story.ts `questsOf`, `replay`, `finish`; controller/cheats/questDebug.ts): every
// quest of someone's calling listed, set with them or not; one played again from its offer, whatever it follows and
// however it stood; what a taken quest asks done at once, a board's too.
import { describe, expect, it } from 'vitest';
import type { Npc } from '../src/model/npcs/npcs';
import { STORY_QUESTS } from '../src/model/story/story';
import { besideWhom } from '../src/controller/cheats/questDebug';
import { restore, snapshot } from '../src/model/save';
import { everyKindOfWorld } from './support/testWorld';

const world = () => everyKindOfWorld().at(-1)!; // (a full-size world: many villages)

describe("the quests' cheat", () => {
  it('lists every quest of a calling beside whoever has it, and plays any of them again from its offer', () => {
    const model = world();
    const { story } = model;
    const smith = model.npcs.find((n) => n.role === 'smith')!;
    const list = story.questsOf(smith);
    expect(list.map((q) => q.id).sort()).toEqual(Object.values(STORY_QUESTS).filter((q) => q.giver === 'smith').map((q) => q.id).sort());
    expect(list.some((q) => q.set)).toBe(true);
    expect(list.some((q) => !q.set)).toBe(true); // (no village draws them all)
    // One that follows another, not set here: put on offer all the same, its talk its own.
    const later = list.find((q) => !q.lacks && STORY_QUESTS[q.id].follows && q.state !== 'offered') ?? list.find((q) => !q.lacks && !q.set)!;
    const key = story.replay(later.id, smith)!;
    expect(key).toBe(later.key);
    expect(story.stateOf(key)).toBe('offered');
    const talk = story.talk(smith, key)!;
    expect(talk.quest).toMatchObject({ name: later.name, state: 'offered' });
    talk.answers[0].pick();
    expect(story.stateOf(key)).toBe('taken');
    // Finished at once, handed in (or done, with no one else to take it in), then played again.
    expect(story.finish(key)).toBe(true);
    expect(story.ready(key)).toBe(true);
    if (story.stateOf(key) === 'taken') expect(story.handIn(key)).toBe(true);
    expect(story.stateOf(key)).toBe('done');
    expect(story.replay(later.id, smith)).toBe(key);
    expect(story.stateOf(key)).toBe('offered');
    expect(story.talk(smith, key)?.quest?.name).toBe(later.name);
    // (What can't be played here says why, and isn't.)
    for (const q of list.filter((q) => q.lacks)) expect(story.replay(q.id, smith)).toBeNull();
  });

  it('lets any villager give the villagers\' quests, a traveller the road\'s; whoever is nearest is whose list it is', () => {
    const model = world();
    const { story, hero } = model;
    const villager = model.npcs.filter((n) => n.role === 'villager').at(-1)! as Npc;
    const theirs = story.questsOf(villager);
    expect(theirs.length).toBe(Object.values(STORY_QUESTS).filter((q) => q.giver === 'villagerA' || q.giver === 'villagerB').length);
    const pick = theirs.find((q) => !q.lacks && !STORY_QUESTS[q.id].receiver?.startsWith('next') && STORY_QUESTS[q.id].receiver?.startsWith('villager'))!;
    const key = story.replay(pick.id, villager)!;
    expect(story.markOf(villager)).toBe('offer');
    story.talk(villager, key)!.answers[0].pick();
    expect(story.taken.find((t) => t.id === key)).toMatchObject({ to: villager, toName: villager.name });
    // Beside them (out of doors): theirs is the list.
    model.teleport(villager.village.x + 4, villager.village.z + 4);
    model.update(0, 0, 1 / 30);
    Object.assign(villager, { where: null, x: hero.x + 0.8, z: hero.z });
    expect(besideWhom(model)).toBe(villager);
    Object.assign(villager, { x: hero.x + 9 });
    expect(besideWhom(model)).not.toBe(villager);
  });

  it('keeps a quest set by hand through a save: still theirs to take in after', () => {
    const model = world();
    const { story } = model;
    const smith = model.npcs.find((n) => n.role === 'smith')!;
    const villager = model.npcs.filter((n) => n.role === 'villager' && n.village === smith.village).at(-1)!;
    const unset = story.questsOf(smith).find((q) => !q.set && !q.lacks && STORY_QUESTS[q.id].receiver === 'smith')!;
    const own = story.questsOf(villager).find((q) => !q.lacks && STORY_QUESTS[q.id].receiver === STORY_QUESTS[q.id].giver)!;
    for (const [q, who] of [[unset, smith], [own, villager]] as const) story.talk(who, story.replay(q.id, who)!)!.answers[0].pick();
    const again = world();
    restore(again, JSON.parse(JSON.stringify(snapshot(model))));
    const [smithAgain, villagerAgain] = [again.npcs.find((n) => n.id === smith.id)!, again.npcs.find((n) => n.id === villager.id)!];
    for (const [q, who] of [[unset, smithAgain], [own, villagerAgain]] as const) {
      expect(again.story.stateOf(q.key)).toBe('taken');
      expect(again.story.finish(q.key)).toBe(true);
      expect(again.story.markOf(who), q.id).toBe('ready');
      expect(again.story.talk(who, q.key)?.quest).toMatchObject({ name: q.name, state: 'handIn' });
    }
    // An older save, with nothing kept of what was set by hand: the village's own people take it in all the same.
    const older = world();
    const data = JSON.parse(JSON.stringify(snapshot(model)));
    delete data.story.forced;
    restore(older, data);
    expect(older.story.finish(unset.key)).toBe(true);
    expect(older.story.markOf(older.npcs.find((n) => n.id === smith.id)!)).toBe('ready');
  });

  it("finishes what a quest asks at once: foes counted, things put in the bag, a board's quest too", () => {
    const model = world();
    const { story, hero, quests } = model;
    hero.bags.fill(null);
    const [bring] = story.keysOf('firewood');
    story.accept(bring);
    expect(story.ready(bring)).toBe(false);
    expect(story.finish(bring)).toBe(true);
    expect(hero.bag.birchLog).toBe(5);
    expect(story.stateOf(bring)).toBe('taken'); // (still to be handed in)
    expect(story.finish('firewood@nowhere')).toBe(false);
    // The road's, with no one to go back to: paid on the spot.
    story.accept('wolvesAtMyHeels@road');
    const money = hero.money;
    expect(story.finish('wolvesAtMyHeels@road')).toBe(true);
    expect(story.stateOf('wolvesAtMyHeels@road')).toBe('done');
    expect(hero.money).toBeGreaterThan(money);
    // A board's.
    const offered = model.villages.flatMap((v) => quests.offersAt(model.boardOf(v)));
    expect(offered.length).toBeGreaterThan(0);
    expect(quests.accept(offered[0])).toBe(true);
    const taken = quests.taken[0];
    expect(quests.done(taken)).toBe(false);
    expect(quests.finish(taken.quest.key)).toBe(true);
    expect(quests.done(taken)).toBe(true);
  });
});
