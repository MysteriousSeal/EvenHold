// Jewelry: worn at the neck and on a finger. Too small to show on the
// body, so it's seen on the hero sheet and in the bag.

import { slotItems } from './item';

export const NECK_ITEMS = slotItems('neck', {
  woodenCharm: { name: 'Wooden charm', wornBy: { bandit: 1 } },
  boneTalisman: { name: 'Bone talisman', wornBy: { bandit: 1 } },
  wolfToothNecklace: { name: 'Wolf-tooth necklace', wornBy: { bandit: 2 } },
  silverLocket: { name: 'Silver locket' },
  amberPendant: { name: 'Amber pendant' },
  lakeStone: { name: 'Lake stone pendant' },
  ironTorc: { name: 'Iron torc' },
  pearlStrand: { name: 'Pearl strand' },
  runeStone: { name: 'Rune stone' },
  goldChain: { name: 'Gold chain' },
});

export const RING_ITEMS = slotItems('ring', {
  copperRing: { name: 'Copper ring', wornBy: { bandit: 2 } },
  ironBand: { name: 'Iron band', wornBy: { bandit: 1 } },
  boneRing: { name: 'Bone ring', wornBy: { bandit: 1 } },
  silverRing: { name: 'Silver ring' },
  goldRing: { name: 'Gold ring' },
  jadeRing: { name: 'Jade ring' },
  rubyRing: { name: 'Ruby ring' },
  sapphireRing: { name: 'Sapphire ring' },
  signetRing: { name: 'Signet ring' },
  twistedWire: { name: 'Twisted wire ring' },
});
