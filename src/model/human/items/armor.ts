// Everything worn on the body, slot by slot.

import { slotItems } from './item';

export const HEAD_ITEMS = slotItems('head', {
  leatherCap: { name: 'Leather cap' },
  maskedHood: { name: 'Hood and mask', wornBy: { bandit: 3 } },
  redBandana: { name: 'Red bandana', wornBy: { bandit: 2 } },
  nasalCap: { name: 'Nasal cap', value: 60, soldBy: { smith: 2 }, wornBy: { bandit: 2 } },
  linenCoif: { name: 'Linen coif' },
  strawHat: { name: 'Straw hat' },
  greatHelm: { name: 'Great helm', value: 220, soldBy: { smith: 1 } },
  mailCoif: { name: 'Mail coif', value: 110, soldBy: { smith: 1 }, wornBy: { bandit: 1 } },
  huntersHood: { name: "Hunter's hood", wornBy: { bandit: 1 } },
  circlet: { name: 'Gold circlet' },
});

export const SHOULDERS_ITEMS = slotItems('shoulders', {
  leatherPauldrons: { name: 'Leather pauldrons', wornBy: { bandit: 2 } },
  ironPauldrons: { name: 'Iron pauldrons', value: 90, soldBy: { smith: 1 } },
  furMantle: { name: 'Fur mantle', wornBy: { bandit: 1 } },
  quiltedPads: { name: 'Quilted pads' },
  mailMantle: { name: 'Mail mantle', value: 110, soldBy: { smith: 1 } },
  bronzeSpaulders: { name: 'Bronze spaulders', value: 100, soldBy: { smith: 1 } },
  woolShawl: { name: 'Wool shawl' },
  studdedPauldrons: { name: 'Studded pauldrons', value: 70, soldBy: { smith: 1 }, wornBy: { bandit: 1 } },
  goldEpaulettes: { name: 'Gold epaulettes' },
  ropeWraps: { name: 'Rope wraps', wornBy: { bandit: 1 } },
});

export const TORSO_ITEMS = slotItems('torso', {
  gambeson: { name: 'Gambeson' },
  leatherVest: { name: 'Leather vest', wornBy: { bandit: 3 } },
  patchedTunic: { name: 'Patched tunic', wornBy: { bandit: 2 } },
  furJerkin: { name: 'Fur-collared jerkin', wornBy: { bandit: 2 } },
  chainMail: { name: 'Chain mail', value: 240, soldBy: { smith: 1 } },
  tabard: { name: 'EvenHold tabard' },
  breastplate: { name: 'Breastplate', value: 320, soldBy: { smith: 1 } },
  linenShirt: { name: 'Linen shirt', wornBy: { bandit: 1 } },
  travelCloak: { name: 'Travel cloak', wornBy: { bandit: 1 } },
  brigandine: { name: 'Brigandine', value: 200, soldBy: { smith: 1 }, wornBy: { bandit: 1 } },
});

export const HANDS_ITEMS = slotItems('hands', {
  ridingGloves: { name: 'Riding gloves', wornBy: { bandit: 2 } },
  workGloves: { name: 'Work gloves' },
  mailMittens: { name: 'Mail mittens', value: 70, soldBy: { smith: 1 } },
  gauntlets: { name: 'Gauntlets', value: 140, soldBy: { smith: 1 } },
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
  mailChausses: { name: 'Mail chausses', value: 150, soldBy: { smith: 1 } },
  plateGreaves: { name: 'Plate greaves', value: 200, soldBy: { smith: 1 } },
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
  sabatons: { name: 'Sabatons', value: 150, soldBy: { smith: 1 } },
  furBoots: { name: 'Fur boots' },
  redShoes: { name: 'Red shoes' },
  woodenClogs: { name: 'Wooden clogs' },
  feltSlippers: { name: 'Felt slippers' },
  hobnailBoots: { name: 'Hobnail boots', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 1 } },
});
