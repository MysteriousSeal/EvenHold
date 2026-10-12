// @vitest-environment happy-dom
// The quests people give (model/story/): the first village's line (the carter's word, then spokes, wolves, the old
// stones: each on offer once the one before is done, asking in turn something brought, foes slain, a place reached);
// every village's own, set from the same templates (its keepers and villagers, by its level, a gift with some); the
// road's (given by whoever's met, done as what they ask is). The marks over heads, the talk scene (controller/story/
// talkPanel.ts) with its follow-up offer and a keeper's wares an answer away, the tracker's card, abandoning, saving.
import { describe, expect, it } from 'vitest';
import type { GameModel } from '../src/model/GameModel';
import { STORY_QUESTS, type Who } from '../src/model/story/story';
import { addToBag } from '../src/model/hero/bag';
import { interactionOf } from '../src/model/hero/interaction';
import type { Enemy } from '../src/model/types';
import type { Npc } from '../src/model/npcs/npcs';
import { restore, snapshot } from '../src/model/save';
import { villageName } from '../src/model/villages/villageNames';
import { createTalkPanel } from '../src/controller/story/talkPanel';
import { createQuestTracker } from '../src/view/hud/questTracker';
import { everyKindOfWorld, fresh } from './support/testWorld';

const quest = STORY_QUESTS.wordToTheInn;
const wolf = (model: GameModel) => ({ kind: 'wolf', x: model.hero.x, y: model.hero.y, z: model.hero.z }) as Enemy;
// A quest of `who`'s, taken (their offers gone through till it's the one named).
function take(model: GameModel, who: Who, name: string): boolean {
  for (let i = 0; i < 12; i++) {
    const talk = model.story.talk(who);
    if (talk?.quest?.state !== 'offered') return false;
    talk.answers[0].pick();
    if (talk.quest.name === name) return true;
  }
  return false;
}

describe('the quests people give', () => {
  it('have their people in every world, and others asking: each with a mark has something to say', () => {
    for (const model of everyKindOfWorld()) {
      const cast = model.story.people;
      expect(cast, `seed ${model.seed}`).not.toBeNull();
      expect(cast!.barmaid.role).toBe('barkeep');
      expect(cast!.barmaid.home).toBe(cast!.inn);
      expect(model.story.markOf(cast!.carter)).toBe('offer');
      expect(model.story.stateOf(quest.id)).toBe('offered');
      const asking = model.story.asking;
      expect(asking.length).toBeGreaterThan(3);
      for (const { who, mark } of asking) expect(model.story.talk(who), `${who.name}: ${mark}`).not.toBeNull();
    }
  }, 60_000);

  it('are offered, taken, handed in and paid: the first of the line, from the carter to the barmaid', () => {
    const model = fresh();
    const { story, hero } = model;
    const { carter, barmaid, village } = story.people!;
    expect(story.carterInReach).toBeNull();
    model.teleport(carter.x - 1, carter.z + 0.3);
    expect(story.carterInReach).toBe(carter);
    const offer = story.talk(carter)!;
    expect(offer.speaker).toBe(carter.name);
    expect(offer.lines.join(' ')).toContain(villageName(village, model.seed));
    expect(offer.lines.join(' ')).toContain(barmaid.name);
    expect(offer.quest).toMatchObject({ name: quest.name, copper: quest.copper, state: 'offered' });
    expect(offer.answers.map((a) => a.label)).toEqual([quest.accept, quest.decline]); // (he has no wares to show)
    offer.answers[1].pick(); // not my trouble
    expect(story.stateOf(quest.id)).toBe('offered');
    offer.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('taken');
    expect(story.markOf(carter)).toBeNull();
    expect(story.markOf(barmaid)).toBe('ready');
    expect(story.taken).toMatchObject([{ id: 'wordToTheInn@first', name: quest.name, to: barmaid, toName: barmaid.name, fromName: carter.name, door: story.people!.inn }]);
    expect(story.talk(carter)!.answers).toEqual([]); // (he only says where to go)
    const [money, xp, level] = [hero.money, hero.xp, hero.level];
    const handIn = story.talk(barmaid)!;
    expect(handIn.quest?.state).toBe('handIn');
    handIn.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('done');
    expect(hero.money).toBe(money + quest.copper);
    expect(hero.level > level || hero.xp > xp).toBe(true);
    expect(story.markOf(carter)).toBeNull();
    expect(story.taken).toEqual([]);
    expect(story.done).toEqual([{ id: 'wordToTheInn@first', name: quest.name }]);
    expect(story.handIn(quest.id)).toBe(false); // (never paid twice)
    expect(hero.money).toBe(money + quest.copper);
    expect(story.markOf(barmaid)).toBe('offer'); // (the next of the line: hers to give)
  });

  it('run on as a line, each on offer once the one before is done, asking in turn: something brought, foes slain, a place reached', () => {
    const model = fresh();
    const { story, hero } = model;
    const { carter, barmaid, smith, ruin } = story.people!;
    expect(smith).not.toBeNull();
    expect(ruin).not.toBeNull();
    const [spokes, wolves, stones] = [STORY_QUESTS.spokesForTheWheel, STORY_QUESTS.wolvesOnTheTrail, STORY_QUESTS.theOldStones];
    expect([spokes.id, wolves.id, stones.id].map((id) => story.stateOf(id))).toEqual(['locked', 'locked', 'locked']);
    story.accept(quest.id);
    story.handIn(quest.id);
    // Brought: three birch logs to the smith. A grey "?" over him till they're carried; given over as it's handed in.
    expect(story.stateOf(spokes.id)).toBe('offered');
    expect(story.offers(barmaid)).toBe(true);
    // (What she says of an axe is what they carry: one, to use it; none, where to get one.)
    const has = model.lumber.axe;
    expect(story.talk(barmaid)!.lines.join(' ').includes('You carry an axe')).toBe(has);
    for (const key of Object.keys(hero.bag)) if (key.startsWith('hatchet')) delete hero.bag[key as never];
    delete hero.equipment.mainHand;
    expect(model.lumber.axe).toBe(false);
    expect(story.talk(barmaid)!.lines.join(' ')).toContain('sells hatchets');
    expect(story.talk(barmaid)!.answers.map((a) => !!a.trade)).toEqual([false, false, true]); // (her wares, an answer away)
    story.talk(barmaid)!.answers[0].pick();
    expect(story.stateOf(spokes.id)).toBe('taken');
    expect(['waiting', 'offer']).toContain(story.markOf(smith!)); // (a grey "?": or a "!", where he's work of his own to give)
    expect(story.taken[0]).toMatchObject({ id: 'spokesForTheWheel@first', have: 0, of: 3, ready: false, to: smith, door: smith!.home });
    expect(story.talk(smith!)?.quest?.state).not.toBe('handIn');
    expect(story.handIn(spokes.id)).toBe(false);
    for (let i = 0; i < 4; i++) addToBag(hero.bag, 'birchLog');
    expect(story.taken[0]).toMatchObject({ have: 3, ready: true });
    expect(story.markOf(smith!)).toBe('ready');
    const money = hero.money;
    story.talk(smith!)!.answers[0].pick();
    expect(story.stateOf(spokes.id)).toBe('done');
    expect(hero.bag.birchLog).toBe(1); // (three given over, the fourth kept)
    expect(hero.money).toBe(money + spokes.copper);
    // Slain: three wolves, counted as they fall (a boar's no wolf); then word to the carter.
    expect(take(model, smith!, wolves.name)).toBe(true);
    expect(story.markOf(carter)).toBe('waiting');
    story.onKill({ kind: 'boar' } as Enemy);
    expect(story.progress(wolves.id)).toEqual({ have: 0, of: 3 });
    for (let i = 0; i < 5; i++) story.onKill(wolf(model));
    expect(story.taken.find((q) => q.name === wolves.name)).toMatchObject({ have: 3, ready: true, goal: null });
    expect(story.markOf(carter)).toBe('ready');
    story.talk(carter)!.answers[0].pick();
    expect(story.stateOf(wolves.id)).toBe('done');
    // Reached: the old ruin, come near; then back to the carter, who gave it.
    story.talk(carter)!.answers[0].pick();
    expect(story.stateOf(stones.id)).toBe('taken');
    expect(story.taken.find((q) => q.name === stones.name)!.goal).toEqual({ x: ruin!.x + ruin!.w / 2, z: ruin!.z + ruin!.d / 2 });
    expect(story.talk(carter)!.answers).toEqual([]); // (he waits on it)
    model.teleport(ruin!.way.x, ruin!.way.z);
    model.update(0, 0, 1 / 30);
    expect(story.ready(stones.id)).toBe(true);
    story.talk(carter)!.answers[0].pick();
    for (const id of [quest.id, spokes.id, wolves.id, stones.id]) expect(story.stateOf(id)).toBe('done');
  });

  it('make one line of fourteen about the first village, each locked till the one before is done, every one of them able to be done', () => {
    for (const model of everyKindOfWorld()) {
      const { story, hero } = model;
      const line = Object.values(STORY_QUESTS).filter((q) => q.scope === 'first');
      expect(line.length).toBe(14);
      expect(line.slice(1).map((q, i) => q.follows === line[i].id)).not.toContain(false); // (each follows the one before)
      hero.bags.fill(null);
      for (const [i, q] of line.entries()) {
        expect(story.keysOf(q.id), `seed ${model.seed}: ${q.id} set`).toEqual([`${q.id}@first`]);
        expect(story.stateOf(q.id), `${q.id} on offer`).toBe('offered');
        if (line[i + 1]) expect(story.stateOf(line[i + 1].id)).toBe('locked');
        expect(story.accept(q.id)).toBe(true);
        const needs = q.needs;
        if (needs?.kind === 'bring') for (let n = 0; n < needs.count; n++) addToBag(hero.bag, needs.item);
        if (needs?.kind === 'slay') for (let n = 0; n < needs.count; n++) story.onKill({ kind: needs.foe, x: hero.x, y: hero.y, z: hero.z } as Enemy);
        if (needs?.kind === 'reach') {
          const goal = story.taken.find((t) => t.id === `${q.id}@first`)!.goal!;
          model.teleport(goal.x + 2, goal.z + 2);
          model.update(0, 0, 1 / 30);
        }
        if (needs?.kind === 'do') model.report(needs.what === 'clearCamp' ? { kind: 'cleared', name: 'a camp', place: 'camp' } : needs.what === 'wish' ? { kind: 'blessing', name: 'Lucky coin' } : { kind: 'shift', job: '', served: 1, walkedOut: 0, tally: '', earned: 1, bonus: 0, early: false });
        expect(story.ready(q.id), `${q.id} ready`).toBe(true);
        expect(story.handIn(q.id), `${q.id} handed in`).toBe(true);
      }
      expect(story.done.filter((d) => d.id.endsWith('@first')).length).toBe(14);
      expect(Object.keys(hero.bag).some((key) => key.startsWith('shortSword'))).toBe(true); // (the last of them pays in steel)
    }
  }, 60_000);

  it("pay a night spent with whoever asked in a night's rest: all health and energy back, and up in the morning", () => {
    const model = everyKindOfWorld().at(-1)!;
    const { story, hero } = model;
    const [broth] = story.keysOf('meatForTheBroth').filter((key) => story.keysOf('supperForTwo').includes(key.replace('meatForTheBroth', 'supperForTwo')));
    const supper = broth.replace('meatForTheBroth', 'supperForTwo');
    expect(story.stateOf(supper)).toBe('locked'); // (asked only of one who's helped before)
    story.accept(broth);
    for (let i = 0; i < 3; i++) addToBag(hero.bag, 'rawBoarMeat');
    expect(story.handIn(broth)).toBe(true);
    expect(story.pays(supper).gift).toBe("2 × Minor health potion and a night's rest");
    story.accept(supper);
    addToBag(hero.bag, 'meatPie');
    Object.assign(hero, { hp: 1, energy: 0 });
    const before = model.minutes;
    expect(story.handIn(supper)).toBe(true);
    expect(hero.hp).toBeGreaterThan(1);
    expect(hero.energy).toBeGreaterThan(0);
    expect(model.minutes).toBeGreaterThan(before);
    expect(hero.bag.meatPie ?? 0).toBe(0);
  });

  it("are set in every village from the same few: its own people, paid by its level, a gift with some; a full bag waits", () => {
    const model = everyKindOfWorld().at(-1)!; // (a full-size world: many villages)
    const { story, hero } = model;
    // The same quest in many villages, each its own (its key the village's), and not in all of them.
    const firewood = story.keysOf('firewood');
    expect(firewood.length).toBeGreaterThan(5);
    expect(new Set(firewood).size).toBe(firewood.length);
    expect(firewood.length).toBeLessThan(model.villages.length);
    // A villager asks; a word with them is what E does beside them; taken, brought, handed in, the bread theirs.
    story.accept(firewood[0]);
    const asker = story.taken[0].to as Npc; // (who it's handed in to: its giver)
    expect(asker.role).toBe('villager');
    story.abandon(firewood[0]);
    model.teleport(asker.village.x + 4, asker.village.z + 4); // (to their village: its folk about)
    model.update(0, 0, 1 / 30);
    Object.assign(asker, { where: null, x: model.hero.x + 0.6, z: model.hero.z, steps: [{ kind: 'wait', for: 999 }] }); // (out of doors, beside the hero)
    expect(story.askerInReach).toBe(asker);
    expect(interactionOf(model, new Set(['loot', 'chest', 'chop', 'stand', 'sit']))).toMatchObject({ kind: 'talk', npc: asker }); // (bar what else may be in reach just there: a tree, a bench)
    expect(take(model, asker, 'Firewood')).toBe(true);
    const pays = { ...story.pays(firewood[0]) };
    expect(pays.gift).toBe('3 × Bread loaf');
    expect(story.talk(asker)?.answers.some((a) => a.trade) ?? false).toBe(false); // (no wares)
    for (const q of story.taken) if (q.name !== 'Firewood') story.abandon(q.id); // (the others of theirs taken on the way: let go)
    const taken = story.taken[0];
    expect(taken).toMatchObject({ name: 'Firewood', have: 0, of: 5, to: asker });
    expect(['waiting', 'offer']).toContain(story.markOf(asker));
    for (let i = 0; i < 5; i++) addToBag(hero.bag, 'birchLog');
    expect(story.markOf(asker)).toBe('ready');
    const [money, bread] = [hero.money, hero.bag.bread ?? 0];
    story.talk(asker)!.answers[0].pick();
    expect(story.stateOf(taken.id)).toBe('done');
    expect([hero.money - money, (hero.bag.bread ?? 0) - bread, hero.bag.birchLog ?? 0]).toEqual([pays.copper, 3, 0]);
    // Further out pays more: the same quest, a village of a higher level.
    const paid = firewood.map((key) => story.pays(key).copper);
    expect(Math.max(...paid)).toBeGreaterThan(Math.min(...paid));
    // A thing done: a shift worked to its end, told by the game, counts for the barmaid's.
    const shift = story.keysOf('shortHanded')[0];
    expect(shift).toBeDefined();
    story.accept(shift);
    expect(story.progress(shift)).toEqual({ have: 0, of: 1 });
    model.report({ kind: 'shift', job: 'Server', served: 3, walkedOut: 0, tally: '', earned: 10, bonus: 0, early: true });
    expect(story.ready(shift)).toBe(false); // (left early: not seen through)
    model.report({ kind: 'shift', job: 'Server', served: 3, walkedOut: 0, tally: '', earned: 10, bonus: 0, early: false });
    expect(story.ready(shift)).toBe(true);
    const pies = hero.bag.meatPie ?? 0;
    expect(story.handIn(shift)).toBe(true);
    expect((hero.bag.meatPie ?? 0) - pies).toBe(2);
  }, 60_000);

  it('are given on the road by whoever is met, and done the moment what they ask is: paid there, a pedlar back to his trade', () => {
    const model = everyKindOfWorld().at(-1)!;
    const { story, hero } = model;
    const pedlar = model.travellers.list.find((t) => t.role === 'pedlar')!;
    expect(pedlar).toBeDefined();
    expect(story.markOf(pedlar)).toBe('offer');
    const offer = story.talk(pedlar)!;
    expect(offer.quest).toMatchObject({ name: 'Wolves at my heels', gift: '1 × Rough sack' });
    expect(offer.answers.map((a) => !!a.trade)).toEqual([false, false, true]); // (his pack, an answer away)
    offer.answers[0].pick();
    expect(story.stateOf('wolvesAtMyHeels@road')).toBe('taken');
    expect(story.markOf(pedlar)).toBeNull();
    expect(story.talk(pedlar)).toBeNull(); // (his trade again, while it's under way)
    expect(story.taken[0]).toMatchObject({ to: null, toName: '', fromName: pedlar.name, have: 0, of: 4 });
    const [money, sacks] = [hero.money, hero.bag.roughSack ?? 0];
    for (let i = 0; i < 4; i++) story.onKill(wolf(model));
    expect(story.stateOf('wolvesAtMyHeels@road')).toBe('done'); // (no one to go back to: done as the fourth falls)
    expect(hero.money - money).toBe(story.pays('wolvesAtMyHeels@road').copper);
    expect((hero.bag.roughSack ?? 0) - sacks).toBe(1);
    // A wish at a well counts for the pilgrim's, wherever it's made.
    story.accept('aCoinAtTheWell@road', model.travellers.list.find((t) => t.role === 'pilgrim'));
    model.report({ kind: 'blessing', name: 'Lucky coin' });
    expect(story.stateOf('aCoinAtTheWell@road')).toBe('done');
  }, 60_000);

  it('abandoned, are on offer again from whoever gave them', () => {
    const model = fresh();
    const { story } = model;
    const { carter } = story.people!;
    expect(story.abandon(quest.id)).toBe(false); // (not taken: nothing to let go)
    story.accept(quest.id);
    expect(story.abandon(quest.id)).toBe(true);
    expect(story.stateOf(quest.id)).toBe('offered');
    expect(story.markOf(carter)).toBe('offer');
    expect(story.taken).toEqual([]);
    expect(story.talk(carter)!.quest?.state).toBe('offered'); // (his offer, as at first)
    story.talk(carter)!.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('taken');
    story.handIn(quest.id);
    expect(story.abandon(quest.id)).toBe(false); // (done: not undone)
  });

  it('abandoned, leave the tracker: no card left for them; untracked, off it and still taken', () => {
    const model = fresh();
    const update = createQuestTracker(model);
    const toScreen = (x: number, _y: number, z: number) => ({ x, y: z });
    const cards = () => Array.from(document.querySelectorAll('.quest-tracker')).at(-1)!.querySelectorAll('.quest-card').length;
    update(toScreen);
    expect(cards()).toBe(0);
    model.story.accept(quest.id);
    update(toScreen);
    expect(cards()).toBe(1);
    model.story.setTracked(quest.id, false);
    update(toScreen);
    expect(cards()).toBe(0);
    expect(model.story.stateOf(quest.id)).toBe('taken');
    model.story.setTracked(quest.id, true);
    update(toScreen);
    expect(cards()).toBe(1);
    model.story.abandon(quest.id);
    update(toScreen);
    expect(cards()).toBe(0);
    expect((Array.from(document.querySelectorAll('.quest-tracker')).at(-1) as HTMLElement).hidden).toBe(true);
  });

  it('are saved as they stand: taken or done, tracked or not, how far along; an older save read as it was kept', () => {
    const model = fresh();
    const { story } = model;
    for (const id of ['wordToTheInn', 'spokesForTheWheel']) {
      story.accept(id);
      for (let i = 0; i < 3; i++) addToBag(model.hero.bag, 'birchLog');
      story.handIn(id);
    }
    story.accept('wolvesOnTheTrail');
    story.onKill(wolf(model));
    story.onKill(wolf(model));
    story.setTracked('wolvesOnTheTrail', false);
    const again = fresh();
    restore(again, snapshot(model));
    expect(again.story.stateOf('wolvesOnTheTrail')).toBe('taken');
    expect(again.story.isTracked('wolvesOnTheTrail')).toBe(false);
    expect(again.story.progress('wolvesOnTheTrail')).toEqual({ have: 2, of: 3 });
    expect(again.story.stateOf('spokesForTheWheel')).toBe('done');
    expect(again.story.stateOf('theOldStones')).toBe('locked');
    expect(again.story.taken[0]).toMatchObject({ toName: again.story.people!.carter.name });
    again.story.abandon('wolvesOnTheTrail');
    again.story.accept('wolvesOnTheTrail');
    expect(again.story.progress('wolvesOnTheTrail')).toEqual({ have: 0, of: 3 }); // (let go: what was done forgotten)
    const old = fresh();
    old.story.load({ wordToTheInn: 'done', spokesForTheWheel: 'untracked' });
    expect([old.story.stateOf('wordToTheInn'), old.story.stateOf('spokesForTheWheel'), old.story.isTracked('spokesForTheWheel')]).toEqual(['done', 'taken', false]);
  });

  it('are told as a visual novel: both figures, the speaker lit, a line at a time, the quest and the answers; one handed in, the next offered in the same breath', () => {
    const model = fresh();
    const paused: boolean[] = [];
    const traded: Who[] = [];
    const panel = createTalkPanel(model, { setPaused: (p) => paused.push(p), trade: (who) => traded.push(who) });
    const { carter, barmaid } = model.story.people!;
    const scene = document.querySelector('.talk-scene') as HTMLElement;
    const q = (selector: string) => scene.querySelector(selector) as HTMLElement;
    const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    expect(scene.hidden).toBe(true);
    const lines = model.story.talk(carter)!.lines;
    expect(panel.open(carter)).toBe(true);
    expect(scene.hidden).toBe(false);
    expect(scene.querySelectorAll('.talk-figure').length).toBe(2); // (the hero's side, and his)
    expect(q('.talk-plate').textContent).toBe(carter.name);
    expect(q('.talk-figure.right').classList.contains('speaking')).toBe(true);
    expect(q('.talk-figure.left').classList.contains('speaking')).toBe(false);
    // His three lines: each written out at a press, the next at the next; the quest's card with the last.
    for (let i = 0; i < 3; i++) {
      key('Space'); // (the line, whole)
      expect(q('.talk-words').textContent).toBe(lines[i]);
      expect(q('.talk-quest').hidden).toBe(i < 2);
      if (i < 2) key('Space');
    }
    expect(q('.talk-quest-name').textContent).toBe(quest.name);
    expect(q('.talk-quest-mark').textContent).toBe('!');
    // The hero's turn: their name on the plate, their side lit, the answers as buttons.
    key('Space');
    expect(q('.talk-plate').textContent).toBe(model.hero.name);
    expect(q('.talk-figure.left').classList.contains('speaking')).toBe(true);
    const buttons = Array.from(scene.querySelectorAll('.talk-answer')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.querySelector('span')!.textContent)).toEqual([quest.accept, quest.decline]);
    expect(buttons[0].classList.contains('primary')).toBe(true);
    key('Digit1');
    expect(model.story.stateOf(quest.id)).toBe('taken');
    expect(panel.menu.isOpen).toBe(false);
    expect(scene.hidden).toBe(true);
    expect(paused).toEqual([true, false]); // (the game held while they talk)
    // Her turn: the "?" on the card, one answer, clicked.
    expect(panel.open(barmaid)).toBe(true);
    for (let i = 0; i < 4; i++) key('Enter'); // (her two lines, each written out then passed: her turn's done)
    expect(q('.talk-quest-mark').textContent).toBe('?');
    (scene.querySelector('.talk-answer') as HTMLButtonElement).click();
    expect(model.story.stateOf(quest.id)).toBe('done');
    // The next of the line is hers to give: offered in the same breath, the scene still up, her side lit again.
    expect(panel.menu.isOpen).toBe(true);
    expect(q('.talk-plate').textContent).toBe(barmaid.name);
    expect(q('.talk-figure.right').classList.contains('speaking')).toBe(true);
    for (let i = 0; i < 4; i++) key('Space');
    expect(q('.talk-quest-name').textContent).toBe(STORY_QUESTS.spokesForTheWheel.name);
    expect(q('.talk-quest-mark').textContent).toBe('!');
    // Her wares, asked for instead: the scene shut, her own window asked of the game.
    key('Space');
    expect(Array.from(scene.querySelectorAll('.talk-answer span')).map((b) => b.textContent)).toEqual([STORY_QUESTS.spokesForTheWheel.accept, STORY_QUESTS.spokesForTheWheel.decline, 'Show me your wares.']);
    key('Digit3');
    expect(panel.menu.isOpen).toBe(false);
    expect(traded).toEqual([barmaid]);
    expect(model.story.stateOf('spokesForTheWheel')).toBe('offered');
  });
});
