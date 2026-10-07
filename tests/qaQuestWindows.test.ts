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
