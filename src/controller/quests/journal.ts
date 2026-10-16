// The quest journal (L, or its toolbar tile): the quests taken, a row each
// on the left (what's asked, where, how far along), the one chosen told of
// on the right, with the buttons to show or hide it on screen (the quest
// tracker) and to abandon it (a second click to be sure); and the places found (placesTab.ts). A side panel:
// the game goes on while it's open, and it keeps up with the hunt.

import { keyOf } from '../keyBindings';
import './questPanels.css';
import { storyJournal } from '../story/storyJournal';
import { placesTab } from './placesTab';
import { journalButtons } from './journalButtons';
import type { GameModel } from '../../model/GameModel';
import { MAX_ACTIVE, MAX_TRACKED, questProgress, questTitle } from '../../model/quests/quests';
import type { TakenQuest } from '../../model/quests/questBook';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { notice, questFacts, questIcon } from './questText';
import { detailParts } from '../../view/ui/menuDetail';
import { line } from '../../view/ui/dom';
import { capitalize } from '../../util/text';


export function createJournal(model: GameModel): { menu: Menu; update(): void } {
  const { quests } = model;
  const shown = new WeakMap<MenuSlot, TakenQuest>();
  let armed: string | null = null; // the quest whose Abandon was clicked once: a second click abandons it
  let told = ''; // why tracking was refused, until the next try or another quest is picked
  let toldFor = '';
  const NONE = "No quests taken. Read the notice board in a village to find some, or look for a gold “!” over someone's head.";
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
      key: quest.key,
      icon: questIcon(quest),
      title: questTitle(quest),
      badge: have >= quest.count ? '✓ Ready' : `${have}/${quest.count}`,
      badgeTone: have >= quest.count ? 'ready' : 'progress',
      note: capitalize(quest.where),
      check: {
        on: t.tracked,
        locked: !t.tracked && !quests.trackRoom,
        label: t.tracked ? 'Tracked on screen: click to untrack' : !quests.trackRoom ? FULL : 'Click to track on screen',
        toggle: () => toggle(t),
      },
    };
    shown.set(slot, t);
    return slot;
  };

  const detail = (slot: MenuSlot | null) => {
    const given = story.detail(slot); // (one someone gave: its own telling)
    if (given) return given;
    const pane = document.createElement('div');
    const t = slot && shown.get(slot);
    if (!t) {
      return pane; // (none taken: said in the list, where the eye goes: header)
    }
    if (armed !== t.quest.key) armed = null;
    if (toldFor !== t.quest.key) told = '';
    const { quest } = t;
    const have = quests.progress(t);
    const done = have >= quest.count;
    const { icon, facts, fact } = detailParts(questIcon(quest)(64), 'menu-detail-facts quest-facts');
    fact('Progress', [done ? 'Done' : questProgress(quest, have).text]);
    questFacts(fact, quest, model.hero.level, quests.xpFor(quest));
    pane.append(icon, line('menu-detail-name', questTitle(quest)), line('menu-detail-about', `“${notice(quest, model.seed)}”`), facts);

    const buttons = journalButtons({
      tracked: t.tracked,
      full: !quests.trackRoom,
      armed: armed === quest.key,
      onTrack: () => [toggle(t), menu.refresh()],
      onAbandon: () => {
        if (armed === quest.key) [quests.abandon(quest.key), (armed = null)];
        else armed = quest.key;
        menu.refresh();
      },
      onFinish: model.story.debug && !done ? () => [quests.finish(quest.key), menu.refresh()] : undefined,
    });
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
    row.append(line('quest-board-lead', "Hand a board's quests in at that board; someone's, to them."), pins, line('quest-taken', `${quests.taken.length}/${MAX_ACTIVE} · ${quests.tracked + model.story.trackedCount}/${MAX_TRACKED} tracked`));
    // None taken: the pins and the count make way for what to do next, large, in the middle of the list.
    if (!quests.taken.length && !story.taken().length && !story.done().length) {
      row.className = 'journal-head journal-none';
      row.replaceChildren(line('quest-board-lead', "Hand a board's quests in at that board; someone's, to them."), line('journal-empty', NONE));
    }
    return row;
  };

  const story = storyJournal(model, () => menu.refresh(), FULL); // (the quests people gave: in the list with the boards')
  const menu = createMenu({
    title: 'Journal',
    toggleKey: () => keyOf('journal'),
    keyHints: false,
    modal: false,
    place: 'left',
    tabs: [
      {
        name: 'Quests',
        // Those ready to hand in first (the next thing to do), then those under way, each under its header.
        slots: () => {
          const ready = quests.taken.filter((t) => quests.done(t));
          const going = quests.taken.filter((t) => !quests.done(t));
          // Those people gave first (under way), then the boards'; those people gave and done, last.
          const [given, over] = [story.taken(), story.done()];
          const sections = [
            ...(given.length ? [{ title: `From people · ${given.length}`, from: 0 }] : []),
            ...(ready.length ? [{ title: `Ready to hand in · ${ready.length}`, from: given.length }] : []),
            ...(going.length ? [{ title: `In progress · ${going.length}`, from: given.length + ready.length }] : []),
            ...(over.length ? [{ title: `Done · ${over.length}`, from: given.length + ready.length + going.length }] : []),
          ];
          return { cells: [...given, ...[...ready, ...going].map(slotOf), ...over], columns: 1, rows: true, sections };
        },
        detail,
        header,
      },
      placesTab(model), // (what's been found, land by land)
    ],
  });
  // Kept up with the hunt while open: redrawn when a quest moves along.
  let seen = '';
  const update = () => {
    if (!menu.isOpen) return;
    const now = quests.taken.map((t) => `${t.quest.key}:${quests.progress(t)}:${t.tracked}`).join('|') + `#${JSON.stringify(model.story.save())}#${model.story.taken.map((q) => q.have).join()}`; // (and those people gave: taken, let go, done, how far along)
    if (now === seen) return;
    seen = now;
    menu.refresh();
  };
  return { menu, update };
}

