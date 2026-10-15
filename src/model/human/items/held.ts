// Everything held in a hand: weapons in the main hand, each of its type (a sword, an axe…: what it's good for besides
// fighting, an axe felling trees: skills/lumber.ts); shields, a torch, a parrying dagger or a book in the off hand.

import { slotItems, type ItemEntry } from './item';

// What kind of weapon it is: every main-hand item has one.
export type WeaponType = 'sword' | 'dagger' | 'axe' | 'mace' | 'hammer' | 'club' | 'spear' | 'staff';

export const MAIN_HAND_ITEMS = slotItems('mainHand', {
  armingSword: { type: 'sword', name: 'Arming sword', value: 150, soldBy: { smith: 1 }, wornBy: { guard: 1 }, stats: { strength: 3 } },
  shortSword: { type: 'sword', name: 'Short sword', value: 90, soldBy: { smith: 2 }, wornBy: { bandit: 3 }, stats: { strength: 2, agility: 1 } },
  woodenSword: { type: 'sword', name: 'Wooden sword', stats: { strength: 1 } },
  dagger: { type: 'dagger', name: 'Dagger', value: 40, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, stats: { agility: 3 } },
  hatchet: { type: 'axe', name: 'Hatchet', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, stats: { strength: 2 } },
  battleAxe: { type: 'axe', name: 'Battle axe', value: 180, soldBy: { smith: 1 }, stats: { strength: 5 } },
  // A woodworker's (skills/woodworking.ts): a long-hafted felling axe, a chop a swing quicker; a broad axe, a second log oftener (skills/lumber.ts AXE_BONUS).
  fellingAxe: { type: 'axe', name: 'Felling axe', value: 30, stats: { strength: 3 } },
  broadAxe: { type: 'axe', name: 'Broad axe', value: 30, stats: { strength: 5, endurance: 1 } },
  club: { type: 'club', name: 'Knotted club', wornBy: { bandit: 2 }, stats: { strength: 2 } },
  mace: { type: 'mace', name: 'Mace', value: 120, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, stats: { strength: 4 } },
  warHammer: { type: 'hammer', name: 'War hammer', value: 200, soldBy: { smith: 1 }, stats: { strength: 5, stamina: 1 } },
  spear: { type: 'spear', name: 'Spear', value: 70, soldBy: { smith: 2 }, wornBy: { bandit: 1, guard: 1 }, stats: { strength: 2, agility: 2 } },
  quarterstaff: { type: 'staff', name: 'Quarterstaff', wornBy: { pilgrim: 1 }, stats: { agility: 1, endurance: 2 } },
  bandedCudgel: { type: 'club', name: 'Iron-banded cudgel', wornBy: { bouncer: 1 }, stats: { strength: 3 } }, // an inn's bouncer's, at his belt
  // The sets' (sets.ts): the watch's glaive at the smithy and in the guards' hands, a pilgrim's staff (and a dead one's, in the crypts), a flayer's knife
  // on a bandit now and then; the rest found.
  headsmansAxe: { type: 'axe', name: "Headsman's axe", set: 'headsman', level: 6, rarity: 'uncommon', value: 240, droppedBy: { sawbones: 1, bruiser: 1 }, stats: { strength: 5, stamina: 1 } },
  barrowBlade: { type: 'sword', name: 'Barrow blade', set: 'barrow', level: 4, value: 130, droppedBy: { draugr: 2, skeleton: 1 }, stats: { strength: 3, endurance: 1 } },
  flensingKnife: { type: 'dagger', name: 'Flensing knife', set: 'flayer', value: 50, wornBy: { bandit: 1 }, droppedBy: { sawbones: 1 }, stats: { agility: 3, strength: 1 } },
  pilgrimsStaff: { type: 'staff', name: "Pilgrim's staff", set: 'palmer', wornBy: { pilgrim: 2 }, droppedBy: { skeleton: 1, draugr: 1 }, stats: { agility: 1, endurance: 3 } },
  watchGlaive: { type: 'spear', name: "Watchman's glaive", set: 'watch', value: 170, soldBy: { smith: 1 }, wornBy: { guard: 1 }, stats: { strength: 3, agility: 2 } },
  courtSword: { type: 'sword', name: 'Court sword', set: 'velvet', level: 5, rarity: 'uncommon', value: 260, droppedBy: { banditChief: 1 }, stats: { agility: 3, strength: 2 } },
  blackbannerFalchion: { type: 'sword', name: 'Blackbanner falchion', set: 'blackbanner', level: 5, value: 140, droppedBy: { bruiser: 1, runner: 1, crossbowman: 1 }, stats: { strength: 4 } },
} satisfies Record<string, ItemEntry & { type: WeaponType }>);

export const OFF_HAND_ITEMS = slotItems('offHand', {
  plankShield: { name: 'Plank shield', armor: 2, stats: { stamina: 1 } },
  buckler: { name: 'Buckler', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, armor: 2, stats: { agility: 1 } },
  heaterShield: { name: 'Heater shield', value: 110, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 4, stats: { stamina: 2 } },
  towerShield: { name: 'Tower shield', value: 200, soldBy: { smith: 1 }, armor: 6, stats: { stamina: 3 } },
  pavise: { name: 'Pavise', value: 180, soldBy: { smith: 1 }, armor: 5, stats: { stamina: 2, endurance: 1 } },
  crestShield: { name: 'Sun crest shield', value: 160, soldBy: { smith: 1 }, armor: 4, stats: { strength: 1, stamina: 1 } },
  bronzeTarge: { name: 'Bronze targe', value: 100, soldBy: { smith: 1 }, armor: 3, stats: { strength: 1, agility: 1 } },
  torch: { name: 'Torch', wornBy: { bandit: 1 }, stats: { endurance: 2 } },
  parryingDagger: { name: 'Parrying dagger', value: 60, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, stats: { agility: 3 } },
  tome: { name: 'Leather tome', stats: { endurance: 3 } },
  // The sets' (sets.ts): the watch's shield at the smithy and on the guards' arms; the rest found.
  ossuaryWard: { name: 'Ossuary ward', set: 'ossuary', level: 8, rarity: 'uncommon', value: 170, droppedBy: { skeleton: 1, cryptLord: 1 }, armor: 4, stats: { stamina: 1, endurance: 2 } },
  smokingCenser: { name: 'Smoking censer', set: 'cinder', level: 8, rarity: 'uncommon', value: 110, droppedBy: { firebrand: 2 }, stats: { agility: 1, endurance: 3 } },
  watchShield: { name: "Watchman's shield", set: 'watch', value: 120, soldBy: { smith: 1 }, wornBy: { guard: 1 }, armor: 4, stats: { stamina: 2 } },
  sunwardAegis: { name: 'Sunward aegis', set: 'sunward', level: 16, rarity: 'legendary', value: 560, droppedBy: { cryptLord: 1 }, armor: 6, stats: { strength: 1, stamina: 3 } },
  blackbannerPavise: { name: 'Blackbanner pavise', set: 'blackbanner', level: 5, value: 150, droppedBy: { crossbowman: 2 }, armor: 5, stats: { stamina: 2 } },
});
