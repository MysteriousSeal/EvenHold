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
  fellingAxe: { type: 'axe', name: 'Felling axe', value: 140, stats: { strength: 3 } },
  broadAxe: { type: 'axe', name: 'Broad axe', value: 320, stats: { strength: 5, endurance: 1 } },
  club: { type: 'club', name: 'Knotted club', wornBy: { bandit: 2 }, stats: { strength: 2 } },
  mace: { type: 'mace', name: 'Mace', value: 120, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, stats: { strength: 4 } },
  warHammer: { type: 'hammer', name: 'War hammer', value: 200, soldBy: { smith: 1 }, stats: { strength: 5, stamina: 1 } },
  spear: { type: 'spear', name: 'Spear', value: 70, soldBy: { smith: 2 }, wornBy: { bandit: 1, guard: 1 }, stats: { strength: 2, agility: 2 } },
  quarterstaff: { type: 'staff', name: 'Quarterstaff', wornBy: { pilgrim: 1 }, stats: { agility: 1, endurance: 2 } },
  bandedCudgel: { type: 'club', name: 'Iron-banded cudgel', wornBy: { bouncer: 1 }, stats: { strength: 3 } }, // an inn's bouncer's, at his belt
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
});
