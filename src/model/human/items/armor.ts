// Everything worn on the body, slot by slot.

import { slotItems } from './item';

export const HEAD_ITEMS = slotItems('head', {
  leatherCap: { name: 'Leather cap' },
  maskedHood: { name: 'Hood and mask', wornBy: { bandit: 3 } },
  redBandana: { name: 'Red bandana', wornBy: { bandit: 2 } },
  nasalCap: { name: 'Nasal cap', wornBy: { bandit: 2 } },
  linenCoif: { name: 'Linen coif' },
  strawHat: { name: 'Straw hat' },
  greatHelm: { name: 'Great helm' },
  mailCoif: { name: 'Mail coif', wornBy: { bandit: 1 } },
  huntersHood: { name: "Hunter's hood", wornBy: { bandit: 1 } },
  circlet: { name: 'Gold circlet' },
});

export const SHOULDERS_ITEMS = slotItems('shoulders', {
  leatherPauldrons: { name: 'Leather pauldrons', wornBy: { bandit: 2 } },
  ironPauldrons: { name: 'Iron pauldrons' },
  furMantle: { name: 'Fur mantle', wornBy: { bandit: 1 } },
  quiltedPads: { name: 'Quilted pads' },
  mailMantle: { name: 'Mail mantle' },
  bronzeSpaulders: { name: 'Bronze spaulders' },
  woolShawl: { name: 'Wool shawl' },
  studdedPauldrons: { name: 'Studded pauldrons', wornBy: { bandit: 1 } },
  goldEpaulettes: { name: 'Gold epaulettes' },
  ropeWraps: { name: 'Rope wraps', wornBy: { bandit: 1 } },
});

export const TORSO_ITEMS = slotItems('torso', {
  gambeson: { name: 'Gambeson' },
  leatherVest: { name: 'Leather vest', wornBy: { bandit: 3 } },
  patchedTunic: { name: 'Patched tunic', wornBy: { bandit: 2 } },
  furJerkin: { name: 'Fur-collared jerkin', wornBy: { bandit: 2 } },
  chainMail: { name: 'Chain mail' },
  tabard: { name: 'EvenHold tabard' },
  breastplate: { name: 'Breastplate' },
  linenShirt: { name: 'Linen shirt', wornBy: { bandit: 1 } },
  travelCloak: { name: 'Travel cloak', wornBy: { bandit: 1 } },
  brigandine: { name: 'Brigandine', wornBy: { bandit: 1 } },
});

export const HANDS_ITEMS = slotItems('hands', {
  ridingGloves: { name: 'Riding gloves', wornBy: { bandit: 2 } },
  workGloves: { name: 'Work gloves' },
  mailMittens: { name: 'Mail mittens' },
  gauntlets: { name: 'Gauntlets' },
  handWraps: { name: 'Hand wraps', wornBy: { bandit: 1 } },
  fingerlessGloves: { name: 'Fingerless gloves', wornBy: { bandit: 1 } },
  furMittens: { name: 'Fur mittens' },
  embroideredGloves: { name: 'Embroidered gloves' },
  leatherBracers: { name: 'Leather bracers', wornBy: { bandit: 1 } },
  silkGloves: { name: 'Silk gloves' },
});

export const LEGS_ITEMS = slotItems('legs', {
  woolHose: { name: 'Wool hose' },
  beltedTrousers: { name: 'Belted trousers', wornBy: { bandit: 2 } },
  ropeTrousers: { name: 'Rope-belted trousers', wornBy: { bandit: 2 } },
  mailChausses: { name: 'Mail chausses' },
  plateGreaves: { name: 'Plate greaves' },
  plaidKilt: { name: 'Plaid kilt', wornBy: { bandit: 1 } },
  leatherBreeches: { name: 'Leather breeches', wornBy: { bandit: 1 } },
  stripedHose: { name: 'Striped hose' },
  paddedChausses: { name: 'Padded chausses' },
  linenTrousers: { name: 'Linen trousers' },
});

export const FEET_ITEMS = slotItems('feet', {
  leatherBoots: { name: 'Leather boots' },
  blackBoots: { name: 'Black boots', wornBy: { bandit: 2 } },
  footWraps: { name: 'Foot wraps', wornBy: { bandit: 1 } },
  sandals: { name: 'Sandals', wornBy: { bandit: 1 } },
  sabatons: { name: 'Sabatons' },
  furBoots: { name: 'Fur boots' },
  redShoes: { name: 'Red shoes' },
  woodenClogs: { name: 'Wooden clogs' },
  feltSlippers: { name: 'Felt slippers' },
  hobnailBoots: { name: 'Hobnail boots', wornBy: { bandit: 1 } },
});
