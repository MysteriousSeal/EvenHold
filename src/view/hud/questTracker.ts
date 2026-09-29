// The quests taken and tracked (journal.ts), on the left under the hero's
// frame (styles in hud.css): a card each, with what it asks, a bar of how
// far along it is, and where to go: an arrow turned toward it on screen
// (the nearest marked foe, else the spot they gather; once done, back to
// its board) and how many paces off. Indoors, where the
// world's out of sight, only the words.

import type { GameModel } from '../../model/GameModel';
import { noticeBoards } from '../../model/quests/noticeBoards';
import { questTitle } from '../../model/quests/quests';
import type { TakenQuest } from '../../model/quests/questBook';

type ToScreen = (x: number, y: number, z: number) => { x: number; y: number };

const HERE = 2.5; // paces: close enough that the arrow gives way to "here"

// The arrow, pointing up (turned to face the way): a notched arrowhead,
// gold, its left facet lit and its right one shaded, in a thick ink
// outline; drawn smooth on a canvas (crisp at any angle and screen density).
const ARROW_SIZE = 28;
function arrowCanvas(): HTMLCanvasElement {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(ARROW_SIZE * ratio);
  canvas.style.width = canvas.style.height = `${ARROW_SIZE}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const s = canvas.width;
  const [tip, left, notch, right] = [[0.5, 0.1], [0.16, 0.86], [0.5, 0.68], [0.84, 0.86]].map(([x, y]) => [x * s, y * s] as const);
  const shape = (points: ReadonlyArray<readonly [number, number]>) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.13;
  ctx.strokeStyle = '#2e1f14';
  shape([tip, left, notch, right]);
  ctx.stroke(); // the outline, under the faces
  ctx.fillStyle = '#ffe08a';
  shape([tip, left, notch]);
  ctx.fill(); // the lit facet
  ctx.fillStyle = '#e8a030';
  shape([tip, notch, right]);
  ctx.fill(); // the shaded one
  return canvas;
}

interface Card {
  root: HTMLElement;
  arrow: HTMLElement;
  title: HTMLElement;
  fill: HTMLElement;
  count: HTMLElement;
  distance: HTMLElement;
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
      '<div class="quest-card-arrow"></div><div class="quest-card-text"><div class="quest-card-head"><div class="quest-card-title"></div><div class="quest-card-distance"></div></div><div class="quest-card-bar"><i></i><span></span></div></div>';
    const arrow = el.querySelector('.quest-card-arrow') as HTMLElement;
    arrow.append(arrowCanvas());
    const q = (s: string) => el.querySelector(s) as HTMLElement;
    return { root: el, arrow, title: q('.quest-card-title'), fill: q('.quest-card-bar i'), count: q('.quest-card-bar span'), distance: q('.quest-card-distance'), shown: '' };
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
      const distance = outdoors ? (here ? 'here' : `${paces} paces`) : '';
      const text = `${questTitle(t.quest)}|${have}|${distance}|${done}`;
      if (text !== c.shown) {
        c.shown = text;
        c.title.textContent = questTitle(t.quest);
        c.fill.style.width = `${(have / t.quest.count) * 100}%`;
        c.count.textContent = done ? 'Done' : `${have}/${t.quest.count}`;
        c.distance.textContent = distance;
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
