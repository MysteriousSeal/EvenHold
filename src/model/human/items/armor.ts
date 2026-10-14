// Everything worn on the body, slot by slot.

import { slotItems } from './item';

export const HEAD_ITEMS = slotItems('head', {
  leatherCap: { name: 'Leather cap', armor: 2, stats: { agility: 1 }, openBack: true },
  maskedHood: { name: 'Hood and mask', wornBy: { bandit: 3 }, armor: 1, stats: { agility: 2 } },
  redBandana: { name: 'Red bandana', wornBy: { bandit: 2 }, stats: { agility: 1 }, openBack: true },
  nasalCap: { name: 'Nasal cap', value: 60, soldBy: { smith: 2 }, wornBy: { bandit: 2, guard: 2 }, armor: 4, stats: { stamina: 1 }, openBack: true },
  linenCoif: { name: 'Linen coif', wornBy: { pedlar: 1, pilgrim: 1 }, armor: 1, stats: { endurance: 1 } },
  strawHat: { name: 'Straw hat', wornBy: { pedlar: 2 }, stats: { endurance: 2 }, openBack: true },
  greatHelm: { name: 'Great helm', value: 220, soldBy: { smith: 1 }, armor: 6, stats: { stamina: 3 } },
  mailCoif: { name: 'Mail coif', value: 110, soldBy: { smith: 1 }, wornBy: { bandit: 1, guard: 1 }, armor: 4, stats: { stamina: 2 } },
  huntersHood: { name: "Hunter's hood", wornBy: { bandit: 1 }, armor: 1, stats: { agility: 2 } },
  circlet: { name: 'Gold circlet', stats: { stamina: 1, endurance: 2 }, openBack: true },
  // The finer helms: some at the smithy or on the roads' guards, the rarest only in a crypt lord's hoard (worth 100 and more).
  kettleHat: { name: 'Kettle hat', value: 80, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 4, stats: { stamina: 1, endurance: 1 }, openBack: true },
  bascinet: { name: 'Bascinet', value: 180, soldBy: { smith: 1 }, armor: 6, stats: { stamina: 2, strength: 1 } },
  barbute: { name: 'Barbute', value: 160, soldBy: { smith: 1 }, armor: 5, stats: { strength: 1, stamina: 2 } },
  sallet: { name: 'Sallet', value: 140, wornBy: { guard: 1 }, armor: 5, stats: { agility: 1, stamina: 2 } },
  hornedHelm: { name: 'Horned helm', value: 200, wornBy: { bandit: 1 }, armor: 5, stats: { strength: 3 }, openBack: true },
  wingedHelm: { name: 'Winged helm', value: 260, armor: 5, stats: { agility: 2, endurance: 2 }, openBack: true },
  elvenCirclet: { name: 'Elven circlet', value: 240, armor: 1, stats: { agility: 2, endurance: 3 }, openBack: true },
  boneHelm: { name: 'Bone helm', value: 150, armor: 4, stats: { strength: 2, stamina: 1 } },
  dragonHelm: { name: 'Dragonscale helm', value: 360, armor: 7, stats: { strength: 2, stamina: 3 } },
  royalCrown: { name: "Old king's crown", value: 400, armor: 1, stats: { strength: 2, stamina: 2, endurance: 2 }, openBack: true },
  // The sets' (sets.ts): a gaol's, the barrows', the crypts' bone-wrights', the fire-cult's, the pilgrims', and a lost order's.
  headsmansHood: { name: "Headsman's hood", set: 'headsman', level: 6, rarity: 'uncommon', value: 120, droppedBy: { bruiser: 2, sawbones: 2 }, armor: 3, stats: { strength: 3 } },
  barrowHelm: { name: 'Barrow helm', set: 'barrow', level: 4, value: 110, droppedBy: { draugr: 3, skeleton: 1, cryptLord: 1 }, armor: 5, stats: { stamina: 2, endurance: 1 } },
  ossuaryMask: { name: 'Ossuary mask', set: 'ossuary', level: 8, rarity: 'uncommon', value: 170, droppedBy: { skeleton: 1, skeletonArcher: 1, cryptLord: 2 }, armor: 3, stats: { strength: 2, endurance: 2 } },
  cinderCowl: { name: 'Cinder cowl', set: 'cinder', level: 8, rarity: 'uncommon', value: 130, droppedBy: { firebrand: 3 }, armor: 2, stats: { agility: 2, endurance: 2 } },
  palmerHat: { name: "Palmer's hat", set: 'palmer', wornBy: { pilgrim: 3 }, armor: 1, stats: { endurance: 2 }, openBack: true },
  sunwardArmet: { name: 'Sunward armet', set: 'sunward', level: 15, rarity: 'legendary', value: 520, droppedBy: { cryptLord: 1 }, armor: 7, stats: { strength: 2, stamina: 3 } },
});

export const SHOULDERS_ITEMS = slotItems('shoulders', {
  leatherPauldrons: { name: 'Leather pauldrons', wornBy: { bandit: 2, guard: 1 }, armor: 2, stats: { agility: 1 } },
  ironPauldrons: { name: 'Iron pauldrons', value: 90, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 4, stats: { strength: 1, stamina: 1 } },
  furMantle: { name: 'Fur mantle', wornBy: { bandit: 1 }, armor: 2, stats: { endurance: 2 } },
  quiltedPads: { name: 'Quilted pads', armor: 2, stats: { stamina: 1 } },
  mailMantle: { name: 'Mail mantle', value: 110, soldBy: { smith: 1 }, armor: 4, stats: { stamina: 2 } },
  bronzeSpaulders: { name: 'Bronze spaulders', value: 100, soldBy: { smith: 1 }, armor: 4, stats: { strength: 2 } },
  woolShawl: { name: 'Wool shawl', wornBy: { pedlar: 2 }, armor: 1, stats: { endurance: 1 } },
  studdedPauldrons: { name: 'Studded pauldrons', value: 70, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, armor: 3, stats: { agility: 1, stamina: 1 } },
  goldEpaulettes: { name: 'Gold epaulettes', armor: 1, stats: { strength: 1, endurance: 1 } },
  ropeWraps: { name: 'Rope wraps', wornBy: { bandit: 1 }, stats: { agility: 1 } },
  // The sets' (sets.ts).
  barrowSpaulders: { name: 'Rusted spaulders', set: 'barrow', level: 4, value: 80, droppedBy: { draugr: 2, skeleton: 1 }, armor: 4, stats: { stamina: 1 } },
  ribcagePauldrons: { name: 'Ribcage pauldrons', set: 'ossuary', level: 8, rarity: 'uncommon', value: 140, droppedBy: { skeleton: 1, cryptLord: 1 }, armor: 3, stats: { strength: 2 } },
  flayersMantle: { name: "Flayer's mantle", set: 'flayer', value: 50, wornBy: { bandit: 1 }, droppedBy: { banditChief: 1 }, armor: 2, stats: { strength: 1, endurance: 1 } },
  palmersCape: { name: "Palmer's cape", set: 'palmer', wornBy: { pilgrim: 2 }, armor: 1, stats: { endurance: 2 } },
  sunwardPauldrons: { name: 'Sunward pauldrons', set: 'sunward', level: 14, rarity: 'epic', value: 380, droppedBy: { cryptLord: 1, broodMother: 1 }, armor: 5, stats: { strength: 1, stamina: 1 } },
});

export const TORSO_ITEMS = slotItems('torso', {
  gambeson: { name: 'Gambeson', armor: 4, stats: { stamina: 2 } },
  leatherVest: { name: 'Leather vest', wornBy: { bandit: 3 }, armor: 4, stats: { agility: 2 } },
  patchedTunic: { name: 'Patched tunic', wornBy: { bandit: 2, pedlar: 1 }, armor: 1, stats: { endurance: 1 } },
  furJerkin: { name: 'Fur-collared jerkin', wornBy: { bandit: 2 }, armor: 3, stats: { endurance: 3 } },
  chainMail: { name: 'Chain mail', value: 240, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 8, stats: { stamina: 3 } },
  tabard: { name: 'EvenHold tabard', wornBy: { guard: 2 }, armor: 2, stats: { strength: 1, stamina: 1 } },
  breastplate: { name: 'Breastplate', value: 320, soldBy: { smith: 1 }, armor: 10, stats: { strength: 1, stamina: 3 } },
  linenShirt: { name: 'Linen shirt', wornBy: { bandit: 1, pedlar: 1 }, armor: 1, stats: { endurance: 1 } },
  studdedJerkin: { name: 'Studded jerkin', wornBy: { bouncer: 1 }, armor: 5, stats: { strength: 1, stamina: 2 } }, // an inn's bouncer's
  travelCloak: { name: 'Travel cloak', wornBy: { bandit: 1, pedlar: 2, pilgrim: 3 }, armor: 2, stats: { agility: 1, endurance: 2 } },
  brigandine: { name: 'Brigandine', value: 200, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, armor: 7, stats: { agility: 1, stamina: 2 } },
  // The sets' (sets.ts): the watch's brigandine at the smithy and on the roads' guards; the rest found.
  headsmansApron: { name: "Headsman's apron", set: 'headsman', level: 6, rarity: 'uncommon', value: 120, droppedBy: { bruiser: 1, sawbones: 2 }, armor: 4, stats: { strength: 3 } },
  barrowHauberk: { name: 'Barrow hauberk', set: 'barrow', level: 4, value: 180, droppedBy: { draugr: 2 }, armor: 8, stats: { stamina: 2 } },
  cinderRobe: { name: 'Cinder robe', set: 'cinder', level: 8, rarity: 'uncommon', value: 160, droppedBy: { firebrand: 2 }, armor: 3, stats: { agility: 1, endurance: 4 } },
  watchBrigandine: { name: "Watchman's brigandine", set: 'watch', value: 220, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 7, stats: { strength: 1, stamina: 2 } },
  sunwardCuirass: { name: 'Sunward cuirass', set: 'sunward', level: 16, rarity: 'legendary', value: 600, droppedBy: { cryptLord: 1 }, armor: 10, stats: { strength: 2, stamina: 3 } },
  velvetDoublet: { name: 'Velvet doublet', set: 'velvet', level: 5, rarity: 'uncommon', value: 200, droppedBy: { banditChief: 1 }, armor: 2, stats: { agility: 2, endurance: 3 } },
});

export const HANDS_ITEMS = slotItems('hands', {
  ridingGloves: { name: 'Riding gloves', wornBy: { bandit: 2, guard: 1 }, armor: 1, stats: { agility: 1 } },
  workGloves: { name: 'Work gloves', wornBy: { pedlar: 1 }, armor: 1, stats: { strength: 1 } },
  mailMittens: { name: 'Mail mittens', value: 70, soldBy: { smith: 1 }, armor: 2, stats: { stamina: 1 } },
  gauntlets: { name: 'Gauntlets', value: 140, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 3, stats: { strength: 2 } },
  handWraps: { name: 'Hand wraps', wornBy: { bandit: 1 }, stats: { strength: 1 } },
  fingerlessGloves: { name: 'Fingerless gloves', wornBy: { bandit: 1 }, armor: 1, stats: { agility: 2 } },
  furMittens: { name: 'Fur mittens', armor: 1, stats: { endurance: 1 } },
  embroideredGloves: { name: 'Embroidered gloves', armor: 1, stats: { endurance: 1 } },
  leatherBracers: { name: 'Leather bracers', wornBy: { bandit: 1 }, armor: 2, stats: { agility: 1 } },
  silkGloves: { name: 'Silk gloves', stats: { agility: 1 } },
  studdedBracers: { name: 'Studded bracers', wornBy: { bouncer: 1 }, armor: 2, stats: { strength: 1 } }, // an inn's bouncer's
  // The sets' (sets.ts).
  headsmansGloves: { name: "Headsman's gloves", set: 'headsman', level: 6, rarity: 'uncommon', value: 90, droppedBy: { bruiser: 1, sawbones: 1 }, armor: 2, stats: { strength: 2 } },
  knucklebones: { name: 'Knucklebone gauntlets', set: 'ossuary', level: 8, rarity: 'uncommon', value: 120, droppedBy: { skeleton: 1, skeletonArcher: 1 }, armor: 2, stats: { strength: 2, agility: 1 } },
  cinderWraps: { name: 'Cinder wraps', set: 'cinder', level: 8, rarity: 'uncommon', value: 80, droppedBy: { firebrand: 2 }, armor: 1, stats: { agility: 2, endurance: 1 } },
  watchVambraces: { name: "Watchman's vambraces", set: 'watch', value: 90, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 3, stats: { stamina: 1 } },
  sunwardGauntlets: { name: 'Sunward gauntlets', set: 'sunward', level: 14, rarity: 'epic', value: 360, droppedBy: { cryptLord: 1, broodMother: 1 }, armor: 3, stats: { strength: 3 } },
});

export const LEGS_ITEMS = slotItems('legs', {
  woolHose: { name: 'Wool hose', wornBy: { pedlar: 1, pilgrim: 1 }, armor: 1, stats: { endurance: 1 } },
  beltedTrousers: { name: 'Belted trousers', wornBy: { bandit: 2, bouncer: 1, guard: 1 }, armor: 2, stats: { stamina: 1 } },
  ropeTrousers: { name: 'Rope-belted trousers', wornBy: { bandit: 2, pilgrim: 1 }, armor: 1, stats: { agility: 1 } },
  mailChausses: { name: 'Mail chausses', value: 150, soldBy: { smith: 1 }, armor: 5, stats: { stamina: 2 } },
  plateGreaves: { name: 'Plate greaves', value: 200, soldBy: { smith: 1 }, armor: 6, stats: { strength: 1, stamina: 2 } },
  plaidKilt: { name: 'Plaid kilt', wornBy: { bandit: 1 }, armor: 1, stats: { endurance: 2 } },
  leatherBreeches: { name: 'Leather breeches', wornBy: { bandit: 1 }, armor: 3, stats: { agility: 2 } },
  stripedHose: { name: 'Striped hose', armor: 1, stats: { agility: 1 } },
  paddedChausses: { name: 'Padded chausses', wornBy: { guard: 1 }, armor: 3, stats: { stamina: 1 } },
  linenTrousers: { name: 'Linen trousers', wornBy: { pedlar: 2 }, armor: 1, stats: { endurance: 1 } },
});

export const FEET_ITEMS = slotItems('feet', {
  leatherBoots: { name: 'Leather boots', wornBy: { pedlar: 1, guard: 1 }, armor: 2, stats: { agility: 1 } },
  blackBoots: { name: 'Black boots', wornBy: { bandit: 2, guard: 1 }, armor: 2, stats: { agility: 1, stamina: 1 } },
  footWraps: { name: 'Foot wraps', wornBy: { bandit: 1, pedlar: 1, pilgrim: 1 }, stats: { endurance: 1 } },
  sandals: { name: 'Sandals', wornBy: { bandit: 1, pedlar: 1, pilgrim: 2 }, stats: { agility: 1 } },
  sabatons: { name: 'Sabatons', value: 150, soldBy: { smith: 1 }, armor: 3, stats: { stamina: 2 } },
  furBoots: { name: 'Fur boots', armor: 1, stats: { endurance: 2 } },
  redShoes: { name: 'Red shoes', stats: { agility: 2 } },
  woodenClogs: { name: 'Wooden clogs', armor: 1, stats: { stamina: 1 } },
  feltSlippers: { name: 'Felt slippers', stats: { endurance: 1 } },
  ironCapBoots: { name: 'Iron-capped boots', wornBy: { bouncer: 1 }, armor: 3, stats: { stamina: 1 } }, // an inn's bouncer's
  hobnailBoots: { name: 'Hobnail boots', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 1 }, armor: 2, stats: { strength: 1, endurance: 1 } },
});
