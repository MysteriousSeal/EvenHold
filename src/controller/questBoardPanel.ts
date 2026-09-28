// Reading a village's notice board (E by it): its five notices in a grid
// on the left, the one chosen on the right (what's asked, where, how
// dangerous, the reward) with the button to take it on, or to hand it in
// once done; the quests taken counted over it all, the hero's purse under.
// A window in the middle of the screen; the game waits while it's open.

import type { GameModel } from '../model/GameModel';
import { makeEnemy } from '../model/enemies/enemies';
import { hashUnit } from '../util/random';
import { MAX_ACTIVE, questProgress, questTitle, type Quest } from '../model/quests/quests';
import { noticeBoards } from '../model/quests/noticeBoards';
import { coinParts } from '../view/ui/coins';
import { lootIcon } from '../view/ui/itemIcons';
import { createMenu, type Menu, type MenuIcon, type MenuSlot } from '../view/ui/menu';
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../view/meshes/enemy/wolfVoxels';
import { difficulty } from '../view/hud/targetHud';

// What each notice says, by what it asks (one of three, the same for a given notice).
const NOTICES = {
  'kill:wolf': [
    'The wolves took three sheep this week. Thin the pack before they come for the lambs.',
    'Howling by the old fence every night. Nobody in the village has slept in days.',
    'A pack has been circling the woodcutters. Drive them off for good.',
  ],
  'kill:bandit': [
    "Bandits robbed the miller's cart on the road. Make them pay for it.",
    'Cutthroats are camped too close for comfort. Clear them out.',
    "They took the tax chest, and the tax collector's boots. Deal with them.",
  ],
  'collect:wolf': [
    'The tanner wants pelts before the frost. Good ones, mind, not moth-eaten.',
    "Winter's coming and the children need warm cloaks. Bring wolf pelts.",
    "Pelts from the pack that's been at the flock. The shepherd will sleep better.",
  ],
  'collect:bandit': [
    'Every one of those bandits wears a tin token. Bring them back as proof.',
    'The reeve pays for tokens taken off bandits, no questions asked.',
    "Proof or it didn't happen: bring back their tokens.",
  ],
} as const;
const notice = (q: Quest) => {
  const lines = NOTICES[`${q.kind}:${q.foe}`];
  return lines[Math.floor(hashUnit(q.board, Number(q.key.split(':')[1]), 97) * lines.length)];
};
const DANGER = { trivial: 'Easy', even: 'Fair', tough: 'Tough', hard: 'Hard', deadly: 'Deadly' } as Record<string, string>;

// A quest's picture: the foe's head to slay, or the thing to bring.
const questIcon = (q: Quest): MenuIcon => (size) => {
  if (q.item) return lootIcon(q.item)(size);
  if (q.foe === 'wolf') return voxelIcon('quest:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), size);
  const { human } = makeEnemy(0, 'bandit', q.x, q.z);
  return voxelIcon(`quest:bandit:${q.x}:${q.z}`, () => humanBust(human!.look, human!.equipment, 'right'), size);
};

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
      icon: questIcon(q),
      title: questTitle(q),
      badge: taken ? (have >= q.count ? '✓ Done' : `${have}/${q.count}`) : undefined,
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
    const icon = document.createElement('div');
    icon.className = 'menu-detail-icon';
    icon.append(questIcon(q)(72));
    const facts = document.createElement('dl');
    facts.className = 'menu-detail-facts quest-facts';
    const fact = (label: string, value: Array<string | HTMLElement>) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.append(...value);
      facts.append(dt, dd);
    };
    const spot = noticeBoards(model)[q.board];
    fact('Where', [`${Math.round(Math.hypot(q.x - spot.x, q.z - spot.z))} paces ${q.where.replace(/ of the village$/, '')}`]);
    const danger = document.createElement('span');
    danger.className = 'quest-danger';
    danger.dataset.difficulty = difficulty(q.level, model.hero.level);
    danger.textContent = `${DANGER[danger.dataset.difficulty]} · level ${q.level}`;
    fact('Danger', [danger]);
    fact('Reward', coinParts(q.copper));
    fact('Experience', [`${q.xp} XP`]);
    if (taken) fact('Progress', [done ? 'Done' : questProgress(q, have).text]);
    pane.append(icon, line('menu-detail-name', questTitle(q)), line('menu-detail-about', `“${notice(q)}”`), facts);

    const why = taken ? (done ? '' : `Not done yet: ${questProgress(q, have).text}.`) : quests.full ? `You've taken ${MAX_ACTIVE} quests already.` : '';
    const buttons = document.createElement('div');
    buttons.className = 'quest-buttons';
    const main = document.createElement('button');
    main.className = 'menu-detail-button';
    main.textContent = taken ? 'Hand in' : 'Accept';
    main.classList.toggle('unavailable', !!why); // still clickable: it says why not
    main.addEventListener('click', () => {
      said = why || (taken ? (quests.handIn(q.key), 'Reward paid. A new notice goes up.') : (quests.accept(q), 'Taken. Look for the gold marks.'));
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

  // How many quests are taken, as pins: gold for each, empty for the rest.
  const header = () => {
    const row = document.createElement('div');
    row.className = 'quest-board-head';
    const pins = document.createElement('span');
    pins.className = 'quest-pins';
    for (let i = 0; i < MAX_ACTIVE; i++) {
      const pin = document.createElement('i');
      pin.classList.toggle('on', i < quests.taken.length);
      pins.append(pin);
    }
    row.append(line('quest-board-lead', 'Notices from the villagers. Take one on, then come back here once it is done.'), pins, line('quest-taken', `${quests.taken.length}/${MAX_ACTIVE} taken`));
    return row;
  };

  const menu = createMenu({
    title: 'Notice board',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Notices',
        slots: () => {
          return { cells: quests.offersAt(board).map(slotOf), columns: 1, rows: true };
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

function line(className: string, text: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}
