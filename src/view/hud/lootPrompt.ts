// Over the loot within the hero's reach: its name, in its quality's color
// (grey for junk), and the key to pick it up. After a pickup, a short line
// says what went into the bag. Styles in hud.css.

import { LOOT, LOOT_QUALITY, type GroundLoot, type LootId } from '../../model/loot/loot';

const TOAST_SECONDS = 2;

export interface LootPrompt {
  // Each frame: the loot in reach (or null), and where on screen to put it.
  update(loot: GroundLoot | null, toScreen: (x: number, y: number, z: number) => { x: number; y: number }): void;
  pickedUp(item: LootId): void;
}

export function createLootPrompt(): LootPrompt {
  const prompt = document.createElement('div');
  prompt.className = 'loot-prompt';
  prompt.hidden = true;
  prompt.innerHTML = '<span class="loot-name"></span><span class="loot-key">E</span>';
  const name = prompt.querySelector('.loot-name') as HTMLElement;
  const toast = document.createElement('div');
  toast.className = 'loot-toast';
  toast.hidden = true;
  document.body.append(prompt, toast);
  let toastTimer = 0;
  let shownItem: LootId | null = null;

  return {
    update(loot, toScreen) {
      prompt.hidden = !loot;
      if (!loot) return;
      if (loot.item !== shownItem) {
        shownItem = loot.item;
        name.textContent = LOOT[loot.item].name;
        name.dataset.quality = LOOT_QUALITY[loot.item];
      }
      const at = toScreen(loot.x, loot.y + 0.35, loot.z);
      prompt.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    },
    pickedUp(item) {
      toast.textContent = `Picked up ${LOOT[item].name}`;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toast.hidden = true), TOAST_SECONDS * 1000);
    },
  };
}
