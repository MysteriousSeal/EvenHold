// The quest journal (L, or its toolbar tile): the quests taken, a row each
// on the left (what's asked, where, how far along), the one chosen told of
// on the right, with the buttons to show or hide it on screen (the quest
// tracker) and to abandon it (a second click to be sure). A side panel:
// the game goes on while it's open, and it keeps up with the hunt.

import './questPanels.css';
import type { GameModel } from '../model/GameModel';
import { MAX_ACTIVE, MAX_TRACKED, questProgress, questTitle } from '../model/quests/quests';
import type { TakenQuest } from '../model/quests/questBook';
import { coinParts } from '../view/ui/coins';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';
import { difficulty } from '../view/hud/targetHud';
import { DANGER, notice, questIcon } from './questText';

const cap = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

export function createJournal(model: GameModel): { menu: Menu; update(): void } {
  const { quests } = model;
  const shown = new WeakMap<MenuSlot, TakenQuest>();
  let armed: string | null = null; // the quest whose Abandon was clicked once: a second click abandons it
  let told = ''; // why tracking was refused, until the next try or another quest is picked
  let toldFor = '';
  const FULL = `You can track ${MAX_TRACKED} quests at once. Untrack one first.`;
  // Tracks a quest, or stops: refused (and told why) with three tracked already.
  const toggle = (t: TakenQuest) => {
    told = quests.setTracked(t.quest.key, !t.tracked) ? '' : FULL;
    toldFor = t.quest.key;
  };

  const slotOf = (t: TakenQuest): MenuSlot => {
    const { quest } = t;
    const have = quests.progress(t);
    const slot: MenuSlot = {
      icon: questIcon(quest),
      title: questTitle(quest),
      badge: have >= quest.count ? '✓ Done' : `${have}/${quest.count}`,
      note: cap(quest.where),
      check: {
        on: t.tracked,
        locked: !t.tracked && quests.tracked >= MAX_TRACKED,
        label: t.tracked ? 'Tracked on screen: click to untrack' : quests.tracked >= MAX_TRACKED ? FULL : 'Click to track on screen',
        toggle: () => toggle(t),
      },
    };
    shown.set(slot, t);
    return slot;
  };

  const detail = (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const t = slot && shown.get(slot);
    if (!t) {
      pane.append(line('menu-detail-hint', 'No quests taken. Read the notice board in a village to find some.'));
      return pane;
    }
    if (armed !== t.quest.key) armed = null;
    if (toldFor !== t.quest.key) told = '';
    const { quest } = t;
    const have = quests.progress(t);
    const done = have >= quest.count;
    const icon = document.createElement('div');
    icon.className = 'menu-detail-icon';
    icon.append(questIcon(quest)(64));
    const facts = document.createElement('dl');
    facts.className = 'menu-detail-facts quest-facts';
    const fact = (label: string, value: Array<string | HTMLElement>) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.append(...value);
      facts.append(dt, dd);
    };
    fact('Progress', [done ? 'Done' : questProgress(quest, have).text]);
    const danger = document.createElement('span');
    danger.className = 'quest-danger';
    danger.dataset.difficulty = difficulty(quest.level, model.hero.level);
    danger.textContent = `${DANGER[danger.dataset.difficulty]} · level ${quest.level}`;
    fact('Danger', [danger]);
    fact('Reward', coinParts(quest.copper));
    fact('Experience', [`${quests.xpFor(quest)} XP`]); // to the hero now
    pane.append(icon, line('menu-detail-name', questTitle(quest)), line('menu-detail-about', `“${notice(quest, model.seed)}”`), facts);

    const buttons = document.createElement('div');
    buttons.className = 'quest-buttons';
    const track = document.createElement('button');
    track.className = 'menu-detail-button';
    track.textContent = t.tracked ? 'Untrack' : 'Track';
    track.classList.toggle('unavailable', !t.tracked && quests.tracked >= MAX_TRACKED); // a click still says why
    track.addEventListener('click', () => {
      toggle(t);
      menu.refresh();
    });
    const drop = document.createElement('button');
    drop.className = armed === quest.key ? 'quest-abandon armed' : 'quest-abandon';
    drop.textContent = armed === quest.key ? 'Sure?' : 'Abandon';
    drop.addEventListener('click', () => {
      if (armed === quest.key) {
        quests.abandon(quest.key);
        armed = null;
      } else armed = quest.key;
      menu.refresh();
    });
    buttons.append(track, drop);
    pane.append(line('menu-detail-said', told || (done ? 'Done. Hand it in at the notice board you took it from.' : '')), buttons);
    return pane;
  };

  // The quests taken, as pins (as on the boards), and where to hand them in.
  const header = () => {
    const row = document.createElement('div');
    row.className = 'quest-board-head journal-head';
    const pins = document.createElement('span');
    pins.className = 'quest-pins';
    for (let i = 0; i < MAX_ACTIVE; i++) {
      const pin = document.createElement('i');
      pin.classList.toggle('on', i < quests.taken.length);
      pins.append(pin);
    }
    row.append(line('quest-board-lead', 'Hand quests in at the notice board they came from.'), pins, line('quest-taken', `${quests.taken.length}/${MAX_ACTIVE} · ${quests.tracked}/${MAX_TRACKED} tracked`));
    return row;
  };

  const menu = createMenu({
    title: 'Journal',
    toggleKey: 'KeyL',
    keyHints: false,
    modal: false,
    place: 'left',
    tabs: [{ name: 'Quests', slots: () => ({ cells: quests.taken.map(slotOf), columns: 1, rows: true }), detail, header }],
  });
  // Kept up with the hunt while open: redrawn when a quest moves along.
  let seen = '';
  const update = () => {
    if (!menu.isOpen) return;
    const now = quests.taken.map((t) => `${t.quest.key}:${quests.progress(t)}:${t.tracked}`).join('|');
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return { menu, update };
}

function line(className: string, text: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}
