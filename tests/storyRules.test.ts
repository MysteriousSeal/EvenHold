// Rules the quests people give keep (model/story/), each found wanting once: what a quest asks, done before it was
// ever taken (its camp cleared, its boss slain), still finishes it; someone with a trade, owed a hand-in the bag has no
// room for, still shows their wares; a quest that follows another is only where that one is; what's to be brought
// from one kind of place is asked only where there's one near, and pointed to.
import { describe, expect, it } from 'vitest';
import type { GameModel } from '../src/model/GameModel';
import { dungeonAt } from '../src/model/dungeons/dungeons';
import { BOSS_POST } from '../src/model/dungeons/dungeonRecord';
import { addToBag } from '../src/model/hero/bag';
import { canCarry } from '../src/model/hero/bagSlots';
import { LOOT } from '../src/model/loot/loot';
import type { LootId } from '../src/model/loot/loot';
import { COMMON_QUESTS, RARE_QUESTS, STORY_QUESTS } from '../src/model/story/quests/catalog';
import { everyKindOfWorld } from './support/testWorld';

const world = () => everyKindOfWorld().at(-1)!; // (a full-size world: many villages)
// A quest of `role`'s in some village, taken (by the cheat's replay, whatever it follows).
function taken(model: GameModel, role: 'smith' | 'herbalist' | 'bouncer' | 'barkeep', id: string, pick = 0): { key: string; who: GameModel['npcs'][number] } {
  const who = model.npcs.filter((n) => n.role === role && model.story.questsOf(n).some((q) => q.id === id && !q.lacks))[pick];
  const key = model.story.replay(id, who)!;
  model.story.talk(who, key)!.answers[0].pick();
  expect(model.story.stateOf(key)).toBe('taken');
  return { key, who };
}

describe('a quest asking what was done before it was taken', () => {
  it("is finished by its village's camp found already cleared", () => {
    const model = world();
    const { story } = model;
    const { key, who } = taken(model, 'bouncer', 'theCampSeenTo');
    model.teleport(who.village.x + 4, who.village.z + 4);
    model.update(0, 0, 1 / 30);
    expect(story.ready(key)).toBe(false); // (its bandits stand)
    const goal = story.taken.find((t) => t.id === key)!.goal!;
    const camp = model.camps.find((c) => c.way.x === goal.x && c.way.z === goal.z)!;
    expect(model.campEmpty(camp)).toBe(false);
    for (const e of model.enemies) if ((e.kind === 'bandit' || e.kind === 'banditChief') && Math.hypot(e.x - camp.x, e.z - camp.z) < 30) e.state = 'dead';
    expect(model.campEmpty(camp)).toBe(true);
    // Let go and taken again, the camp long empty (no "cleared" to be told of it now): done all the same.
    story.abandon(key);
    story.talk(who, story.replay('theCampSeenTo', who)!)!.answers[0].pick();
    expect(story.ready(key)).toBe(false);
    story.update();
    expect(story.ready(key)).toBe(true);
    expect(story.markOf(who)).toBe('ready');
  });

  it("is finished by its ruin's crypt lord found already slain", () => {
    const model = world();
    const { story } = model;
    const { ruin, village } = story.people!;
    const crypt = model.crypts.find((c) => c.ruin === ruin)!;
    const herbalist = model.npcs.find((n) => n.role === 'herbalist' && n.village === village)!;
    const key = story.replay('thePriestBelow', herbalist)!;
    story.talk(herbalist, key)!.answers[0].pick();
    story.update();
    expect(story.ready(key)).toBe(false); // (he walks yet)
    model.cleared(dungeonAt(crypt.entrance)!.key).add(BOSS_POST);
    story.update();
    expect(story.ready(key)).toBe(true);
  });
});

describe('someone with a trade, owed a hand-in', () => {
  it('still shows their wares with the bag too full for what they owe', () => {
    const model = world();
    const { story, hero } = model;
    const { key, who } = taken(model, 'herbalist', 'meatForTheBroth');
    for (let i = 0; i < 3; i++) addToBag(hero.bag, 'rawBoarMeat');
    expect(story.talk(who)?.quest?.state).toBe('handIn');
    for (const id of Object.keys(LOOT) as LootId[]) if (id !== 'minorHealthPotion' && canCarry(hero, id)) addToBag(hero.bag, id);
    expect(canCarry(hero, 'minorHealthPotion')).toBe(false);
    const talk = story.talk(who)!;
    expect(talk.quest).toBeUndefined();
    expect(talk.answers.some((a) => a.trade)).toBe(true);
    expect(story.stateOf(key)).toBe('taken'); // (still owed)
  });
});

describe('where quests are set', () => {
  it('sets one that follows another only where that one is', () => {
    const { story } = world();
    const where = (id: string) => story.keysOf(id).map((key) => key.split('@')[1]);
    for (const quest of [...COMMON_QUESTS, ...RARE_QUESTS]) if (quest.follows) for (const village of where(quest.id)) expect(where(quest.follows), `${quest.id} after ${quest.follows}`).toContain(village);
    expect(where('supperForTwo').length).toBeGreaterThan(3);
  });

  it('asks for what one kind of place gives only where there is one near, and points there', () => {
    const model = world();
    const { story } = model;
    for (const [id, place] of [['herLocket', 'ruin'], ['theColdForge', 'ruin'], ['myMarkOnTheBlade', 'ruin'], ['theGhostWhoOwes', 'ruin'], ['candlesAtTheDoor', 'ruin'], ['silkForAShroud', 'cave']] as const) {
      expect(STORY_QUESTS[id].near, id).toBe(place);
      const [key] = story.keysOf(id);
      if (!key) continue;
      story.replay(id, model.npcs.find((n) => story.questsOf(n).some((q) => q.key === key && q.set))!);
      story.accept(key);
      expect(story.taken.find((t) => t.id === key)?.goal, id).not.toBeNull();
    }
  });
});
