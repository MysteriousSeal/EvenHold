// @vitest-environment happy-dom
// The quests people give (model/story/story.ts): a "!" over the carter at the start; a word with him offers his
// quest (to the nearest village's inn, its barmaid named); taken, the "?" is over her, the tracker's and journal's
// told of it; a word with her hands it in and pays; it's saved; and the talk window (controller/story/talkPanel.ts).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { STORY_QUESTS } from '../src/model/story/storyQuests';
import { restore, snapshot } from '../src/model/save';
import { villageName } from '../src/model/villages/villageNames';
import { createTalkPanel } from '../src/controller/story/talkPanel';
import { createQuestTracker } from '../src/view/hud/questTracker';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh } from './support/testWorld';

const quest = STORY_QUESTS.wordToTheInn;

describe('the quests people give', () => {
  it('have their people in every world: the carter, the nearest village, its inn and barmaid', () => {
    for (const model of [...TEST_SEEDS.map((seed) => new GameModel(seed, TEST_MAP_SIZE)), new GameModel(7, STREAMED_SIZE)]) {
      const cast = model.story.people;
      expect(cast, `seed ${model.seed}`).not.toBeNull();
      expect(cast!.barmaid.role).toBe('barkeep');
      expect(cast!.barmaid.home).toBe(cast!.inn);
      expect(model.story.markOf(cast!.carter)).toBe('offer');
      expect(model.story.markOf(cast!.barmaid)).toBeNull();
    }
  }, 60_000);

  it('are offered, taken, handed in and paid: the marks moving from the giver to who it is handed in to', () => {
    const model = fresh();
    const { story, hero } = model;
    const { carter, barmaid, village } = story.people!;
    expect(story.carterInReach).toBeNull();
    model.teleport(carter.x - 1, carter.z + 0.3);
    expect(story.carterInReach).toBe(carter);
    // Offered: his lines name the village and its barmaid; two answers.
    const offer = story.talk(carter)!;
    expect(offer.speaker).toBe(carter.name);
    expect(offer.lines.join(' ')).toContain(villageName(village, model.seed));
    expect(offer.lines.join(' ')).toContain(barmaid.name);
    expect(offer.quest).toMatchObject({ name: quest.name, copper: quest.copper, state: 'offered' });
    expect(offer.answers.map((a) => a.label)).toEqual([quest.accept, quest.decline]);
    expect(story.talk(barmaid)).toBeNull(); // (nothing of the story's with her yet: her own trade)
    offer.answers[1].pick(); // not now
    expect(story.stateOf(quest.id)).toBe('offered');
    offer.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('taken');
    expect(story.markOf(carter)).toBeNull();
    expect(story.markOf(barmaid)).toBe('ready');
    expect(story.taken.map((q) => [q.name, q.to, q.door])).toEqual([[quest.name, barmaid, story.people!.inn]]);
    expect(story.talk(carter)!.answers).toEqual([]); // (he only says where to go)
    // Handed in to her: paid, done, the marks gone.
    const [money, xp, level] = [hero.money, hero.xp, hero.level];
    const handIn = story.talk(barmaid)!;
    expect(handIn.quest?.state).toBe('handIn');
    handIn.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('done');
    expect(hero.money).toBe(money + quest.copper);
    expect(hero.level > level || hero.xp > xp).toBe(true);
    expect(story.markOf(barmaid)).toBeNull();
    expect(story.markOf(carter)).toBeNull();
    expect(story.taken).toEqual([]);
    expect(story.done.map((q) => q.id)).toEqual([quest.id]);
    expect(story.talk(barmaid)).toBeNull(); // (her own trade again)
    expect(story.handIn(quest.id)).toBe(false); // (never paid twice)
    expect(hero.money).toBe(money + quest.copper);
  });

  it('abandoned, are on offer again from whoever gave them', () => {
    const model = fresh();
    const { story } = model;
    const { carter, barmaid } = story.people!;
    expect(story.abandon(quest.id)).toBe(false); // (not taken: nothing to let go)
    story.accept(quest.id);
    expect(story.abandon(quest.id)).toBe(true);
    expect(story.stateOf(quest.id)).toBe('offered');
    expect(story.markOf(carter)).toBe('offer');
    expect(story.markOf(barmaid)).toBeNull();
    expect(story.taken).toEqual([]);
    expect(story.talk(carter)!.quest?.state).toBe('offered'); // (his offer, as at first)
    story.talk(carter)!.answers[0].pick();
    expect(story.stateOf(quest.id)).toBe('taken');
    story.handIn(quest.id);
    expect(story.abandon(quest.id)).toBe(false); // (done: not undone)
  });

  it('abandoned, leave the tracker: no card left for them', () => {
    const model = fresh();
    const update = createQuestTracker(model);
    const toScreen = (x: number, _y: number, z: number) => ({ x, y: z });
    const cards = () => Array.from(document.querySelectorAll('.quest-tracker')).at(-1)!.querySelectorAll('.quest-card').length;
    update(toScreen);
    expect(cards()).toBe(0);
    model.story.accept(quest.id);
    update(toScreen);
    expect(cards()).toBe(1);
    model.story.setTracked(quest.id, false); // (untracked: off the screen, still taken)
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

  it('are saved as they stand', () => {
    const model = fresh();
    model.story.accept(quest.id);
    const again = fresh();
    restore(again, snapshot(model));
    expect(again.story.stateOf(quest.id)).toBe('taken');
    expect(again.story.isTracked(quest.id)).toBe(true);
    model.story.setTracked(quest.id, false);
    const third = fresh();
    restore(third, snapshot(model));
    expect([third.story.stateOf(quest.id), third.story.isTracked(quest.id)]).toEqual(['taken', false]); // (untracked, kept so)
    expect(again.story.markOf(again.story.people!.barmaid)).toBe('ready');
  });

  it('are told as a visual novel: both figures, the speaker lit, a line at a time, then the quest and the answers', () => {
    const model = fresh();
    const paused: boolean[] = [];
    const panel = createTalkPanel(model, { setPaused: (p) => paused.push(p) });
    const { carter, barmaid } = model.story.people!;
    const scene = document.querySelector('.talk-scene') as HTMLElement;
    const q = (selector: string) => scene.querySelector(selector) as HTMLElement;
    const key = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    expect(panel.open(barmaid)).toBe(false); // (nothing to say of it: no scene)
    expect(scene.hidden).toBe(true);
    expect(panel.open(carter)).toBe(true);
    expect(scene.hidden).toBe(false);
    expect(scene.querySelectorAll('.talk-figure').length).toBe(2); // (the hero's side, and his)
    expect(q('.talk-plate').textContent).toBe(carter.name);
    expect(q('.talk-figure.right').classList.contains('speaking')).toBe(true);
    expect(q('.talk-figure.left').classList.contains('speaking')).toBe(false);
    // His three lines: each written out at a press, the next at the next; the quest's card with the last.
    for (let i = 0; i < 3; i++) {
      key('Space'); // (the line, whole)
      expect(q('.talk-words').textContent).toBe(quest.offer({ village: villageName(model.story.people!.village, model.seed), barmaid: barmaid.name, carter: carter.name })[i]);
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
    for (let i = 0; i < 5; i++) key('Enter');
    expect(q('.talk-quest-mark').textContent).toBe('?');
    (scene.querySelector('.talk-answer') as HTMLButtonElement).click();
    expect(model.story.stateOf(quest.id)).toBe('done');
    expect(panel.menu.isOpen).toBe(false);
  });
});
