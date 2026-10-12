// The quests people gave (model/story/story.ts), in the journal's list with the boards' (quests/journal.ts): those
// under way first of all (what's to do, who to), those done last; one under way with a button to abandon it (asked
// twice: then it's on offer again from whoever gave it).
import '../quests/questPanels.css';
import type { GameModel } from '../../model/GameModel';
import type { StoryQuestId } from '../../model/story/storyQuests';
import { line } from '../../view/ui/dom';
import type { MenuSlot } from '../../view/ui/menu';
import { journalButtons } from '../quests/journalButtons';
import type { MenuIcon } from '../../view/ui/menu';

// A gold roundel with a "!" in it: a quest someone gave.
const offerIcon: MenuIcon = (size) => {
  const canvas = document.createElement('canvas');
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = canvas.height = Math.round(size * ratio);
  canvas.style.width = canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const s = canvas.width;
  ctx.fillStyle = '#ffc94a';
  ctx.strokeStyle = '#2e1f14';
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2e1f14';
  ctx.font = `700 ${s * 0.56}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', s / 2, s * 0.53);
  return canvas;
};

// What the journal's list shows of them (`redraw`: the journal drawn again; `full`: what's said when the screen takes
// no more tracked): their rows (those under way, each with its tick box to track it, as the boards' have; then those
// done), and the detail of one of them chosen (null: not one of theirs), with the journal's own two buttons.
export function storyJournal(model: GameModel, redraw: () => void, full: string): { taken(): MenuSlot[]; done(): MenuSlot[]; detail(slot: MenuSlot | null): HTMLElement | null } {
  const { story } = model;
  const about = new WeakMap<MenuSlot, { name: string; text: string; said: string; id?: StoryQuestId }>();
  let armed: StoryQuestId | null = null; // the one asked about, once: a second click lets it go
  let refused: StoryQuestId | null = null; // the one whose tracking was refused (the screen full): told why
  const room = () => model.quests.trackRoom;
  const toggle = (id: StoryQuestId) => void (refused = story.setTracked(id, !story.isTracked(id)) ? null : id);
  return {
    taken: () =>
      story.taken.map((q) => {
        const slot: MenuSlot = {
          key: q.id,
          icon: offerIcon,
          title: q.name,
          note: `Speak to ${q.to.name}`,
          badge: q.ready ? '? Ready' : '?',
          badgeTone: q.ready ? 'ready' : 'progress',
          check: { on: q.tracked, locked: !q.tracked && !room(), label: q.tracked ? 'Tracked on screen: click to untrack' : !room() ? full : 'Click to track on screen', toggle: () => toggle(q.id) },
        };
        about.set(slot, { name: q.name, text: q.task, said: `Speak to ${q.to.name} to finish it. Abandoned, ${q.from.name} will offer it again.`, id: q.id });
        return slot;
      }),
    done: () =>
      story.done.map((q) => {
        const slot: MenuSlot = { key: q.id, icon: offerIcon, title: q.name, note: 'Done', badge: '✓', badgeTone: 'past', dim: true };
        about.set(slot, { name: q.name, text: 'Done, and paid for.', said: '' });
        return slot;
      }),
    detail: (slot) => {
      const told = slot && about.get(slot);
      if (!told) return null;
      const pane = document.createElement('div');
      const id = told.id;
      if (armed && armed !== id) armed = null;
      if (refused && refused !== id) refused = null;
      pane.append(line('menu-detail-name', told.name), line('menu-detail-about', told.text), line('menu-detail-said', id && refused === id ? full : told.said));
      if (id) {
        pane.append(
          journalButtons({
            tracked: story.isTracked(id),
            full: !room(),
            armed: armed === id,
            onTrack: () => [toggle(id), redraw()],
            onAbandon: () => {
              if (armed === id) [story.abandon(id), (armed = null)];
              else armed = id;
              redraw();
            },
          }),
        );
      }
      return pane;
    },
  };
}
