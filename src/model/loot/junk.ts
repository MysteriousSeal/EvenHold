// Junk: grey loot, good for nothing but selling. Each item says which kinds
// of enemies drop it and how often (a weight against the other items the
// same kind of enemy can drop), so adding an item never means touching a
// central table.

import type { LootEntry } from './lootEntry';

export const JUNK_ITEMS = {
  // From beasts (wolves).
  wolfFang: { name: 'Wolf fang', value: 3, droppedBy: { beast: 3 } },
  mattedPelt: { name: 'Matted pelt', value: 5, droppedBy: { beast: 2, boar: 2 } },
  brokenClaw: { name: 'Broken claw', value: 2, droppedBy: { beast: 3 } },
  // From both: beasts gnaw them, bandits carry their supper.
  gnawedBone: { name: 'Gnawed bone', value: 1, droppedBy: { beast: 3, humanoid: 1 } },
  // From boars: their tusks, and the beasts' pelts.
  boarTusk: { name: 'Boar tusk', value: 6, droppedBy: { boar: 3 } },
  // From humanoids (bandits).
  rustyBuckle: { name: 'Rusty buckle', value: 4, droppedBy: { humanoid: 3 } },
  crackedFlask: { name: 'Cracked flask', value: 2, droppedBy: { humanoid: 3 } },
  bentSpoon: { name: 'Bent spoon', value: 3, droppedBy: { humanoid: 2 } },
  tornPouch: { name: 'Torn pouch', value: 2, droppedBy: { humanoid: 3 } },
  // From the undead (the crypts' skeletons): their old gear, gone to rust and dust.
  rustedBlade: { name: 'Rusted blade', value: 5, droppedBy: { undead: 3, draugr: 1 } },
  oldArrowhead: { name: 'Old arrowhead', value: 3, droppedBy: { undead: 3 } },
  boneCharm: { name: 'Bone charm', value: 7, droppedBy: { undead: 2, draugr: 1 } },
  // From draugr: what the old warriors were laid to rest with, worth far more.
  frostTorc: { name: 'Frost-rimed torc', value: 30, droppedBy: { draugr: 2 } },
  runestone: { name: "Draugr's runestone", value: 20, droppedBy: { draugr: 3 } },
  oldSilver: { name: 'Old silver coin', value: 14, droppedBy: { draugr: 3 } },
} satisfies Record<string, LootEntry>;
