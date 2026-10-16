// Rules the quests people give keep (model/story/), each found wanting once: what a quest asks, done before it was
// ever taken (its camp cleared, its boss slain), still finishes it; someone with a trade, owed a hand-in the bag has no
// room for, still shows their wares; a quest that follows another is only where that one is; what's to be brought
// from one kind of place is asked only where there's one near, and pointed to; one whose giver speaks as a man or a
// woman is offered only by one; one under way whose village is off the maps still told by its own names.
import { describe, expect, it } from 'vitest';
import { dungeonAt } from '../src/model/dungeons/dungeons';
import { BOSS_POST } from '../src/model/dungeons/dungeonRecord';
import { addToBag } from '../src/model/hero/bag';
import { canCarry } from '../src/model/hero/bagSlots';
import { LOOT } from '../src/model/loot/loot';
import { ghostsIn } from '../src/model/ruins/haunting';
import type { LootId } from '../src/model/loot/loot';
import { COMMON_QUESTS, RARE_QUESTS, STORY_QUESTS } from '../src/model/story/quests/catalog';
import { restore, snapshot } from '../src/model/save';
import { GameModel } from '../src/model/GameModel';
import { spawnOf } from '../src/model/map/grid';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { everyKindOfWorld, fresh } from './support/testWorld';

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

describe("a quest to lay a ruin's ghosts, the ruin already quiet", () => {
  it('has as many rise again as it still asks for, within its walls; no more than that, and none once it is done', () => {
    const model = world();
    const { story, hero } = model;
    const key = story.keysOf('theGhostsLaid')[0];
    const asker = model.npcs.find((n) => story.questsOf(n).some((q) => q.key === key && q.set))!;
    story.replay('theGhostsLaid', asker);
    // Its ruin (the nearest to their village): every ghost of it laid, long before.
    story.accept(key);
    const far = (r: (typeof model.ruins)[number]) => Math.hypot(r.x + r.w / 2 - asker.village.x, r.z + r.d / 2 - asker.village.z);
    const ruin = model.ruins.reduce((a, b) => (far(b) < far(a) ? b : a));
    for (const e of model.enemies) if (e.kind === 'ghost' && e.x >= ruin.x && e.x <= ruin.x + ruin.w && e.z >= ruin.z && e.z <= ruin.z + ruin.d) e.state = 'dead';
    expect(ghostsIn(model.enemies, ruin)).toBe(0);
    model.teleport(ruin.way.x, ruin.way.z);
    model.minutes += 5;
    story.update();
    const risen = model.enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead' && e.x >= ruin.x && e.x <= ruin.x + ruin.w && e.z >= ruin.z && e.z <= ruin.z + ruin.d);
    expect(risen.length).toBe(3); // (what it asks)
    for (const g of risen) {
      expect(g.haunt).toBeDefined(); // (bound to the ruin, as its own were)
      expect(model.isOpenTile(Math.round(g.x), Math.round(g.z))).toBe(true);
      expect(Math.hypot(g.x - hero.x, g.z - hero.z)).toBeGreaterThan(1.5);
    }
    expect(new Set(model.enemies.map((e) => e.id)).size).toBe(model.enemies.length); // (each its own number)
    // Looked to again, with enough of them walking: no more.
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(3);
    // Two laid: one still to lay, one still walking: none risen. The last laid: done, and none after.
    for (const g of risen.slice(0, 2)) [(g.state = 'dead'), story.onKill(g)];
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(1);
    [(risen[2].state = 'dead'), story.onKill(risen[2])];
    expect(story.ready(key)).toBe(true);
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(0);
  });
});

describe('a quest for what only the dead carry, the dead all laid', () => {
  it("keeps a few ghosts walking its ruin for what they carry, one ruin's ghosts serving every quest of it", () => {
    const model = world();
    const { story } = model;
    const key = story.keysOf('herLocket')[0];
    const asker = model.npcs.find((n) => story.questsOf(n).some((q) => q.key === key && q.set))!;
    model.teleport(asker.village.x, asker.village.z); // (the land round their village made, its ruins all known: the one it's set at, the nearest of them)
    story.replay('herLocket', asker);
    story.accept(key);
    expect(story.taken.find((t) => t.id === key)!.task).toMatch(/ghosts in the old ruin carry them/); // (said where it's had)
    const goal = story.taken.find((t) => t.id === key)!.goal!; // (the ruin it's set at: with a few ruins to a region, not always the nearest of those made yet)
    const ruin = model.ruins.find((r) => r.x + r.w / 2 === goal.x && r.z + r.d / 2 === goal.z)!;
    for (const e of model.enemies) if (e.kind === 'ghost' && e.x >= ruin.x && e.x <= ruin.x + ruin.w && e.z >= ruin.z && e.z <= ruin.z + ruin.d) e.state = 'dead';
    model.teleport(ruin.way.x, ruin.way.z);
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(3); // (to be laid for the locket, as often as it takes)
    // A second quest of the same ruin, to lay three: the same three do for both (each one laid counts for it).
    const laid = story.replay('theGhostsLaid', asker)!;
    story.accept(laid);
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(3);
    const walking = model.enemies.filter((e) => e.kind === 'ghost' && e.state !== 'dead' && e.x >= ruin.x && e.x <= ruin.x + ruin.w && e.z >= ruin.z && e.z <= ruin.z + ruin.d);
    for (const g of walking) [(g.state = 'dead'), story.onKill(g)];
    expect(story.ready(laid)).toBe(true);
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(3); // (the locket still wanted: more of them)
    addToBag(model.hero.bag, 'fadedLocket');
    for (const g of model.enemies) if (g.kind === 'ghost') g.state = 'dead';
    model.minutes += 5;
    story.update();
    expect(ghostsIn(model.enemies, ruin)).toBe(0); // (had: no more)
  });

  it("puts a crypt's guards back at their posts for what they carry, its lord left slain", () => {
    const model = world();
    const { story } = model;
    const key = story.keysOf('theGhostWhoOwes')[0];
    const asker = model.npcs.find((n) => story.questsOf(n).some((q) => q.key === key && q.set))!;
    story.replay('theGhostWhoOwes', asker);
    story.accept(key);
    const taken = story.taken.find((t) => t.id === key)!;
    expect(taken.name).toBe("The dead man's tab"); // (no ghost in its name: it's the crypt's dead it sends to)
    expect(taken.task).toMatch(/draugr in the crypt under the old ruin carry them/);
    const far = (c: (typeof model.crypts)[number]) => Math.hypot(c.ruin.x + c.ruin.w / 2 - asker.village.x, c.ruin.z + c.ruin.d / 2 - asker.village.z);
    const crypt = model.crypts.reduce((a, b) => (far(b) < far(a) ? b : a));
    const slain = model.cleared(dungeonAt(crypt.entrance)!.key);
    // Cleared of every last one, its lord too.
    for (let post = 0; post < 400; post++) slain.add(post);
    slain.add(BOSS_POST);
    expect(model.clearedShare(crypt.entrance)).toBe(1);
    model.minutes += 5;
    story.update();
    expect(model.clearedShare(crypt.entrance)).toBeLessThan(0.5); // (its guards up again)
    expect(slain.has(BOSS_POST)).toBe(true); // (its lord: not)
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

  it("offers one whose giver speaks as a man or a woman (\"my wife\", \"my husband\") only from one", () => {
    const model = world();
    const { story } = model;
    story.accept('wordToTheInn');
    story.handIn('wordToTheInn'); // (the first village's own asked only after)
    const seen = { offered: 0, locked: 0 };
    for (const who of model.npcs.filter((n) => n.role === 'villager')) {
      for (const q of story.questsOf(who)) {
        const sex = STORY_QUESTS[q.id].sex;
        if (!sex || !q.set) continue;
        expect(q.state, `${q.key}: ${who.look.build}`).toBe(who.look.build === sex ? 'offered' : 'locked');
        seen[q.state as 'offered' | 'locked']++;
      }
    }
    expect(seen.offered).toBeGreaterThan(0);
    expect(seen.locked).toBeGreaterThan(0);
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

describe('a quest under way, its village off the maps', () => {
  it('is told by the names it was taken with: its village, the next, whoever takes it in in the part named', () => {
    const model = fresh();
    const far = { x: 5000, z: 5000 };
    model.story.load({
      states: { 'wordToTheNextInn@99999': 'taken', 'wolvesOnTheTrail@99999': 'taken' },
      kept: { 'wordToTheNextInn@99999': { to: 'Wenna', from: 'Adawen', ...far, village: 'Ashby', next: 'Brockholt', camp: "Red Ned's" }, 'wolvesOnTheTrail@99999': { to: 'Osric', from: 'Thoby', ...far } },
    });
    const task = (id: string) => model.story.taken.find((t) => t.id === id)!.task;
    expect(task('wordToTheNextInn@99999')).toBe('Tell Wenna, at the inn in Brockholt, about the kegs and the magistrate');
    expect(task('wolvesOnTheTrail@99999')).toBe('Slay 3 wolves, then tell Osric the wheel is coming'); // (the carter it's handed in to, not the smith who gave it)
  });
});

describe('a quest whose giver hands over what it is done with', () => {
  it('gives it as it is taken, once: not again when let go and taken up afresh, nor after a save', () => {
    const model = fresh();
    const { story, hero } = model;
    for (const id of ['wordToTheInn', 'spokesForTheWheel']) {
      story.accept(id);
      for (let i = 0; i < 3; i++) addToBag(hero.bag, 'birchLog');
      story.handIn(id);
    }
    const potions = () => hero.bag.minorHealthPotion ?? 0;
    const before = potions();
    story.accept('wolvesOnTheTrail');
    expect(potions()).toBe(before + 2); // (the smith's, for the story's first fight)
    story.abandon('wolvesOnTheTrail');
    story.accept('wolvesOnTheTrail');
    const again = fresh();
    restore(again, snapshot(model));
    again.story.abandon('wolvesOnTheTrail');
    again.story.accept('wolvesOnTheTrail');
    expect([potions(), again.hero.bag.minorHealthPotion ?? 0]).toEqual([before + 2, before + 2]);
    expect(STORY_QUESTS.aSilverForMaren.stake).toEqual({ copper: 100 }); // (the silver for her well: hers)
    expect(STORY_QUESTS.silverToTheWell.stake).toEqual({ copper: 100 });
  });
});

describe('the first village, its line under way', () => {
  it('stays where the line was taken up: kept in the save; an older save, with no village kept, where it was then (the nearest the start)', () => {
    const model = new GameModel(7, STREAMED_SIZE); // (its trail from the start leads past the nearest village)
    const spawn = spawnOf(model.size);
    const nearestVillage = [...model.villages].sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z) - Math.hypot(b.x - spawn.x, b.z - spawn.z))[0];
    const trailed = model.story.people!.village;
    expect(trailed).not.toBe(nearestVillage);
    model.story.accept('wordToTheInn');
    const saved = model.story.save();
    expect(saved.home).toEqual({ x: trailed.x, z: trailed.z });
    // An older save, the line under way and no village kept: the nearest the start, its people with it.
    model.story.load({ states: { 'wordToTheInn@first': 'done', 'spokesForTheWheel@first': 'taken' } });
    expect(model.story.people!.village).toBe(nearestVillage);
    expect(model.story.people!.barmaid.village).toBe(nearestVillage);
    expect(model.story.stateOf('spokesForTheWheel')).toBe('taken');
    expect(model.story.save().home).toBeUndefined(); // (and so saved again: read as it was, the next time too)
    // As saved: where it was kept.
    model.story.load(saved);
    expect(model.story.people!.village).toBe(trailed);
  }, 120_000);
});

describe("the first village's keepers, before the carter's word is carried", () => {
  it("hold their own asks till it's done (one thread at a time); other villages' and a quest already taken (an older save) as they were", () => {
    const model = new GameModel(7, STREAMED_SIZE);
    const { story } = model;
    const { carter, barmaid, smith, village } = story.people!;
    const here = () => story.asking.filter(({ who }) => who === carter || ('village' in who && who.village === village)).map(({ who, mark }) => [who === carter ? 'carter' : (who as { role: string }).role, mark]);
    expect(here()).toEqual([['carter', 'offer']]);
    expect(story.asking.some(({ who }) => 'village' in who && who.village !== village)).toBe(true); // (elsewhere: as ever)
    const shift = story.questsOf(barmaid).find((q) => q.scope === 'village' && q.set)!; // (hers: a shift, bowls, a threat to carry)
    expect(shift.state).toBe('locked');
    expect(story.accept(shift.key)).toBe(false);
    story.accept('wordToTheInn');
    story.handIn('wordToTheInn');
    expect(story.markOf(barmaid)).toBe('offer');
    expect(story.questsOf(barmaid).find((q) => q.key === shift.key)!.state).toBe('offered');
    if (smith) expect(story.markOf(smith)).toBe('offer');
    // An older save: the barmaid's shift taken before the carter's word was.
    story.load({ states: { [shift.key]: 'taken' } });
    expect([story.stateOf('wordToTheInn'), story.stateOf(shift.key)]).toEqual(['offered', 'taken']);
  }, 120_000);
});

describe("a quest's own place, once taken", () => {
  it('stays the ruin it was set by as more of the world is made (a nearer one found after): kept in the save; an older save, as the world now stands', () => {
    const model = new GameModel(7, STREAMED_SIZE);
    const { story } = model;
    const keys = Object.values(STORY_QUESTS).filter((q) => q.scope === 'village' && q.near === 'ruin' && q.needs?.kind === 'bring').flatMap((q) => story.keysOf(q.id));
    const key = keys.find((k) => story.stateOf(k) === 'offered')!;
    expect(key).toBeDefined();
    expect(story.accept(key)).toBe(true);
    const goal = () => story.taken.find((t) => t.id === key)!.goal;
    const was = goal()!;
    expect(was).not.toBeNull();
    // A region made since, with a ruin nearer the village than the one it was set by.
    const village = model.villages.find((v) => String(model.boardOf(v)) === key.split('@')[1])!;
    const ruin = model.ruins.find((r) => Math.hypot(r.x + r.w / 2 - was.x, r.z + r.d / 2 - was.z) < 1)!;
    model.ruins.push({ ...ruin, x: (village.x + was.x) / 2 - ruin.w / 2, z: (village.z + was.z) / 2 - ruin.d / 2 });
    story.update();
    expect(goal()).toEqual(was);
    const loaded = new GameModel(7, STREAMED_SIZE);
    restore(loaded, snapshot(model));
    loaded.ruins.push({ ...ruin, x: (village.x + was.x) / 2 - ruin.w / 2, z: (village.z + was.z) / 2 - ruin.d / 2 });
    loaded.story.update();
    expect(loaded.story.taken.find((t) => t.id === key)!.goal).toEqual(was);
    // An older save (no place kept): the nearest as the world now stands.
    const old = story.save();
    for (const k of Object.values(old.kept)) delete (k as { goal?: unknown }).goal;
    story.load(old);
    expect(goal()).not.toEqual(was);
  }, 120_000);
});
