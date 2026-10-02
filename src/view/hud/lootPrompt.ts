// Over what the hero can use with E: loot in reach (its name, in its
// quality's color, grey for junk), or a door ("Enter house", "Leave"). (What's picked up floats up over the hero:
// main.ts.) Styles in hud.css.

import type { GroundLoot } from '../../model/loot/loot';
import { nameOf, qualityOf } from '../../model/hero/bag';
import type { Npc } from '../../model/npcs/npcs';


// What E would do right now: its label (colored by `quality` for loot),
// shown over a point in the world.
export interface PromptTarget {
  label: string;
  quality?: string;
  muted?: boolean; // there, but not to be done now (e.g. sold out): shown faded
  npc?: Npc; // the villager it's about (talking to them): their name gives way to it
  x: number;
  y: number;
  z: number;
}

export interface LootPrompt {
  readonly element: HTMLElement; // (for another stacked over it)
  // Each frame: what E does (or null), and where on screen to put it.
  update(target: PromptTarget | null, toScreen: (x: number, y: number, z: number) => { x: number; y: number }): void;
}

// The prompt for loot on the ground: its name, in its quality's color.
const STACK_GAP = 8; // px between prompts stacked one over another

export function lootTarget(loot: GroundLoot): PromptTarget {
  return { label: nameOf(loot.item), quality: qualityOf(loot.item), x: loot.x, y: loot.y + 0.35, z: loot.z };
}

// `key`: the key it's for; `under`: shown just below the E prompt (a second thing to do there);
// `over`: another prompt it's stacked on, just above it on screen (a gap between), when that one shows.
export function createLootPrompt(key = 'E', under = false, over?: LootPrompt): LootPrompt {
  const prompt = document.createElement('div');
  prompt.className = 'loot-prompt';
  prompt.hidden = true;
  prompt.innerHTML = `<span class="loot-name"></span><span class="loot-key">${key}</span>`;
  const name = prompt.querySelector('.loot-name') as HTMLElement;
  document.body.append(prompt);

  return {
    element: prompt,
    update(target, toScreen) {
      prompt.hidden = !target;
      if (!target) return;
      if (name.textContent !== target.label) name.textContent = target.label;
      if (target.quality) name.dataset.quality = target.quality;
      else delete name.dataset.quality;
      prompt.classList.toggle('muted', !!target.muted);
      const at = toScreen(target.x, target.y, target.z);
      const lift = over && !over.element.hidden ? over.element.offsetHeight + STACK_GAP : 0;
      prompt.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - lift)}px) translate(-50%, ${under ? '8px' : '-100%'})`;
    },
  };
}
