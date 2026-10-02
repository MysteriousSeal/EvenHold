// A well's blessing (or, by a cheat, all of them), while it lasts
// (hero/blessing.ts), in the top right corner (styles in hud.css), a card
// each: its icon on sand like the hero's portrait, the time left in a
// green pill on its corner (as the level gem sits on the portrait's); its
// name and what it does on hover. First of them while the hero eats or
// drinks from the bag (sat down: hero/bag.ts eatOrDrink), a card of the
// meal: what's eaten, the time left, what it gives and what stops it.

import { BLESSINGS, isBane, type BlessingKind } from '../../model/hero/blessing';
import type { Hero } from '../../model/types';
import { gearIcon, lootIcon } from '../ui/itemIcons';
import { LOOT } from '../../model/loot/loot';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { voxelIcon } from '../ui/voxelIcon';
import { armModel, bookModel, bootModel, eyeModel, featherModel, heartModel, snowflakeModel } from './blessingVoxels';
import type { MenuIcon } from '../ui/menu';

// Each blessing's picture: a winged boot, a flexed arm, a book, a feather, a heart and an eye (blessingVoxels.ts), a shield, a gold coin;
// and the banes: a fall's Weary, the heart greyed; a draugr's frost, Chilled, a snowflake.
const ICONS: Record<BlessingKind, MenuIcon> = {
  swift: (size) => voxelIcon('blessing:swift', bootModel, size),
  wise: (size) => voxelIcon('blessing:wise', bookModel, size),
  quiet: (size) => voxelIcon('blessing:quiet', featherModel, size),
  second: (size) => voxelIcon('blessing:second', heartModel, size),
  keen: (size) => voxelIcon('blessing:keen', eyeModel, size),
  strong: (size) => voxelIcon('blessing:strong', armModel, size),
  tough: gearIcon('heaterShield'),
  weary: (size) => voxelIcon('blessing:second', heartModel, size), // (a fall's: the heart, greyed: hud.css)
  chilled: (size) => voxelIcon('blessing:chilled', snowflakeModel, size), // (a draugr's frost: an ice-blue snowflake)
  lucky: () => {
    const coin = document.createElement('canvas'); // a gold coin, as the purse draws them, larger
    coin.className = 'blessing-coin';
    return coin;
  },
};

const clock = (seconds: number) => (seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${Math.ceil(seconds)}s`);

interface Card {
  root: HTMLElement;
  left: HTMLElement;
  time: string;
}

// A card: its icon on its tile, the time left in a pill on its corner (filled in as it runs), and its name and what
// it does in the shared tooltip look, under it on hover.
function makeCard(className: string, icon: MenuIcon, title: string, about: string): Card {
  const root = document.createElement('div');
  root.className = className;
  const tile = document.createElement('div');
  tile.className = 'blessing-hud-icon';
  tile.append(icon(36));
  const left = document.createElement('span');
  left.className = 'blessing-hud-time';
  const tip = document.createElement('div');
  tip.className = 'blessing-tip';
  const name = document.createElement('b');
  name.textContent = title;
  const said = document.createElement('span');
  said.textContent = about;
  tip.append(name, said);
  root.append(tile, left, tip);
  return { root, left, time: '' };
}

export function createBlessingHud(hero: Hero): () => void {
  const row = document.createElement('div');
  row.className = 'blessing-hud';
  document.body.append(row);
  const cards = new Map<BlessingKind, Card>();

  const card = (kind: BlessingKind): Card =>
    makeCard(isBane(kind) ? `blessing-card blessing-bane blessing-${kind}` : 'blessing-card', ICONS[kind], BLESSINGS[kind].name, BLESSINGS[kind].about); // (a fall's mark, a draugr's frost: not a well's gift)

  // The meal's card: made for each meal (its icon, its words), the time left kept up.
  let meal: (Card & { of: object }) | null = null;
  const showMeal = () => {
    const eating = hero.eating;
    if (meal && meal.of !== eating) [meal.root.remove(), (meal = null)];
    if (!eating?.item || !isProvision(eating.item)) return;
    if (!meal) {
      const { item } = eating;
      const about = `${LOOT[item].name}: ${givesText(item).toLowerCase()}. Moving, fighting or a blow stops it.`;
      meal = { ...makeCard('blessing-card blessing-meal', lootIcon(item), PROVISIONS[item].drink ? 'Drinking' : 'Eating', about), of: eating };
      row.prepend(meal.root);
    }
    const now = clock(eating.left);
    if (now !== meal.time) meal.left.textContent = meal.time = now;
  };

  return () => {
    showMeal();
    const blessings = hero.blessings ?? [];
    for (const [kind, c] of cards) {
      if (blessings.some((b) => b.kind === kind)) continue;
      c.root.remove();
      cards.delete(kind);
    }
    for (const [i, b] of blessings.entries()) {
      let c = cards.get(b.kind);
      if (!c) cards.set(b.kind, (c = card(b.kind)));
      const at = i + (meal ? 1 : 0); // (after the meal's card)
      if (row.children[at] !== c.root) row.insertBefore(c.root, row.children[at] ?? null);
      const now = clock(b.left);
      if (now !== c.time) c.left.textContent = c.time = now;
    }
  };
}
