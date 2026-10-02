// The main menu, before any world is loaded, over the loading screen's own
// scene (index.html: the title, the sun over drifting hills), the best of
// the games that inspired it:
// - Elden Ring: a still title, "Press any key" breathing below it;
// - WoW and Diablo: a real voxel world behind it all (view/title: a camp at
//   dusk), up to four heroes standing before the fire in their look and
//   gear; then every hero saved here listed down the right, the last played
//   chosen: stepping forward, lit, a ring at their feet (one further down
//   the list takes the fourth place); Enter World under them; Delete hero
//   (asked twice) and the controls in the corners;
// - Minecraft: a splash of yellow words tilted by the title, pulsing, new
//   each time; a new world made from a seed, or none for a random one.
// Arrows and Enter (or the mouse) choose; Escape goes back. Resolves with the
// seed to play. A URL with a seed in it skips it (main.ts). Styles in
// mainMenu.css.

import type { SavedWorld } from './storage/saveGame';
import { CONTROLS } from './controls';
import { generateRandomSeed } from '../util/random';
import { seedFrom } from '../util/seed';
import { humanFigure } from '../view/meshes/human/humanFigure';
import { voxelIcon } from '../view/ui/voxelIcon';
import { TITLE_HEROES, createTitleScene } from '../view/title/titleScene';
import './mainMenu.css';

export interface MainMenuHooks {
  worlds(): SavedWorld[]; // the worlds saved here, the last played first
  forget(seed: number): void; // a hero let go: their world's save forgotten
}

const FIGURE = 220; // px: the chosen hero, drawn in the middle
export const SPLASHES = [
  'Now with potions!',
  'Mind your breath!',
  'Roll, then strike!',
  'The dead keep their crypts!',
  'Every voxel placed by hand!',
  'Herbs for sale!',
  'Parry the lord!',
  'Ask the pilgrim the way!',
  'Junk stacks to twenty!',
  'Sleep at the inn!',
  'Toss a coin in the well!',
  'Mind the bouncer!',
];

type Screen = 'press' | 'heroes' | 'newWorld' | 'controls';

export function showMainMenu(hooks: MainMenuHooks, splash = SPLASHES[Math.floor(Math.random() * SPLASHES.length)]): Promise<number> {
  const root = document.getElementById('loading') as HTMLDivElement;
  root.classList.add('title');
  const screen = document.createElement('div');
  screen.className = 'title-screen';
  const splashLine = document.createElement('div');
  splashLine.className = 'title-splash';
  splashLine.textContent = splash;
  root.append(screen, splashLine);
  const world = createTitleScene(root); // (none without WebGL: the chosen hero drawn flat instead)
  root.classList.toggle('world', !!world);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const button = (className: string, label: string, run: () => void) => {
    const b = el('button', className, label);
    b.addEventListener('click', run);
    return b;
  };

  return new Promise((resolve) => {
    let worlds = hooks.worlds();
    let at: Screen = 'press';
    let chosen = 0; // the hero chosen (the last played, first)
    let sure = false; // (letting the chosen hero go: asked once already)
    const play = (seed: number) => {
      window.removeEventListener('keydown', keys);
      root.removeEventListener('click', wake);
      screen.remove();
      splashLine.remove();
      root.classList.remove('title', 'world');
      world?.dispose();
      resolve(seed);
    };
    // Who stands in the world: the first four, the chosen one taking the fourth place if they're further down.
    const standing = () => {
      const row = worlds.slice(0, TITLE_HEROES);
      if (chosen >= TITLE_HEROES) row[TITLE_HEROES - 1] = worlds[chosen];
      return row;
    };
    world?.onPick((i) => {
      // (on the title too: the click wakes it, on the hero clicked, not the last played)
      const index = worlds.indexOf(standing()[i]);
      if (index === chosen && at === 'heroes') return play(worlds[chosen].seed); // (the chosen one clicked again: in)
      [chosen, sure, at] = [index, false, 'heroes'];
      draw();
    });
    const go = (next: Screen) => {
      [at, sure] = [next, false];
      draw();
    };

    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'INPUT') {
        if (event.code === 'Escape') go('heroes');
        return;
      }
      if (at === 'press') return void (event.repeat || go('heroes'));
      const up = event.code === 'ArrowUp';
      const down = event.code === 'ArrowDown';
      if (event.code === 'Escape') return go(at === 'heroes' ? 'press' : 'heroes');
      if (at === 'heroes') {
        if (up || down) {
          event.preventDefault();
          if (worlds.length) [chosen, sure] = [(chosen + (down ? 1 : worlds.length - 1)) % worlds.length, false];
          draw();
        } else if (event.code === 'Enter' && worlds[chosen]) play(worlds[chosen].seed);
      }
    };
    window.addEventListener('keydown', keys);
    const wake = () => at === 'press' && go('heroes'); // (a click anywhere, as a key)
    root.addEventListener('click', wake);

    const back = () => button('title-side', 'Back', () => go('heroes'));

    const draw = () => {
      root.dataset.screen = at;
      const row = standing();
      world?.show(row, at === 'press' ? -1 : row.indexOf(worlds[chosen]));
      if (at === 'press') {
        screen.replaceChildren(el('div', 'title-press', 'Press any key'));
        return;
      }
      if (at === 'heroes') {
        const hero = worlds[chosen];
        const stage = el('div', 'title-stage');
        if (hero && !world) {
          const figure = voxelIcon(`title:${JSON.stringify([hero.look, hero.equipment])}`, () => humanFigure(hero.look, hero.equipment), FIGURE);
          stage.append(figure, el('div', 'title-hero-name', hero.name), el('div', 'title-hero-line', `Level ${hero.level} · day ${hero.day}`));
        } else if (!hero) stage.append(el('div', 'title-hero-line', 'No hero yet: make a new world to begin.'));
        const list = el('div', 'title-list');
        list.append(el('div', 'title-list-head', 'Your heroes'));
        worlds.forEach((w, i) => {
          const card = el('button', `title-card${i === chosen ? ' chosen' : ''}`);
          card.append(el('b', '', w.name), el('span', '', `Level ${w.level} · day ${w.day}`), el('small', '', `World ${w.seed}`));
          card.addEventListener('click', () => ([chosen, sure] = [i, false], draw()));
          card.addEventListener('dblclick', () => play(w.seed));
          list.append(card);
        });
        list.append(button('title-side', 'New World', () => go('newWorld')));
        const enter = hero ? button('title-enter', 'Enter World', () => play(hero.seed)) : button('title-enter', 'New World', () => go('newWorld'));
        const left = el('div', 'title-corner left');
        left.append(button('title-side', 'Controls', () => go('controls')));
        const right = el('div', 'title-corner right');
        if (hero) {
          right.append(
            button('title-side danger', sure ? `Forget ${hero.name}? Click again` : 'Delete hero', () => {
              if (!sure) return void ((sure = true), draw());
              hooks.forget(hero.seed);
              worlds = hooks.worlds();
              [chosen, sure] = [0, false];
              draw();
            }),
          );
        }
        screen.replaceChildren(stage, enter, list, left, right);
        enter.focus();
        return;
      }
      if (at === 'newWorld') {
        // Minecraft's: a seed if you've one (a number, or any word: the same word, the same world), else a random one.
        const panel = el('form', 'title-panel');
        const input = el('input', 'title-input');
        input.placeholder = 'Leave blank for a random world';
        input.maxLength = 40;
        panel.append(el('div', 'title-panel-head', 'Create New World'), el('label', 'title-note', 'World seed'), input, el('small', 'title-note', 'A number or any word: the same seed, the same world (a hero saved there carries on).'));
        panel.append(button('title-enter inline', 'Create New World', () => {}));
        panel.addEventListener('submit', (event) => {
          event.preventDefault();
          play(seedFrom(input.value) ?? generateRandomSeed());
        });
        const left = el('div', 'title-corner left');
        left.append(back());
        screen.replaceChildren(panel, left);
        input.focus();
        return;
      }
      const panel = el('div', 'title-panel');
      const dl = el('dl', 'title-controls');
      for (const [what, k] of CONTROLS) dl.append(el('dt', '', what), el('dd', '', k));
      panel.append(el('div', 'title-panel-head', 'Controls'), dl);
      const left = el('div', 'title-corner left');
      left.append(back());
      screen.replaceChildren(panel, left);
    };
    draw();
  });
}
