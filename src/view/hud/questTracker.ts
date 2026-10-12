// The quests taken and tracked (journal.ts), on the left under the hero's
// frame (styles in hud.css): a card each, with what it asks, a bar of how
// far along it is, and where to go: an arrow turned toward it on screen
// (the nearest marked foe, else the spot they gather; once done, back to
// its board) and how far off, in meters. Over them, the quests people gave (story/story.ts): who to speak to, and the way. Indoors, the arrow points the way
// out (the room's door; upstairs, the stairs down), and says so.

import type { GameModel } from '../../model/GameModel';
import { boardSpot } from '../../model/quests/noticeBoards';
import type { Inside } from '../../model/interiors/indoors';
import { stairsOf } from '../../model/interiors/upstairs';
import { inMeters, questTitle } from '../../model/quests/quests';
import type { TakenQuest } from '../../model/quests/questBook';
import type { ToScreen } from './floatingText';


const HERE = 2.5; // tiles: close enough that the arrow gives way to "here"

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

// Indoors, where the way out is: the room's door, or upstairs the stairs down.
function wayOut(inside: Inside): { x: number; z: number } {
  const stairs = inside.below ? stairsOf(inside) : undefined;
  return stairs ? { x: stairs.x, z: stairs.z } : { x: inside.room.door, z: inside.room.depth - 0.5 };
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
    if (done) return boardSpot(model, taken.quest.board) ?? taken.quest; // (its board's; not known yet this game: where the work was)
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

  // A card drawn: its title, its bar (`share` of it full) and count, the arrow and distance to `to` (indoors: the way
  // out, unless what it's after is in this very room: `here`), and whether it's done.
  const show = (c: Card, title: string, share: number, count: string, to: { x: number; z: number }, done: boolean, toScreen: ToScreen, inRoom = false) => {
    const { hero, inside } = model;
    const at = inside && !inRoom ? wayOut(inside) : to; // indoors: the way out
    const tiles = Math.hypot(at.x - hero.x, at.z - hero.z);
    const here = (!inside || inRoom) && tiles <= HERE;
    const distance = inside && !inRoom ? 'exit' : here ? 'here' : inRoom ? 'in here' : inMeters(tiles);
    const text = `${title}|${count}|${distance}|${done}`;
    if (text !== c.shown) {
      c.shown = text;
      c.title.textContent = title;
      c.fill.style.width = `${share * 100}%`;
      c.count.textContent = count;
      c.distance.textContent = distance;
      c.root.classList.toggle('done', done);
    }
    c.arrow.hidden = here;
    if (!here) {
      const a = toScreen(at.x, hero.y, at.z);
      const b = toScreen(hero.x, hero.y, hero.z);
      c.arrow.style.transform = `rotate(${Math.atan2(a.x - b.x, b.y - a.y)}rad)`;
    }
  };

  return (toScreen) => {
    const taken = model.quests.taken.filter((t) => t.tracked); // those the journal hasn't hidden
    const told = model.story.taken.filter((q) => q.tracked); // the quests people gave, under way and tracked: first
    root.hidden = taken.length === 0 && told.length === 0;
    for (const [key, c] of cards) {
      if (taken.some((t) => t.quest.key === key) || told.some((q) => q.id === key)) continue;
      c.root.remove();
      cards.delete(key);
    }
    const cardAt = (key: string, i: number): Card => {
      let c = cards.get(key);
      if (!c) {
        c = card();
        cards.set(key, c);
      }
      if (root.children[i] !== c.root) root.insertBefore(c.root, root.children[i] ?? null); // in order (moved only when out of place)
      return c;
    };
    for (const [i, q] of told.entries()) {
      // Whoever it's handed in to: outdoors, their building's door; in that building, themselves.
      const inRoom = !!q.door && model.inside?.entrance === q.door;
      show(cardAt(q.id, i), q.name, q.ready ? 1 : 0, `Speak to ${q.to.name}`, inRoom || !q.door ? q.to : q.door, false, toScreen, inRoom);
    }
    for (const [i, t] of taken.entries()) {
      const have = model.quests.progress(t);
      const done = have >= t.quest.count;
      show(cardAt(t.quest.key, told.length + i), questTitle(t.quest), have / t.quest.count, done ? 'Done' : `${have}/${t.quest.count}`, goal(t, done), done, toScreen);
    }
  };
}
