// The main menu, before any world is loaded, the best of the games that
// inspired it:
// - a real voxel world behind it all (view/title): an opening flight down
//   a valley at dusk into the heroes' camp, the fire flaring, the title
//   landing (a key or a click skips it);
// - WoW and Diablo: then the heroes, up to eight, coming into the world
//   before the fire in their look and gear; every hero saved here listed
//   down the right, the last played chosen: stepping forward, lit, a ring
//   at their feet (from the back row too); Enter
//   World under them; Delete hero (asked twice) and the controls in the
//   corners;
// - a village saying on a wooden signboard hung under the title, swaying,
//   new each time; a new world made from a seed, or none for a random one.
// Arrows and Enter (or the mouse) choose; Escape goes back. Resolves with the
// seed to play. A URL with a seed in it skips it (main.ts). No WebGL: no
// world, the chosen hero drawn flat, the heroes at once. Styles in
// mainMenu.css.

import { MAX_WORLDS, type SavedWorld } from './storage/saveGame';
import { CONTROL_GROUPS, type KeyMark } from './controls';
import { generateRandomSeed } from '../util/random';
import { seedFrom } from '../util/seed';
import { humanBust, humanFigure } from '../view/meshes/human/humanFigure';
import { voxelIcon } from '../view/ui/voxelIcon';
import { TITLE_HEROES, createTitleScene } from '../view/title/titleScene';
import './mainMenu.css';

export interface MainMenuHooks {
  worlds(): SavedWorld[]; // the worlds saved here, the last played first
  forget(seed: number): void; // a hero let go: their world's save forgotten
}

const FIGURE = 220; // px: the chosen hero, drawn in the middle
// A village saying, one each time, on a signboard under the title.
export const SAYINGS = [
  'Roll first, strike after.',
  'Mind your breath, mind your blade.',
  'The dead keep their crypts.',
  'Herbs at the hut, ale at the inn.',
  'Parry the lord, or pay for it.',
  'Ask the pilgrim the way.',
  'Junk sells, if you carry enough.',
  'Sleep at the inn; dawn comes kinder.',
  'A coin in the well, a wish in the dark.',
  'Mind the bouncer.',
  'Potions mend; time mends slower.',
  'Keep to the road after dusk.',
  'A sharp blade, a full bag, a warm bed.',
  'The smith mends what the road breaks.',
  'Wolves hunt when the light goes.',
  'Eat before you fight, not during.',
  'Bandits count your coin before you do.',
  'Old stones remember old wars.',
  'The barmaid hears everything.',
  'A guard raised in time is worth two blows.',
  'Light a fire, and the night keeps its distance.',
  'Every crypt has a lord, every lord a weakness.',
  'Rest when you can; the dark does not.',
  'The wise traveller carries bread.',
  'Gold is heavy; carry it anyway.',
  'Notice boards pay in coin and in trouble.',
  'A full belly walks further.',
  'Not every pilgrim is lost.',
  'Strike while they reel.',
  'The well is deeper than it looks.',
  'Breath spent is breath you lack.',
  'What the hills hide, the brave find.',
]

type Screen = 'intro' | 'heroes' | 'newWorld' | 'controls';

export function showMainMenu(hooks: MainMenuHooks, saying = SAYINGS[Math.floor(Math.random() * SAYINGS.length)]): Promise<number> {
  const root = document.getElementById('loading') as HTMLDivElement;
  root.classList.add('title');
  const screen = document.createElement('div');
  screen.className = 'title-screen';
  const ribbon = document.createElement('div');
  ribbon.className = 'title-saying';
  const words = document.createElement('span');
  words.textContent = saying;
  ribbon.append(words);
  root.append(screen, ribbon);
  const world = createTitleScene(root); // (none without WebGL: the chosen hero drawn flat instead)
  root.classList.add(world ? 'world' : 'flat');
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
    let at: Screen = world ? 'intro' : 'heroes';
    let chosen = 0; // the hero chosen (the last played, first)
    let sure = false; // (letting the chosen hero go: asked once already)
    const play = (seed: number) => {
      window.removeEventListener('keydown', keys);
      root.removeEventListener('click', skip);
      screen.remove();
      ribbon.remove();
      root.classList.remove('title', 'world', 'flat');
      world?.dispose();
      resolve(seed);
    };
    // Who stands in the world: every hero (eight at most: MAX_WORLDS); were there more, the chosen one in the last place.
    const standing = () => {
      const row = worlds.slice(0, TITLE_HEROES);
      if (chosen >= TITLE_HEROES) row[TITLE_HEROES - 1] = worlds[chosen];
      return row;
    };
    world?.onPick((i) => {
      const index = worlds.indexOf(standing()[i]);
      if (index === chosen && at === 'heroes') return play(worlds[chosen].seed); // (the chosen one clicked again: in)
      [chosen, sure, at] = [index, false, 'heroes'];
      draw();
    });
    world?.intro(() => {
      if (at !== 'intro') return;
      screen.classList.add('came'); // (the menu rising, as the heroes come)
      go('heroes');
    }); // (the opening over: the heroes come)
    const go = (next: Screen) => {
      [at, sure] = [next, false];
      draw();
    };

    const keys = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'INPUT') {
        if (event.code === 'Escape') go('heroes');
        return;
      }
      if (at === 'intro') return world?.skip();
      const up = event.code === 'ArrowUp';
      const down = event.code === 'ArrowDown';
      if (event.code === 'Escape' && at !== 'heroes') return go('heroes');
      if (at === 'heroes') {
        if (up || down) {
          event.preventDefault();
          if (worlds.length) [chosen, sure] = [(chosen + (down ? 1 : worlds.length - 1)) % worlds.length, false];
          draw();
        } else if (event.code === 'Enter' && worlds[chosen]) play(worlds[chosen].seed);
      }
    };
    window.addEventListener('keydown', keys);
    const skip = () => at === 'intro' && world?.skip(); // (a click anywhere, as a key)
    root.addEventListener('click', skip);

    const back = () => button('title-side', 'Back', () => go('heroes'));
    // A key, drawn: a cap; a word between caps; W over A S D, or the arrows, in their keyboard shape; the mouse.
    const mark = (m: KeyMark): HTMLElement => {
      if ('cap' in m) return el('kbd', `title-cap${m.cap.length > 1 ? ' wide' : ''}`, m.cap);
      if ('word' in m) return el('span', 'title-word', m.word);
      if ('mouse' in m) {
        const mouse = el('span', `title-mouse ${m.mouse}`);
        mouse.title = m.mouse === 'wheel' ? 'Mouse wheel' : 'Click';
        return mouse;
      }
      const [top, ...row] = m.cluster === 'wasd' ? ['W', 'A', 'S', 'D'] : ['↑', '←', '↓', '→'];
      const cluster = el('span', 'title-cluster');
      cluster.append(el('kbd', 'title-cap', top), ...row.map((k) => el('kbd', 'title-cap', k)));
      return cluster;
    };

    const draw = () => {
      root.dataset.screen = at;
      const row = standing();
      world?.show(row, row.indexOf(worlds[chosen]), at !== 'intro');
      if (at === 'intro') return void screen.replaceChildren();
      if (at === 'heroes') {
        const hero = worlds[chosen];
        const stage = el('div', 'title-stage');
        if (hero && !world) {
          const figure = voxelIcon(`title:${JSON.stringify([hero.look, hero.equipment])}`, () => humanFigure(hero.look, hero.equipment), FIGURE);
          stage.append(figure, el('div', 'title-hero-name', hero.name), el('div', 'title-hero-line', `Level ${hero.level} · day ${hero.day}`));
        } else if (!hero) stage.append(el('div', 'title-hero-line', 'No hero yet: make a new world to begin.'));
        // The roster: each hero (their bust, name, day and world, their level on a shield), the chosen one gilded;
        // then a slot for each place left (a new hero), eight in all.
        const list = el('div', 'title-list');
        const head = el('div', 'title-list-head');
        head.append(el('span', '', 'Your heroes'), el('small', '', `${worlds.length} / ${MAX_WORLDS}`));
        list.append(head);
        worlds.forEach((w, i) => {
          const card = el('button', `title-card${i === chosen ? ' chosen' : ''}`);
          const portrait = el('span', 'title-portrait');
          portrait.append(voxelIcon(`title-bust:${JSON.stringify([w.look, w.equipment])}`, () => humanBust(w.look, w.equipment), 44));
          const who = el('span', 'title-who');
          who.append(el('b', '', w.name), el('small', '', `Day ${w.day} · World ${w.seed}`));
          card.append(portrait, who, el('span', 'title-crest', String(w.level)));
          card.title = `${w.name}, level ${w.level}`;
          card.addEventListener('click', () => ([chosen, sure] = [i, false], draw()));
          card.addEventListener('dblclick', () => play(w.seed));
          list.append(card);
        });
        for (let i = worlds.length; i < MAX_WORLDS; i++) {
          const slot = el('button', 'title-slot');
          const who = el('span', 'title-who');
          who.append(el('b', '', 'Empty slot'), el('small', '', 'Create a new hero'));
          slot.append(el('span', 'title-portrait', '+'), who);
          slot.addEventListener('click', () => go('newWorld'));
          list.append(slot);
        }
        if (worlds.length >= MAX_WORLDS) list.append(el('small', 'title-full', `${MAX_WORLDS} heroes at most: delete one to make room.`));
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
        // A seed if you've one (a number, or any word: the same word, the same world), else a random one.
        const panel = el('form', 'title-panel');
        const input = el('input', 'title-input');
        input.placeholder = 'Leave blank for a random world';
        input.maxLength = 40;
        panel.append(el('div', 'title-panel-head', 'Create New World'), el('label', 'title-note', 'World seed'), input, el('small', 'title-note', 'A number or any word: the same seed, the same world (a hero saved there carries on).'));
        panel.append(button('title-enter inline', 'Create New World', () => {}));
        const refused = el('small', 'title-full');
        panel.append(refused);
        panel.addEventListener('submit', (event) => {
          event.preventDefault();
          const seed = seedFrom(input.value) ?? generateRandomSeed();
          const known = worlds.some((w) => w.seed === seed); // (one of theirs: always open)
          if (!known && worlds.length >= MAX_WORLDS) return void (refused.textContent = `${MAX_WORLDS} heroes at most: delete one to make room.`);
          play(seed);
        });
        const left = el('div', 'title-corner left');
        left.append(back());
        screen.replaceChildren(panel, left);
        input.focus();
        return;
      }
      // The controls, as a codex: grouped, each its keys drawn as keycaps.
      const panel = el('div', 'title-codex');
      const head = el('div', 'title-list-head');
      head.append(el('span', '', 'Controls'));
      const groups = el('div', 'title-controls');
      for (const group of CONTROL_GROUPS) {
        const section = el('section', 'title-group');
        section.append(el('h3', '', group.name));
        for (const c of group.controls) {
          const line = el('div', 'title-control');
          const what = el('span', 'title-what', c.what);
          if (c.note) what.append(el('small', '', c.note));
          const keys = el('span', 'title-keys');
          keys.append(...c.marks.map(mark));
          line.append(what, keys);
          section.append(line);
        }
        groups.append(section);
      }
      panel.append(head, groups);
      const left = el('div', 'title-corner left');
      left.append(back());
      screen.replaceChildren(panel, left);
    };
    draw();
  });
}
