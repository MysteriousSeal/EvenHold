// Over what the hero can use with E: loot in reach (its name, in its
// quality's color, grey for junk), or a door ("Enter house", "Leave"). After a pickup, a short line
// says what went into the bag. Styles in hud.css.

import type { GroundLoot } from '../../model/loot/loot';
import { nameOf, qualityOf, type BagItem } from '../../model/bag';

const TOAST_SECONDS = 2;

// What E would do right now: its label (colored by `quality` for loot),
// shown over a point in the world.
export interface PromptTarget {
  label: string;
  quality?: string;
  x: number;
  y: number;
  z: number;
}

export interface LootPrompt {
  // Each frame: what E does (or null), and where on screen to put it.
  update(target: PromptTarget | null, toScreen: (x: number, y: number, z: number) => { x: number; y: number }): void;
  pickedUp(item: BagItem): void;
}

// The prompt for loot on the ground: its name, in its quality's color.
export function lootTarget(loot: GroundLoot): PromptTarget {
  return { label: nameOf(loot.item), quality: qualityOf(loot.item), x: loot.x, y: loot.y + 0.35, z: loot.z };
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

  return {
    update(target, toScreen) {
      prompt.hidden = !target;
      if (!target) return;
      if (name.textContent !== target.label) name.textContent = target.label;
      if (target.quality) name.dataset.quality = target.quality;
      else delete name.dataset.quality;
      const at = toScreen(target.x, target.y, target.z);
      prompt.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, -100%)`;
    },
    pickedUp(item) {
      toast.textContent = `Picked up ${nameOf(item)}`;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => (toast.hidden = true), TOAST_SECONDS * 1000);
    },
  };
}
