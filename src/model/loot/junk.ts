// Junk: grey loot, good for nothing but selling. Each item says which kinds
// of enemies drop it and how often (a weight against the other items the
// same kind of enemy can drop), so adding an item never means touching a
// central table.

import type { LootEntry } from './loot';

export const JUNK_ITEMS = {
  // From beasts (wolves).
  wolfFang: { name: 'Wolf fang', value: 3, droppedBy: { beast: 3 } },
  mattedPelt: { name: 'Matted pelt', value: 5, droppedBy: { beast: 2 } },
  brokenClaw: { name: 'Broken claw', value: 2, droppedBy: { beast: 3 } },
  // From both: beasts gnaw them, bandits carry their supper.
  gnawedBone: { name: 'Gnawed bone', value: 1, droppedBy: { beast: 3, humanoid: 1 } },
  // From humanoids (bandits).
  rustyBuckle: { name: 'Rusty buckle', value: 4, droppedBy: { humanoid: 3 } },
  crackedFlask: { name: 'Cracked flask', value: 2, droppedBy: { humanoid: 3 } },
  bentSpoon: { name: 'Bent spoon', value: 3, droppedBy: { humanoid: 2 } },
  tornPouch: { name: 'Torn pouch', value: 2, droppedBy: { humanoid: 3 } },
} satisfies Record<string, LootEntry>;
