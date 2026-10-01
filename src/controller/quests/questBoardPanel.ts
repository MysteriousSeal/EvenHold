// Reading a village's notice board (E by it): its six notices in a list
// on the left, the one chosen on the right (what's asked, where, how
// dangerous, the reward) with the button to take it on, or to hand it in
// once done; the quests taken counted over it all, the hero's purse under.
// A window in the middle of the screen; the game waits while it's open.

import './questPanels.css';
import type { GameModel } from '../../model/GameModel';
import { MAX_ACTIVE, MAX_PER_BOARD, inMeters, questProgress, questTitle, type Quest } from '../../model/quests/quests';
import { noticeBoards } from '../../model/quests/noticeBoards';
import { coinParts } from '../../view/ui/coins';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { notice, questFacts, questIcon } from './questText';
import { detailParts } from '../../view/ui/menuDetail';
import { line } from '../../view/ui/dom';
import { villageLevel } from '../../model/enemies/enemyLevels';
import { spawnOf } from '../../model/map/grid';

export function createQuestBoardPanel(model: GameModel, hooks: { setPaused(paused: boolean): void }): { open(board: number): void; menu: Menu } {
  const { quests } = model;
  const shown = new WeakMap<MenuSlot, Quest>();
  let board = 0;
  let said = ''; // the answer to the last button pressed, until another notice is picked
  let saidFor = '';

  const slotOf = (q: Quest): MenuSlot => {
    const taken = quests.takenOf(q.key);
    const have = taken ? quests.progress(taken) : 0;
    const slot: MenuSlot = {
      key: q.key,
      icon: questIcon(q),
      title: questTitle(q),
      badge: quests.isCompleted(q.key) ? 'Completed' : taken ? (have >= q.count ? '✓ Ready' : `${have}/${q.count}`) : undefined,
      badgeTone: quests.isCompleted(q.key) ? 'past' : taken ? (have >= q.count ? 'ready' : 'progress') : undefined,
      dim: quests.isCompleted(q.key), // done for good: shown, faded
      tag: coinParts(q.copper),
      note: `${q.where.replace(/^./, (c) => c.toUpperCase())} · level ${q.level}`,
    };
    shown.set(slot, q);
    return slot;
  };

  const detail = (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const q = slot && shown.get(slot);
    if (!q) {
      pane.append(line('menu-detail-hint', 'Pick a notice to read it.'));
      return pane;
    }
    if (saidFor !== q.key) said = '';
    const taken = quests.takenOf(q.key);
    const have = taken ? quests.progress(taken) : 0;
    const done = have >= q.count;
    const { icon, facts, fact } = detailParts(questIcon(q)(72), 'menu-detail-facts quest-facts');
    const spot = noticeBoards(model)[q.board];
    fact('Where', [`${inMeters(Math.hypot(q.x - spot.x, q.z - spot.z))} ${q.where.replace(/ of the village$/, '')}`]);
    questFacts(fact, q, model.hero.level, quests.xpFor(q));
    if (taken) fact('Progress', [done ? 'Done' : questProgress(q, have).text]);
    pane.append(icon, line('menu-detail-name', questTitle(q)), line('menu-detail-about', `“${notice(q, model.seed)}”`), facts);
    if (quests.isCompleted(q.key)) {
      pane.append(line('menu-detail-said quest-completed', said || 'Completed. The villagers thank you.'));
      return pane;
    }

    const why = taken ? '' : quests.full ? `You've taken ${MAX_ACTIVE} quests already.` : quests.fullAt(q.board) ? `You've taken ${MAX_PER_BOARD} quests from this board already.` : '';
    const unfinished = !!taken && !done; // its progress shows above: the button just waits
    const buttons = document.createElement('div');
    buttons.className = 'quest-buttons';
    const main = document.createElement('button');
    main.className = 'menu-detail-button';
    main.textContent = taken ? 'Hand in' : 'Accept';
    main.classList.toggle('unavailable', !!why || unfinished); // still clickable when full: it says why not
    main.addEventListener('click', () => {
      if (unfinished) return;
      said = why || (taken ? (quests.handIn(q.key), 'Reward paid. The villagers thank you.') : (quests.accept(q), 'Taken. Look for the gold marks.'));
      saidFor = q.key;
      menu.refresh();
    });
    buttons.append(main);
    if (taken) {
      const drop = document.createElement('button');
      drop.className = 'quest-abandon';
      drop.textContent = 'Abandon';
      drop.addEventListener('click', () => {
        quests.abandon(q.key);
        said = 'Abandoned. The notice stays up.';
        saidFor = q.key;
        menu.refresh();
      });
      buttons.append(drop);
    }
    pane.append(line('menu-detail-said', said || why), buttons);
    return pane;
  };

  // How many quests are taken from this board, as pins (gold for each, empty
  // for the rest), and how many in all.
  const header = () => {
    const row = document.createElement('div');
    row.className = 'quest-board-head';
    const pins = document.createElement('span');
    pins.className = 'quest-pins';
    for (let i = 0; i < MAX_PER_BOARD; i++) {
      const pin = document.createElement('i');
      pin.classList.toggle('on', i < quests.takenAt(board));
      pins.append(pin);
    }
    const left = quests.offersAt(board).filter((q) => !quests.isCompleted(q.key)).length;
    const said = left > 0 ? 'Notices from the villagers. Take one on, then come back here once it is done.' : 'Every notice here has been seen to. There is nothing more to do.';
    // The village's level: all its quests are of it (for better paid work, villages farther out).
    const level = villageLevel(spawnOf(model.size), model.villages[board]);
    const lead = `A level ${level} village (farther ones pay better). ${said}`;
    row.append(line('quest-board-lead', lead), pins, line('quest-taken', `${quests.takenAt(board)}/${MAX_PER_BOARD} here · ${quests.taken.length}/${MAX_ACTIVE} in all`));
    return row;
  };

  const menu = createMenu({
    title: 'Notice board',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Notices',
        // In sections, what to do next first: ready to hand in, under way, still to take, then those done for good.
        slots: () => {
          const state = (q: Quest) => {
            const taken = quests.takenOf(q.key);
            return quests.isCompleted(q.key) ? 3 : taken ? (quests.done(taken) ? 0 : 1) : 2;
          };
          const titles = ['Ready to hand in', 'In progress', 'Available', 'Completed'];
          const offers = quests.offersAt(board);
          const groups = titles.map((_, i) => offers.filter((q) => state(q) === i));
          const sections: Array<{ title: string; from: number }> = [];
          let from = 0;
          groups.forEach((group, i) => {
            if (group.length) sections.push({ title: `${titles[i]} · ${group.length}`, from });
            from += group.length;
          });
          return { cells: groups.flat().map(slotOf), columns: 1, rows: true, sections };
        },
        detail,
        header,
        footer: () => {
          const row = document.createElement('div');
          row.className = 'menu-purse';
          row.append(...coinParts(model.hero.money, true));
          return row;
        },
      },
    ],
  });
  return {
    menu,
    open(at) {
      board = at;
      said = '';
      menu.open();
    },
  };
}

