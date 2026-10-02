// The character creation screen's panel (the main menu's, mainMenu.ts),
// as WoW's or Skyrim's: a name (a random one to match, re-rolled by the
// dice), then every trait of a look (model/human/lookTraits.ts), each drawn
// for what it is: a pick between a few (Man, Woman), colour swatches, a
// style stepped through, a yes or no; "Surprise me" for a whole new look;
// a helm to try on (a preview only: every new hero starts bare-headed); at
// its foot, the world's seed (blank: a random world). Knows no trait by
// name: a new one there shows here. Each change is told (`changed`), for
// the hero being made to stand changed in the world.

import { LOOK_TRAITS, fitLook, stepTrait, withTrait, type LookTrait } from '../model/human/lookTraits';
import { randomLook, type BodyLook } from '../model/human/humanoid';
import { randomName } from '../model/npcs/npcs';
import { lookSwatch } from '../view/meshes/human/bodyVoxels';
import { generateRandomSeed } from '../util/random';
import { seedFrom } from '../util/seed';
import './heroForge.css';

export interface Forged {
  name: string;
  look: BodyLook;
  seed: number;
}

export interface Forge {
  panel: HTMLElement;
  look(): BodyLook;
  name(): string;
  helm(): boolean; // trying a helm on (a preview)
  submit(): Forged | null; // (null: something to fix, told in the panel)
}

const NAME_MAX = 18;
const NAME_OK = /^[\p{L}][\p{L}' -]*$/u;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export function heroForge(changed: (look: BodyLook, name: string) => void): Forge {
  let look = fitLook(randomLook());
  let name = randomName(look.build);
  let named = false; // (a name typed: kept when the body changes)
  let helm = false; // (a helm tried on)

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  };
  const panel = el('div', 'title-forge');
  const traits = el('div', 'forge-traits');
  const nameInput = el('input', 'forge-name');
  const seedInput = el('input', 'title-input');
  const problem = el('div', 'forge-problem');

  const dice = (label: string, roll: () => void) => {
    const b = el('button', 'forge-dice');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', roll);
    return b;
  };
  const tell = () => changed(look, name);

  // One trait, drawn for its kind.
  const traitRow = (trait: LookTrait): HTMLElement => {
    const row = el('section', `forge-trait ${trait.kind}`);
    const head = el('div', 'forge-trait-head');
    head.append(el('span', '', trait.label), el('b', '', trait.name(look[trait.key])));
    row.append(head);
    const set = (value: BodyLook[typeof trait.key]) => {
      look = withTrait(look, trait.key, value);
      if (trait.key === 'build' && !named) name = randomName(look.build); // (a name to match, unless one's been typed)
      draw();
      tell();
    };
    const values = trait.values(look);
    if (trait.kind === 'cycle') {
      const stepper = el('div', 'forge-stepper');
      const arrow = (by: 1 | -1) => {
        const b = el('button', 'forge-arrow', by < 0 ? '‹' : '›');
        b.type = 'button';
        b.setAttribute('aria-label', `${by < 0 ? 'Previous' : 'Next'} ${trait.label.toLowerCase()}`);
        b.addEventListener('click', () => {
          look = stepTrait(look, trait.key, by);
          draw();
          tell();
        });
        return b;
      };
      const face = el('span', 'forge-face');
      face.append(el('b', '', trait.name(look[trait.key])), el('small', '', `${values.indexOf(look[trait.key] as never) + 1} / ${values.length}`));
      stepper.append(arrow(-1), face, arrow(1));
      row.append(stepper);
      return row;
    }
    const options = el('div', trait.kind === 'swatch' ? 'forge-swatches' : 'forge-switch');
    for (const value of values) {
      const b = el('button', `forge-option${value === look[trait.key] ? ' chosen' : ''}`, trait.kind === 'swatch' ? '' : trait.name(value));
      b.type = 'button';
      b.title = trait.name(value);
      b.setAttribute('aria-pressed', String(value === look[trait.key]));
      const color = trait.kind === 'swatch' ? lookSwatch(trait.key, value) : null;
      if (color !== null) b.style.setProperty('--swatch', hex(color));
      b.addEventListener('click', () => set(value));
      options.append(b);
    }
    row.append(options);
    return row;
  };

  // Trying a helm on: how the hair sits under one (a preview, not worn).
  const helmRow = () => {
    const row = el('section', 'forge-trait toggle forge-helm');
    const head = el('div', 'forge-trait-head');
    head.append(el('span', '', 'Helm'), el('b', '', 'Preview'));
    const options = el('div', 'forge-switch');
    for (const on of [false, true]) {
      const b = el('button', `forge-option${on === helm ? ' chosen' : ''}`, on ? 'On' : 'Off');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(on === helm));
      b.addEventListener('click', () => {
        helm = on;
        draw();
        tell();
      });
      options.append(b);
    }
    row.append(head, options);
    return row;
  };

  const draw = () => {
    nameInput.value = name;
    // The traits, the helm to try on right under the hair style (to see how it sits under one).
    const rows = LOOK_TRAITS.filter((t) => !t.shown || t.shown(look)).flatMap((t) => (t.key === 'hairStyle' ? [traitRow(t), helmRow()] : [traitRow(t)]));
    traits.replaceChildren(...rows);
  };

  // The head: its title, and a whole new look.
  const head = el('div', 'title-list-head');
  head.append(el('span', '', 'Forge your hero'));
  const surprise = el('button', 'forge-surprise', 'Surprise me');
  surprise.type = 'button';
  surprise.addEventListener('click', () => {
    look = fitLook(randomLook());
    if (!named) name = randomName(look.build);
    draw();
    tell();
  });

  // The name.
  const nameRow = el('section', 'forge-trait');
  const nameHead = el('div', 'forge-trait-head');
  nameHead.append(el('span', '', 'Name'));
  const nameLine = el('div', 'forge-name-line');
  nameInput.maxLength = NAME_MAX;
  nameInput.spellcheck = false;
  nameInput.autocomplete = 'off';
  nameInput.setAttribute('aria-label', 'Name');
  nameInput.addEventListener('input', () => {
    name = nameInput.value;
    named = true;
    problem.textContent = '';
    tell();
  });
  nameLine.append(
    nameInput,
    dice('Another name', () => {
      name = randomName(look.build);
      named = false;
      problem.textContent = '';
      draw();
      tell();
    }),
  );
  nameRow.append(nameHead, nameLine);

  // The world: a seed, or none (a random one).
  const world = el('details', 'forge-world');
  world.append(el('summary', '', 'World'));
  seedInput.placeholder = 'Seed: leave blank for a random world';
  seedInput.maxLength = 40;
  seedInput.setAttribute('aria-label', 'World seed');
  world.append(seedInput, el('small', 'title-note', 'A number or any word: the same seed, the same world.'));

  head.append(surprise);
  panel.append(head, nameRow, traits, world, problem);
  draw();
  queueMicrotask(tell);

  return {
    panel,
    look: () => look,
    name: () => name,
    helm: () => helm,
    submit() {
      const clean = name.trim().replace(/\s+/g, ' ');
      if (!clean) return void (problem.textContent = 'Your hero needs a name.'), null;
      if (!NAME_OK.test(clean)) return void (problem.textContent = `A name of letters (spaces, ' and - between), up to ${NAME_MAX}.`), null;
      return { name: clean, look, seed: seedFrom(seedInput.value) ?? generateRandomSeed() };
    },
  };
}
