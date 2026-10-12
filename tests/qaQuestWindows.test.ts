// @vitest-environment happy-dom
// QA: the quest windows, clicked through as a player would. The notice board (controller/quests/questBoardPanel.ts):
// its notices in sections (ready to hand in, in progress, available, completed), the pins of those taken from it, the
// purse; a notice taken (its section, its pin, said so); refused, and why, past the board's three or the ten in all;
// handed in only once done (the reward paid, done for good: faded, completed); abandoned; the game paused while it's
// read. The journal (journal.ts): none taken, said what to do; those taken, the ones ready first; tracked on screen
// or not (no more than three, said why); abandoned only at a second click; kept up with as a quest moves along.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { MAX_ACTIVE, MAX_PER_BOARD, MAX_TRACKED } from '../src/model/quests/quests';
import { TEST_MAP_SIZE } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createQuestBoardPanel } = await import('../src/controller/quests/questBoardPanel');
const { createJournal } = await import('../src/controller/quests/journal');

// The newest window of a kind's parts (each window made stays in the document).
const last = (title: string) => Array.from(document.querySelectorAll<HTMLElement>('.menu')).filter((m) => m.getAttribute('aria-label') === title).at(-1)!;
const within = (title: string, selector: string) => Array.from(last(title).querySelectorAll<HTMLElement>(selector));
const sections = (title: string) => within(title, '.menu-section').map((s) => s.textContent);

function atTheBoard() {
  const model = new GameModel(1, TEST_MAP_SIZE);
  const board = model.boardOf(model.villages[0]);
  let paused = false;
  const panel = createQuestBoardPanel(model, { setPaused: (p) => (paused = p) });
  panel.open(board);
  return { model, board, panel, isPaused: () => paused };
}
const killQuest = (model: GameModel, board: number) => model.quests.offersAt(board).find((q) => q.kind === 'kill')!;

describe('the notice board', () => {
  it('lists its notices, all available to begin with; no pins lit; the purse under; the game paused while read', () => {
    const { model, board, panel, isPaused } = atTheBoard();
    const offers = model.quests.offersAt(board);
    expect(sections('Notice board')).toEqual([`Available · ${offers.length}`]);
    expect(within('Notice board', '.quest-pins i')).toHaveLength(MAX_PER_BOARD);
    expect(within('Notice board', '.quest-pins i.on')).toHaveLength(0);
    expect(within('Notice board', '.quest-taken')[0].textContent).toBe(`0/${MAX_PER_BOARD} here · 0/${MAX_ACTIVE} in all`);
    expect(within('Notice board', '.menu-purse')).toHaveLength(1);
    expect(isPaused()).toBe(true);
    panel.menu.close();
    expect(isPaused()).toBe(false);
  });

  it('takes a notice on: said so, in progress, its pin lit; the button now hands it in (only once done, then paid)', () => {
    const { model, board, panel } = atTheBoard();
    const quest = killQuest(model, board);
    within('Notice board', `.menu-slot[data-key="${quest.key}"]`)[0].click();
    within('Notice board', '.menu-detail-button')[0].click(); // (Accept)
    expect(model.quests.takenOf(quest.key)).toBeDefined();
    expect(within('Notice board', '.menu-detail-said')[0].textContent).toBe('Taken. Look for the gold marks.');
    expect(sections('Notice board')[0]).toBe('In progress · 1');
    expect(within('Notice board', '.quest-pins i.on')).toHaveLength(1);
    const handIn = within('Notice board', '.menu-detail-button')[0];
    expect([handIn.textContent, handIn.classList.contains('unavailable')]).toEqual(['Hand in', true]);
    const money = model.hero.money;
    handIn.click(); // (not done: nothing)
    expect(model.quests.isCompleted(quest.key)).toBe(false);
    model.quests.takenOf(quest.key)!.kills = quest.count; // (the foes slain)
    panel.menu.refresh();
    expect(sections('Notice board')[0]).toBe('Ready to hand in · 1');
    within('Notice board', '.menu-detail-button')[0].click();
    expect(model.quests.isCompleted(quest.key)).toBe(true);
    expect(model.hero.money).toBeGreaterThan(money);
    expect(sections('Notice board')).toContain('Completed · 1');
    expect(within('Notice board', '.menu-slot.dim')).toHaveLength(1); // (done for good: faded)
    panel.menu.close();
  });

  it(`refuses a fourth from one board, saying why; abandons one, the notice staying up`, () => {
    const { model, board, panel } = atTheBoard();
    const offers = model.quests.offersAt(board);
    for (const q of offers.slice(0, MAX_PER_BOARD)) model.quests.accept(q);
    panel.menu.refresh();
    const next = offers[MAX_PER_BOARD];
    within('Notice board', `.menu-slot[data-key="${next.key}"]`)[0].click();
    const accept = within('Notice board', '.menu-detail-button')[0];
    expect(accept.classList.contains('unavailable')).toBe(true);
    expect(within('Notice board', '.menu-detail-said')[0].textContent).toBe(`You've taken ${MAX_PER_BOARD} quests from this board already.`);
    accept.click();
    expect(model.quests.takenAt(board)).toBe(MAX_PER_BOARD);
    // One taken, abandoned.
    within('Notice board', `.menu-slot[data-key="${offers[0].key}"]`)[0].click();
    within('Notice board', '.quest-abandon')[0].click();
    expect(model.quests.takenAt(board)).toBe(MAX_PER_BOARD - 1);
    expect(within('Notice board', '.menu-detail-said')[0].textContent).toBe('Abandoned. The notice stays up.');
    expect(within('Notice board', '.menu-slot')).toHaveLength(offers.length);
    panel.menu.close();
  });
});

describe('the journal', () => {
  it('gives every kind of quest the same two buttons, and the same tracking: off the screen untracked, one limit between them', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const journal = createJournal(model);
    const board = model.boardOf(model.villages[0]);
    const offers = model.quests.offersAt(board);
    model.story.accept('wordToTheInn');
    model.quests.accept(offers[0]);
    journal.menu.open();
    const rows = () => within('Journal', '.menu-row, .menu-slot');
    const buttonsOf = () => within('Journal', '.quest-buttons button').map((b) => [b.className, b.textContent]);
    // The one someone gave (first in the list), then the board's: the same pair, the same words.
    const given = buttonsOf();
    expect(given).toEqual([['menu-detail-button', 'Untrack'], ['quest-abandon', 'Abandon']]);
    rows()[1].click();
    expect(buttonsOf()).toEqual(given);
    rows()[0].click();
    // Untracked: still taken, off the tracker's count; tracked again.
    within('Journal', '.quest-buttons .menu-detail-button')[0].click();
    expect(model.story.isTracked('wordToTheInn')).toBe(false);
    expect(model.story.stateOf('wordToTheInn')).toBe('taken');
    expect(model.story.taken[0].tracked).toBe(false);
    expect(within('Journal', '.quest-buttons .menu-detail-button')[0].textContent).toBe('Track');
    // The screen's limit is one between them: the boards' filling it, the one someone gave is refused, and told why.
    for (const q of offers.slice(1, MAX_TRACKED)) model.quests.accept(q);
    expect(model.quests.tracked).toBe(MAX_TRACKED);
    expect(model.quests.trackRoom).toBe(false);
    journal.menu.refresh();
    within('Journal', '.quest-buttons .menu-detail-button')[0].click();
    expect(model.story.isTracked('wordToTheInn')).toBe(false);
    expect(last('Journal').textContent).toContain(`You can track ${MAX_TRACKED} quests at once`);
    model.quests.setTracked(offers[0].key, false);
    expect(model.story.setTracked('wordToTheInn', true)).toBe(true);
    expect(model.quests.trackRoom).toBe(false); // (its place taken: the board's own can't be tracked again)
    expect(model.quests.setTracked(offers[0].key, true)).toBe(false);
    journal.menu.close();
  });

  it('lists a quest someone gave with the boards\' in its one list; abandoned there (asked twice), it is gone and on offer again', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const journal = createJournal(model);
    model.story.accept('wordToTheInn');
    journal.menu.open();
    expect(within('Journal', '.menu-tab').length).toBeLessThan(2); // (one list: no second page)
    expect(sections('Journal')[0]).toContain('From people · 1');
    expect(last('Journal').textContent).toContain('Word to the inn');
    const abandon = () => within('Journal', '.quest-abandon')[0];
    expect(abandon().textContent).toBe('Abandon');
    abandon().click();
    expect(abandon().textContent).toBe('Sure?');
    expect(model.story.stateOf('wordToTheInn')).toBe('taken'); // (asked first)
    abandon().click();
    expect(model.story.stateOf('wordToTheInn')).toBe('offered');
    expect(last('Journal').textContent).not.toContain('Word to the inn');
    expect(model.story.markOf(model.story.people!.carter)).toBe('offer');
    journal.menu.close();
  });

  it('says what to do with none taken; lists those taken, ready to hand in first', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const journal = createJournal(model);
    journal.menu.open();
    expect(within('Journal', '.menu-detail-hint')[0]?.textContent).toContain('Read the notice board in a village');
    const board = model.boardOf(model.villages[0]);
    const [a, b] = model.quests.offersAt(board).filter((q) => q.kind === 'kill');
    model.quests.accept(a);
    model.quests.accept(b);
    model.quests.takenOf(b.key)!.kills = b.count;
    journal.menu.refresh();
    expect(sections('Journal')).toEqual(['Ready to hand in · 1', 'In progress · 1']);
    journal.menu.close();
  });

  it(`tracks a quest on screen or not, no more than ${MAX_TRACKED}, saying why; abandons only at a second click`, () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const boards = model.villages.map((v) => model.boardOf(v));
    const offers = boards.flatMap((b) => model.quests.offersAt(b).slice(0, 2)).slice(0, MAX_TRACKED + 1);
    for (const q of offers) model.quests.accept(q);
    expect(model.quests.tracked).toBe(MAX_TRACKED); // (taken: tracked while there's room)
    const journal = createJournal(model);
    journal.menu.open();
    const untracked = model.quests.taken.find((t) => !t.tracked)!;
    within('Journal', `.menu-slot[data-key="${untracked.quest.key}"]`)[0].click();
    const track = within('Journal', '.menu-detail-button')[0];
    expect(track.classList.contains('unavailable')).toBe(true);
    track.click();
    expect(untracked.tracked).toBe(false);
    expect(within('Journal', '.menu-detail-said')[0].textContent).toBe(`You can track ${MAX_TRACKED} quests at once. Untrack one first.`);
    const before = model.quests.taken.length;
    within('Journal', '.quest-abandon')[0].click();
    expect(within('Journal', '.quest-abandon')[0].textContent).toBe('Sure?');
    expect(model.quests.taken.length).toBe(before); // (not yet)
    within('Journal', '.quest-abandon')[0].click();
    expect(model.quests.taken.length).toBe(before - 1);
    journal.menu.close();
  });

  it('keeps up while open: a quest moving along, redrawn', () => {
    const model = new GameModel(1, TEST_MAP_SIZE);
    const quest = killQuest(model, model.boardOf(model.villages[0]));
    model.quests.accept(quest);
    const journal = createJournal(model);
    journal.menu.open();
    journal.update();
    expect(within('Journal', '.menu-slot')[0].textContent).toContain(`0/${quest.count}`);
    model.quests.takenOf(quest.key)!.kills = 1;
    journal.update();
    expect(within('Journal', '.menu-slot')[0].textContent).toContain(`1/${quest.count}`);
    journal.menu.close();
  });
});
