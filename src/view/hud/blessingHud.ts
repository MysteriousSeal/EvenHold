// A well's blessing (or, by a cheat, all of them), while it lasts
// (hero/blessing.ts), in the top right corner (styles in hud.css), a card
// each: its icon on sand like the hero's portrait, the time left in a
// green pill on its corner (as the level gem sits on the portrait's); its
// name and what it does on hover.

import { BLESSINGS, type BlessingKind } from '../../model/hero/blessing';
import type { Hero } from '../../model/types';
import { gearIcon } from '../ui/itemIcons';
import { voxelIcon } from '../ui/voxelIcon';
import { armModel, bookModel, bootModel, eyeModel, featherModel, heartModel } from './blessingVoxels';
import type { MenuIcon } from '../ui/menu';

// Each blessing's picture: a winged boot, a flexed arm, a book, a feather, a heart and an eye (blessingVoxels.ts), a shield, a gold coin.
const ICONS: Record<BlessingKind, MenuIcon> = {
  swift: (size) => voxelIcon('blessing:swift', bootModel, size),
  wise: (size) => voxelIcon('blessing:wise', bookModel, size),
  quiet: (size) => voxelIcon('blessing:quiet', featherModel, size),
  second: (size) => voxelIcon('blessing:second', heartModel, size),
  keen: (size) => voxelIcon('blessing:keen', eyeModel, size),
  strong: (size) => voxelIcon('blessing:strong', armModel, size),
  tough: gearIcon('heaterShield'),
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

export function createBlessingHud(hero: Hero): () => void {
  const row = document.createElement('div');
  row.className = 'blessing-hud';
  document.body.append(row);
  const cards = new Map<BlessingKind, Card>();

  const card = (kind: BlessingKind): Card => {
    const root = document.createElement('div');
    root.className = 'blessing-card';
    const tile = document.createElement('div');
    tile.className = 'blessing-hud-icon';
    tile.append(ICONS[kind](36));
    const left = document.createElement('span');
    left.className = 'blessing-hud-time';
    const tip = document.createElement('div');
    tip.className = 'blessing-tip'; // the shared tooltip look, under it on hover
    const name = document.createElement('b');
    name.textContent = BLESSINGS[kind].name;
    const about = document.createElement('span');
    about.textContent = BLESSINGS[kind].about;
    tip.append(name, about);
    root.append(tile, left, tip);
    return { root, left, time: '' };
  };

  return () => {
    const blessings = hero.blessings ?? [];
    for (const [kind, c] of cards) {
      if (blessings.some((b) => b.kind === kind)) continue;
      c.root.remove();
      cards.delete(kind);
    }
    for (const [i, b] of blessings.entries()) {
      let c = cards.get(b.kind);
      if (!c) cards.set(b.kind, (c = card(b.kind)));
      if (row.children[i] !== c.root) row.insertBefore(c.root, row.children[i] ?? null);
      const now = clock(b.left);
      if (now !== c.time) c.left.textContent = c.time = now;
    }
  };
}
