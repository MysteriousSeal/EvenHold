// The E prompt over the places to work and the things to open, where it stands (main.ts asks this first: what's left,
// the people, the doors, seats and the skills' own prompts, it works out itself): a chest, the strongbox, the salvage
// bench, the anvil, a cauldron, a fire to cook at, a well. Undefined: none of these.

import type { GameModel } from '../../model/GameModel';
import type { Interaction } from '../../model/hero/interaction';
import type { PromptTarget } from '../../view/hud/lootPrompt';

const CHEST_PROMPTS = { chest: 'Open the chest', hoard: 'Tear open the hoard', locked: 'Locked · the chief has the key' } as const;

export function stationPrompt(model: GameModel, found: Interaction): PromptTarget | undefined {
  switch (found.kind) {
    case 'chest': // (a lord's chest, a brood mother's silk-wrapped hoard, a bandit camp's: locked while its chief stands)
      return { label: CHEST_PROMPTS[found.chest.what], x: found.chest.x, y: found.chest.y, z: found.chest.z };
    case 'strongbox': // (the inn's, or the let room's chest: the one stash)
      return { label: 'Open your strongbox', x: found.box.x, y: 0.7, z: found.box.z };
    case 'bench':
      return { label: 'Break down gear', x: found.bench.x, y: 0.75, z: found.bench.z };
    case 'anvil':
      return { label: 'Forge', x: found.anvil.x, y: 0.9, z: found.anvil.z };
    case 'cauldron':
      return { label: 'Brew', x: found.cauldron.x, y: 0.9, z: found.cauldron.z };
    case 'fire': // (a hearth: over its middle; a campfire, over it)
      return { label: 'Cook', x: found.fire.x, y: found.fire.kind === 'hearth' ? 1 : model.getGroundY(found.fire.x, found.fire.z) + 0.6, z: found.fire.z };
    case 'well':
      return { label: 'Toss a silver coin', x: model.villages[found.village].x, y: model.hero.y + 0.8, z: model.villages[found.village].z };
    default:
      return undefined;
  }
}
