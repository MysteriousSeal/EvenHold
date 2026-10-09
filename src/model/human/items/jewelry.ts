// Jewelry: worn at the neck and on a finger. Too small to show on the
// body, so it's seen on the hero sheet and in the bag.

import { slotItems } from './item';

export const NECK_ITEMS = slotItems('neck', {
  woodenCharm: { name: 'Wooden charm', value: 12, soldBy: { pedlar: 3 }, wornBy: { bandit: 1, pilgrim: 1 }, stats: { endurance: 1 } },
  // A woodworker's (skills/woodworking.ts), set with what the salvage bench leaves: a carved pendant with a gem shard, a heartwood amulet with a cut gem.
  carvedPendant: { name: 'Carved pendant', value: 70, stats: { agility: 2 } },
  heartwoodAmulet: { name: 'Heartwood amulet', value: 160, stats: { endurance: 3, agility: 1 } },
  boneTalisman: { name: 'Bone talisman', wornBy: { bandit: 1 }, stats: { stamina: 1 } },
  wolfToothNecklace: { name: 'Wolf-tooth necklace', wornBy: { bandit: 2 }, stats: { strength: 2 } },
  silverLocket: { name: 'Silver locket', value: 40, soldBy: { pedlar: 1 }, stats: { endurance: 2 } },
  amberPendant: { name: 'Amber pendant', value: 45, soldBy: { pedlar: 1 }, stats: { stamina: 2 } },
  lakeStone: { name: 'Lake stone pendant', value: 45, soldBy: { pedlar: 1 }, stats: { agility: 2 } },
  ironTorc: { name: 'Iron torc', stats: { strength: 1, stamina: 1 } },
  pearlStrand: { name: 'Pearl strand', stats: { agility: 1, endurance: 1 } },
  runeStone: { name: 'Rune stone', stats: { endurance: 3 } },
  goldChain: { name: 'Gold chain', stats: { strength: 1, endurance: 2 } },
});

export const RING_ITEMS = slotItems('ring', {
  bentwoodRing: { name: 'Bentwood ring', value: 28, stats: { stamina: 1 } }, // (a woodworker's: a strip of birch bent round, bound in silver)
  copperRing: { name: 'Copper ring', value: 15, soldBy: { pedlar: 3 }, wornBy: { bandit: 2, pedlar: 1 }, stats: { stamina: 1 } },
  ironBand: { name: 'Iron band', wornBy: { bandit: 1 }, stats: { strength: 1 } },
  boneRing: { name: 'Bone ring', value: 14, soldBy: { pedlar: 2 }, wornBy: { bandit: 1 }, stats: { agility: 1 } },
  silverRing: { name: 'Silver ring', stats: { endurance: 2 } },
  goldRing: { name: 'Gold ring', stats: { stamina: 2 } },
  jadeRing: { name: 'Jade ring', stats: { agility: 2 } },
  rubyRing: { name: 'Ruby ring', stats: { strength: 2 } },
  sapphireRing: { name: 'Sapphire ring', stats: { agility: 1, endurance: 2 } },
  signetRing: { name: 'Signet ring', stats: { strength: 1, stamina: 1 } },
  twistedWire: { name: 'Twisted wire ring', value: 18, soldBy: { pedlar: 2 }, stats: { agility: 1 } },
});
