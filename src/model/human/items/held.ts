// Everything held in a hand: weapons in the main hand; shields, a torch,
// a parrying dagger or a book in the off hand.

import { slotItems } from './item';

export const MAIN_HAND_ITEMS = slotItems('mainHand', {
  armingSword: { name: 'Arming sword', value: 150, soldBy: { smith: 1 }, stats: { strength: 3 } },
  shortSword: { name: 'Short sword', value: 90, soldBy: { smith: 2 }, wornBy: { bandit: 3 }, stats: { strength: 2, agility: 1 } },
  woodenSword: { name: 'Wooden sword', stats: { strength: 1 } },
  dagger: { name: 'Dagger', value: 40, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, stats: { agility: 3 } },
  hatchet: { name: 'Hatchet', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, stats: { strength: 2 } },
  battleAxe: { name: 'Battle axe', value: 180, soldBy: { smith: 1 }, stats: { strength: 5 } },
  club: { name: 'Knotted club', wornBy: { bandit: 2 }, stats: { strength: 2 } },
  mace: { name: 'Mace', value: 120, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, stats: { strength: 4 } },
  warHammer: { name: 'War hammer', value: 200, soldBy: { smith: 1 }, stats: { strength: 5, stamina: 1 } },
  spear: { name: 'Spear', value: 70, soldBy: { smith: 2 }, wornBy: { bandit: 1 }, stats: { strength: 2, agility: 2 } },
  quarterstaff: { name: 'Quarterstaff', stats: { agility: 1, endurance: 2 } },
  bandedCudgel: { name: 'Iron-banded cudgel', wornBy: { bouncer: 1 }, stats: { strength: 3 } }, // an inn's bouncer's, at his belt
});

export const OFF_HAND_ITEMS = slotItems('offHand', {
  plankShield: { name: 'Plank shield', armor: 2, stats: { stamina: 1 } },
  buckler: { name: 'Buckler', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 }, armor: 2, stats: { agility: 1 } },
  heaterShield: { name: 'Heater shield', value: 110, soldBy: { smith: 1 }, armor: 4, stats: { stamina: 2 } },
  towerShield: { name: 'Tower shield', value: 200, soldBy: { smith: 1 }, armor: 6, stats: { stamina: 3 } },
  pavise: { name: 'Pavise', value: 180, soldBy: { smith: 1 }, armor: 5, stats: { stamina: 2, endurance: 1 } },
  crestShield: { name: 'Sun crest shield', value: 160, soldBy: { smith: 1 }, armor: 4, stats: { strength: 1, stamina: 1 } },
  bronzeTarge: { name: 'Bronze targe', value: 100, soldBy: { smith: 1 }, armor: 3, stats: { strength: 1, agility: 1 } },
  torch: { name: 'Torch', wornBy: { bandit: 1 }, stats: { endurance: 2 } },
  parryingDagger: { name: 'Parrying dagger', value: 60, soldBy: { smith: 1 }, wornBy: { bandit: 1 }, stats: { agility: 3 } },
  tome: { name: 'Leather tome', stats: { endurance: 3 } },
});
