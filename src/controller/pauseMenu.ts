// The pause menu, on Escape when no other window is open (or the toolbar):
// the game stands still behind it, dimmed. Bound like the title's panels
// (view/ui/gilded.css): on the left the hero, framed (their portrait, name,
// level, day and world); beside them "Paused" between gold rules, then
// Resume (gold), the settings in place (the zoom stepped ‹ ›, the inner
// walls switched Low | Full), the controls (controlsCodex.ts, Back to
// return), and back to the main menu (a new hero, or this one's world
// left be, there). Arrows choose, Enter acts (← → on a setting
// change it), Escape resumes (or comes back from the controls); the mouse
// works too, and a click outside resumes. The game saves itself
// (saveGame.ts). Styles in pauseMenu.css.

import type { BodyLook } from '../model/human/humanoid';
import type { Equipment } from '../model/human/equipment';
import { anyMenuOpen, trackMenu, type Menu } from '../view/ui/menu';
import { el } from '../view/ui/dom';
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';
import { stepZoom, zoomLevel } from '../view/render/zoom';
import { controlsCodex } from './controlsCodex';
import '../view/ui/gilded.css';
import './pauseMenu.css';

export interface PauseHero {
  name: string;
  level: number;
  day: number;
  seed: number;
  look: BodyLook;
  equipment: Equipment;
}

export interface PauseHooks {
  setPaused(paused: boolean): void;
  redraw(): void; // draws one frame, so a setting changed while paused shows at once
  mainMenu(): void; // saves, and back to the title
  walls: { full(): boolean; toggle(): void }; // the inner walls option (full height, or cut low)
  hero(): PauseHero; // who's playing, for the card
}

const PORTRAIT = 112; // px

export function createPauseMenu(hooks: PauseHooks): Menu {
  const backdrop = el('div', 'pause-backdrop');
  backdrop.hidden = true;
  const stage = el('div', 'pause');
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-label', 'Paused');
  backdrop.append(stage);
  document.body.append(backdrop);

  let showing: 'main' | 'controls' = 'main';
  let lit = 0; // the item chosen (keys)
  let items: Array<{ node: HTMLElement; act(): void; step?(by: 1 | -1): void }> = [];

  const button = (className: string, label: string, detail: string | null, act: () => void) => {
    const b = el('button', `pause-item ${className}`);
    b.type = 'button';
    b.append(el('b', '', label));
    if (detail) b.append(el('small', '', detail));
    b.addEventListener('click', act);
    return b;
  };

  // The hero, framed.
  const heroCard = () => {
    const hero = hooks.hero();
    const card = el('aside', 'pause-hero gilded');
    const frame = el('div', 'pause-portrait');
    frame.append(voxelIcon(`pause:${JSON.stringify([hero.look, hero.equipment])}`, () => humanBust(hero.look, hero.equipment), PORTRAIT));
    card.append(frame, el('div', 'pause-hero-name', hero.name), el('div', 'pause-crest', `Level ${hero.level}`), el('small', 'pause-hero-line', `Day ${hero.day} · World ${hero.seed}`));
    return card;
  };

  // A setting, changed in place: its name, and its value between arrows (a stepper) or two choices (a switch).
  const stepper = (name: string, value: () => string, step: (by: 1 | -1) => void, cycle: () => void) => {
    const row = el('div', 'pause-item pause-setting');
    row.tabIndex = -1;
    const arrow = (by: 1 | -1) => {
      const b = el('button', 'pause-arrow', by < 0 ? '‹' : '›');
      b.type = 'button';
      b.setAttribute('aria-label', `${by < 0 ? 'Less' : 'More'} ${name.toLowerCase()}`);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        step(by);
      });
      return b;
    };
    const control = el('span', 'pause-stepper');
    control.append(arrow(-1), el('span', 'pause-value', value()), arrow(1));
    row.append(el('b', '', name), control);
    return { node: row, act: cycle, step };
  };
  const toggle = (name: string, on: () => boolean, labels: [string, string], flip: () => void) => {
    const row = el('div', 'pause-item pause-setting');
    row.tabIndex = -1;
    const control = el('span', 'pause-switch');
    labels.forEach((label, i) => {
      const b = el('button', `pause-option${on() === (i === 1) ? ' chosen' : ''}`, label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on() === (i === 1)));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (on() !== (i === 1)) flip();
      });
      control.append(b);
    });
    row.append(el('b', '', name), control);
    return { node: row, act: flip, step: (by: 1 | -1) => on() !== (by > 0) && flip() };
  };

  const changed = () => {
    hooks.redraw();
    draw();
  };

  const draw = () => {
    const main = el('section', 'pause-main gilded');
    if (showing === 'controls') {
      const head = el('div', 'gilded-head');
      head.append(el('span', '', 'Controls'));
      const back = button('pause-back', 'Back', null, () => ((showing = 'main'), draw()));
      main.classList.add('controls');
      main.append(head, controlsCodex(), back);
      items = [{ node: back, act: () => back.click() }];
    } else {
      const title = el('h2', 'pause-title', 'Paused');
      const resume = button('pause-resume', 'Resume', null, () => api.close());
      const zoom = stepper(
        'Zoom',
        () => zoomLevel().name,
        (by) => {
          stepZoom(by); // (›: closer, ‹: farther, stopping at the ends)
          changed();
        },
        () => {
          stepZoom(1, true); // (Enter: closer, round to the farthest after the closest)
          changed();
        },
      );
      const walls = toggle('Inner walls', hooks.walls.full, ['Low', 'Full'], () => {
        hooks.walls.toggle();
        changed();
      });
      const controls = button('', 'Controls', 'Every key, and what it does', () => ((showing = 'controls'), (lit = 0), draw()));
      const menu = button('', 'Main menu', 'This world saved: another hero, another world', () => hooks.mainMenu());
      const settings = el('div', 'pause-settings');
      settings.append(zoom.node, walls.node);
      main.append(title, resume, settings, controls, menu, el('p', 'pause-foot', 'Esc to resume · Your progress saves itself'));
      items = [
        { node: resume, act: () => resume.click() },
        zoom,
        walls,
        { node: controls, act: () => controls.click() },
        { node: menu, act: () => menu.click() },
      ];
    }
    stage.replaceChildren(heroCard(), main);
    choose(Math.min(lit, items.length - 1));
  };

  const choose = (i: number) => {
    lit = (i + items.length) % items.length;
    items.forEach((item, k) => item.node.classList.toggle('lit', k === lit));
    items[lit]?.node.focus({ preventScroll: true });
  };
  stage.addEventListener('mousemove', (e) => {
    const k = items.findIndex((item) => item.node.contains(e.target as Node));
    if (k >= 0 && k !== lit) choose(k);
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) api.close(); // (a click outside: back to the game)
  });

  const api: Menu = {
    get isOpen() {
      return !backdrop.hidden;
    },
    open() {
      [showing, lit] = ['main', 0];
      backdrop.hidden = false;
      trackMenu(api, true);
      hooks.setPaused(true);
      draw();
    },
    close() {
      backdrop.hidden = true;
      trackMenu(api, false);
      hooks.setPaused(false);
    },
    toggle() {
      if (api.isOpen) api.close();
      else api.open();
    },
    refresh() {
      if (api.isOpen) draw();
    },
    setTitle() {},
  };

  // Capture: while open, every key is the menu's, none reaches the game.
  window.addEventListener(
    'keydown',
    (event) => {
      if (!api.isOpen) {
        if (event.code !== 'Escape' || anyMenuOpen()) return; // (Escape opens it only when nothing else is open)
        event.stopImmediatePropagation();
        if (!event.repeat) api.open();
        return;
      }
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.repeat && !event.code.startsWith('Arrow')) return;
      const item = items[lit];
      if (event.code === 'Escape') {
        if (showing === 'controls') {
          showing = 'main';
          draw();
        } else api.close();
      } else if (event.code === 'ArrowDown') choose(lit + 1);
      else if (event.code === 'ArrowUp') choose(lit - 1);
      else if ((event.code === 'ArrowRight' || event.code === 'ArrowLeft') && item?.step) item.step(event.code === 'ArrowRight' ? 1 : -1);
      else if (event.code === 'Enter' || event.code === 'Space') item?.act();
    },
    true,
  );

  return api;
}
