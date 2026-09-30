// Everything held in a hand: weapons in the main hand; shields, a torch,
// a parrying dagger or a book in the off hand.

import { slotItems } from './item';

export const MAIN_HAND_ITEMS = slotItems('mainHand', {
  armingSword: { name: 'Arming sword', value: 150, soldBy: { smith: 1 } },
  shortSword: { name: 'Short sword', value: 90, soldBy: { smith: 2 }, wornBy: { bandit: 3 } },
  woodenSword: { name: 'Wooden sword' },
  dagger: { name: 'Dagger', value: 40, soldBy: { smith: 2 }, wornBy: { bandit: 2 } },
  hatchet: { name: 'Hatchet', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 } },
  battleAxe: { name: 'Battle axe', value: 180, soldBy: { smith: 1 } },
  club: { name: 'Knotted club', wornBy: { bandit: 2 } },
  mace: { name: 'Mace', value: 120, soldBy: { smith: 1 }, wornBy: { bandit: 1 } },
  warHammer: { name: 'War hammer', value: 200, soldBy: { smith: 1 } },
  spear: { name: 'Spear', value: 70, soldBy: { smith: 2 }, wornBy: { bandit: 1 } },
  quarterstaff: { name: 'Quarterstaff' },
});

export const OFF_HAND_ITEMS = slotItems('offHand', {
  plankShield: { name: 'Plank shield' },
  buckler: { name: 'Buckler', value: 50, soldBy: { smith: 2 }, wornBy: { bandit: 2 } },
  heaterShield: { name: 'Heater shield', value: 110, soldBy: { smith: 1 } },
  towerShield: { name: 'Tower shield', value: 200, soldBy: { smith: 1 } },
  pavise: { name: 'Pavise', value: 180, soldBy: { smith: 1 } },
  crestShield: { name: 'Sun crest shield', value: 160, soldBy: { smith: 1 } },
  bronzeTarge: { name: 'Bronze targe', value: 100, soldBy: { smith: 1 } },
  torch: { name: 'Torch', wornBy: { bandit: 1 } },
  parryingDagger: { name: 'Parrying dagger', value: 60, soldBy: { smith: 1 }, wornBy: { bandit: 1 } },
  tome: { name: 'Leather tome' },
});
