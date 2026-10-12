// A cheat for the quests people give (model/story/story.ts `debug`, switched on in the cheat menu's World tab). With
// it on, Q beside someone (the carter, a keeper, a villager, a traveller) opens a list of every quest of their
// calling: those set with them in this world first, then those their village didn't draw. One picked, "Replay" puts
// it back on offer from them, whatever it follows and however it stood, and opens its talk at its first line. (Q,
// away from everyone, is still the guard.) The journal, meanwhile, has a "Finish" under each quest (journal.ts,
// story/storyJournal.ts). Dev builds only: loaded with the cheat menu.
import type { GameModel } from '../../model/GameModel';
import type { DebugQuest, Who } from '../../model/story/story';
import { nearest } from '../../model/story/storyCast';
import { line } from '../../view/ui/dom';
import { anyMenuOpen, createMenu, type MenuSlot } from '../../view/ui/menu';
import { storyIcon } from '../story/storyJournal';

const REACH = 2.6; // tiles: whoever's this near, the nearest
const KIND: Record<DebugQuest['scope'], string> = { first: 'Main line', village: 'Most villages', road: 'On the road' };

// Whoever the hero stands beside: of those where they are (indoors: that building's; outdoors: the carter, the
// villagers about, those on the road), the nearest.
export function besideWhom(model: GameModel): Who | null {
  const { hero, inside } = model;
  const where = inside?.entrance ?? null;
  const about: Who[] = [...model.folk.filter((n) => n.where === where), ...(inside ? [] : [...model.travellers.list, ...(model.story.people ? [model.story.people.carter] : [])])];
  return nearest(about, (who) => who, hero, REACH);
}

export function createQuestDebug(model: GameModel, talk: (who: Who, quest: string) => void): void {
  const { story } = model;
  let who: Who | null = null;
  const shown = new WeakMap<MenuSlot, DebugQuest>();

  const slotOf = (q: DebugQuest): MenuSlot => {
    const slot: MenuSlot = { key: q.id, icon: storyIcon, title: q.name, note: q.rare ? 'Few villages' : KIND[q.scope], badge: q.lacks ?? q.state, badgeTone: q.lacks ? 'past' : q.state === 'done' ? 'past' : q.state === 'taken' ? 'ready' : 'progress', dim: !!q.lacks };
    shown.set(slot, q);
    return slot;
  };

  const menu = createMenu({
    title: 'Quests',
    keyHints: false,
    tabs: [
      {
        name: 'Quests',
        header: () => line('quest-debug-head', 'Pick a quest, then Replay: it goes back on offer, and its talk opens.'),
        slots: () => {
          const all = who ? story.questsOf(who) : [];
          const [theirs, others] = [all.filter((q) => q.set), all.filter((q) => !q.set)];
          const sections = [...(theirs.length ? [{ title: `Theirs here · ${theirs.length}`, from: 0 }] : []), ...(others.length ? [{ title: `Not set here · ${others.length}`, from: theirs.length }] : [])];
          return { cells: [...theirs, ...others].map(slotOf), columns: 1, rows: true, sections };
        },
        detail: (slot) => {
          const pane = document.createElement('div');
          const q = slot && shown.get(slot);
          if (!q || !who) return pane.append(line('menu-detail-hint', who ? `${who.name} has no quests to give.` : 'No one near.')), pane;
          const asker = who;
          pane.append(
            line('menu-detail-name', q.name),
            line('menu-detail-about', `${q.rare ? 'Few villages' : KIND[q.scope]} · ${q.set ? 'set here' : 'not set here'} · ${q.state}`),
            line('menu-detail-said', q.lacks ? `Can't be played here: ${q.lacks}.` : ''),
          );
          if (!q.lacks) {
            const replay = document.createElement('button');
            replay.className = 'menu-detail-button';
            replay.textContent = 'Replay';
            replay.addEventListener('click', () => {
              const key = story.replay(q.id, asker);
              menu.close();
              if (key) talk(asker, key);
            });
            pane.append(replay);
          }
          return pane;
        },
      },
    ],
  });

  // Q, beside someone, with the cheat on (before the game's own keys: no guard raised for it).
  window.addEventListener(
    'keydown',
    (event) => {
      if (!story.debug || event.code !== 'KeyQ' || event.repeat || anyMenuOpen()) return;
      const near = besideWhom(model);
      if (!near) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      who = near;
      menu.setTitle(`Quests · ${near.name}`);
      menu.open();
    },
    true,
  );
}
