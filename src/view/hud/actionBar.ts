// The action bar, bottom centre: a raised sand tile for each of the hero's
// shortcuts (model/hero/actionBar.ts), its key on its corner, what it points
// at (food, drink, a potion) and how many of it they carry; greyed when they
// carry none, or while they're still at a meal (a potion: while the potions'
// wait isn't over, its seconds counting down on it). Pressing its key, or clicking it,
// uses it; dragging one onto another swaps them, off the bar clears it, and
// so does a right-click; dropped from the bag (inventoryPanel.ts), a slot
// takes what's dropped; and a spell (model/spells/spells.ts: handed out from the cheat menu): its icon, its wait counting
// down on it once cast. Styles in hud.css.

import { isTool } from '../../model/loot/tools';
import type { Hero } from '../../model/types';
import { ACTION_SLOTS } from '../../model/hero/actionBar';
import { LOOT } from '../../model/loot/loot';
import { givesText } from '../../model/loot/provisions';
import { isPotion, potionText } from '../../model/loot/potions';
import { lootIcon } from '../ui/itemIcons';
import { SPELLS, isSpellKey, spellOf, spellText, waitOf } from '../../model/spells/spells';
import { SPELL_ICONS } from '../ui/spellIcons';

const ICON = 40; // px
const DRAG = 6; // px a press must move to be a drag, not a click

export interface ActionBarHooks {
  use(slot: number): void;
  swap(a: number, b: number): void;
  clear(slot: number): void;
}

// Returns the function to call each frame (it keeps each tile in step with the bar and the bag).
export function createActionBar(hero: Hero, hooks: ActionBarHooks): () => void {
  const bar = document.createElement('div');
  bar.className = 'action-bar';
  const tiles = Array.from({ length: ACTION_SLOTS }, (_, i) => {
    const tile = document.createElement('button');
    tile.className = 'toolbar-button action-slot';
    tile.dataset.slot = String(i);
    const key = document.createElement('span');
    key.className = 'action-key';
    key.textContent = String(i + 1);
    const count = document.createElement('span');
    count.className = 'menu-slot-count'; // (the bag's square chip)
    const tip = document.createElement('span');
    tip.className = 'toolbar-tip';
    const cool = document.createElement('span');
    cool.className = 'action-cool'; // (a potion's wait, in seconds)
    tile.append(key, count, cool, tip);
    tile.addEventListener('contextmenu', (event) => [event.preventDefault(), hooks.clear(i)]);
    // A press: let go where it began (or near), a use; on another tile, swapped with it; off the bar, cleared.
    tile.addEventListener('pointerdown', (event) => {
      event.stopPropagation(); // (no focusing the foe behind it)
      if (event.button !== 0) return;
      const [x, z] = [event.clientX, event.clientY];
      const up = (e: PointerEvent) => {
        window.removeEventListener('pointerup', up);
        if (Math.hypot(e.clientX - x, e.clientY - z) < DRAG) return hooks.use(i);
        const onto = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.action-slot');
        if (onto && onto !== tile) hooks.swap(i, Number(onto.dataset.slot));
        else if (!onto) hooks.clear(i);
      };
      window.addEventListener('pointerup', up);
    });
    bar.append(tile);
    return { tile, count, cool, tip, shown: '' };
  });
  document.body.append(bar);

  return () => {
    for (const [i, t] of tiles.entries()) {
      const item = hero.actionBar[i];
      // A spell (spells.ts): its icon; greyed while it waits, its seconds counting down on it; nothing carried to count.
      if (item && isSpellKey(item)) {
        const id = spellOf(item);
        const wait = Math.ceil(waitOf(hero, id));
        const state = `${item}/${wait}`;
        if (state === t.shown) continue;
        if (!t.shown.startsWith(`${item}/`)) [t.tile.querySelector('canvas')?.remove(), t.tile.prepend(SPELL_ICONS[id](ICON))];
        t.shown = state;
        t.count.textContent = '';
        t.tile.classList.remove('empty', 'spent');
        t.tile.classList.toggle('busy', wait > 0);
        t.cool.textContent = wait > 0 ? String(wait) : '';
        t.tip.textContent = `${SPELLS[id].name} · ${spellText(id)}`;
        continue;
      }
      const have = item ? (hero.bag[item] ?? 0) : 0;
      const potion = !!item && isPotion(item);
      const wait = potion ? Math.ceil(hero.potionCooldown ?? 0) : 0;
      const busy = !!item && (potion ? wait > 0 : !!hero.eating);
      const state = `${item}/${have}/${busy}/${wait}`;
      if (state === t.shown) continue;
      t.shown = state;
      t.tile.querySelector('canvas')?.remove();
      if (item) t.tile.prepend(lootIcon(item)(ICON));
      t.count.textContent = have > 1 ? String(have) : '';
      t.tile.classList.toggle('empty', !item);
      t.tile.classList.toggle('spent', !!item && have === 0); // (none carried)
      t.tile.classList.toggle('busy', busy); // (still at a meal; a potion's wait)
      t.cool.textContent = wait > 0 ? String(wait) : '';
      t.tip.textContent = item ? `${LOOT[item].name} · ${isPotion(item) ? potionText(item) : isTool(item) ? 'Lie down on it anywhere outdoors: rest and mend, slower than a bed' : givesText(item)}${have ? '' : ' · none left'}` : 'Drag food, drink, a potion or a bedroll here from your bag';
    }
  };
}
