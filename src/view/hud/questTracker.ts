// The quests taken and tracked (journal.ts), top right (styles in hud.css): a card each, with what
// it asks, a bar of how far along it is, and where to go: an arrow turned
// toward it on screen (the nearest marked foe, else the spot they gather;
// once done, back to its board) and how many paces off. Indoors, where the
// world's out of sight, only the words.

import type { GameModel } from '../../model/GameModel';
import { noticeBoards } from '../../model/quests/noticeBoards';
import { questTitle } from '../../model/quests/quests';
import type { TakenQuest } from '../../model/quests/questBook';

type ToScreen = (x: number, y: number, z: number) => { x: number; y: number };

const HERE = 2.5; // paces: close enough that the arrow gives way to "here"

// A chunky pixel arrow pointing up, gold edged in ink, drawn once.
function arrowCanvas(): HTMLCanvasElement {
  const rows = ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..', '..####..'];
  const px = 3;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = (rows.length + 2) * px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const at = (x: number, y: number) => rows[y]?.[x] === '#';
  for (let y = -1; y <= rows.length; y++) {
    for (let x = -1; x <= rows.length; x++) {
      const edge = !at(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy));
      if (!at(x, y) && !edge) continue;
      ctx.fillStyle = edge ? '#2e1f14' : y < 4 ? '#ffe08a' : '#f2b640';
      ctx.fillRect((x + 1) * px, (y + 1) * px, px, px);
    }
  }
  return canvas;
}

interface Card {
  root: HTMLElement;
  arrow: HTMLElement;
  title: HTMLElement;
  fill: HTMLElement;
  count: HTMLElement;
  hint: HTMLElement;
  shown: string; // what the text says now, to touch the page only on change
}

export function createQuestTracker(model: GameModel): (toScreen: ToScreen) => void {
  const root = document.createElement('div');
  root.className = 'quest-tracker';
  document.body.append(root);
  const cards = new Map<string, Card>();

  const card = (): Card => {
    const el = document.createElement('div');
    el.className = 'quest-card';
    el.innerHTML =
      '<div class="quest-card-arrow"></div><div class="quest-card-text"><div class="quest-card-title"></div><div class="quest-card-bar"><i></i><span></span></div><div class="quest-card-hint"></div></div>';
    const arrow = el.querySelector('.quest-card-arrow') as HTMLElement;
    arrow.append(arrowCanvas());
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    return { root: el, arrow, title: q('.quest-card-title'), fill: q('.quest-card-bar i'), count: q('.quest-card-bar span'), hint: q('.quest-card-hint'), shown: '' };
  };

  // Where the quest sends the hero now.
  const goal = (taken: TakenQuest, done: boolean): { x: number; z: number } => {
    if (done) return noticeBoards(model)[taken.quest.board];
    const { hero } = model;
    let best: { x: number; z: number } = taken.quest;
    let far = Infinity;
    for (const e of model.enemies) {
      if (e.quest !== taken.quest.key || e.state === 'dead') continue;
      const d = Math.hypot(e.x - hero.x, e.z - hero.z);
      if (d < far) [best, far] = [e, d];
    }
    return best;
  };

  return (toScreen) => {
    const taken = model.quests.taken.filter((t) => t.tracked); // those the journal hasn't hidden
    root.hidden = taken.length === 0;
    for (const [key, c] of cards) {
      if (taken.some((t) => t.quest.key === key)) continue;
      c.root.remove();
      cards.delete(key);
    }
    const { hero } = model;
    for (const t of taken) {
      let c = cards.get(t.quest.key);
      if (!c) {
        c = card();
        cards.set(t.quest.key, c);
      }
      if (c.root.parentElement !== root || root.lastElementChild !== c.root) root.append(c.root); // in the order taken
      const have = model.quests.progress(t);
      const done = have >= t.quest.count;
      const to = goal(t, done);
      const paces = Math.round(Math.hypot(to.x - hero.x, to.z - hero.z));
      const outdoors = !model.inside;
      const here = outdoors && paces <= HERE;
      const where = done ? 'Hand it in at the notice board' : t.quest.where.replace(/^./, (c) => c.toUpperCase());
      const hint = outdoors ? `${where} · ${here ? 'here' : `${paces} paces`}` : where;
      const text = `${questTitle(t.quest)}|${have}|${hint}|${done}`;
      if (text !== c.shown) {
        c.shown = text;
        c.title.textContent = questTitle(t.quest);
        c.fill.style.width = `${(have / t.quest.count) * 100}%`;
        c.count.textContent = done ? 'Done' : `${have}/${t.quest.count}`;
        c.hint.textContent = hint;
        c.root.classList.toggle('done', done);
      }
      c.arrow.hidden = !outdoors || here;
      if (outdoors && !here) {
        const a = toScreen(to.x, hero.y, to.z);
        const b = toScreen(hero.x, hero.y, hero.z);
        c.arrow.style.transform = `rotate(${Math.atan2(a.x - b.x, b.y - a.y)}rad)`;
      }
    }
  };
}
