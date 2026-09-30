// The toolbar, bottom right: a tile per window (the hero sheet, the bag,
// the journal, the level-up window, the pause menu), each a voxel icon with
// its key in the corner, and a mark on the other while it has news (points to spend). Clicking
// one opens or closes its window; it stays pressed while the window's open.
// Styles in hud.css.

import type { MenuIcon } from '../ui/menu';

export interface ToolbarButton {
  label: string;
  key: string; // shown in the corner, e.g. 'C'
  icon: MenuIcon;
  isOpen(): boolean;
  toggle(): void;
  marked?(): boolean; // a mark on its corner while it's true (e.g. points to spend)
}

// Returns the function to call each frame (it keeps each tile's pressed look in step).
export function createToolbar(buttons: ToolbarButton[]): () => void {
  const bar = document.createElement('div');
  bar.className = 'toolbar';
  const tiles = buttons.map((button) => {
    const tile = document.createElement('button');
    tile.className = 'toolbar-button';
    tile.setAttribute('aria-label', button.label);
    const tip = document.createElement('span');
    tip.className = 'toolbar-tip'; // the shared tooltip look, over the tile on hover
    tip.textContent = button.label;
    const key = document.createElement('span');
    key.className = 'toolbar-key';
    key.textContent = button.key;
    tile.append(button.icon(40), key, tip);
    tile.addEventListener('click', () => button.toggle());
    // Keep the click off the game (no focusing the enemy behind the button).
    tile.addEventListener('pointerdown', (event) => event.stopPropagation());
    bar.append(tile);
    return tile;
  });
  document.body.append(bar);
  return () =>
    buttons.forEach((button, i) => {
      tiles[i].classList.toggle('open', button.isOpen());
      tiles[i].classList.toggle('marked', !!button.marked?.());
    });
}
