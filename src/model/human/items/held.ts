// Everything held in a hand: weapons in the main hand; shields, a torch,
// a parrying dagger or a book in the off hand.

import { slotItems } from './item';

export const MAIN_HAND_ITEMS = slotItems('mainHand', {
  armingSword: { name: 'Arming sword' },
  shortSword: { name: 'Short sword', wornBy: { bandit: 3 } },
  woodenSword: { name: 'Wooden sword' },
  dagger: { name: 'Dagger', wornBy: { bandit: 2 } },
  hatchet: { name: 'Hatchet', wornBy: { bandit: 2 } },
  battleAxe: { name: 'Battle axe' },
  club: { name: 'Knotted club', wornBy: { bandit: 2 } },
  mace: { name: 'Mace', wornBy: { bandit: 1 } },
  warHammer: { name: 'War hammer' },
  spear: { name: 'Spear', wornBy: { bandit: 1 } },
  quarterstaff: { name: 'Quarterstaff' },
});

export const OFF_HAND_ITEMS = slotItems('offHand', {
  plankShield: { name: 'Plank shield' },
  buckler: { name: 'Buckler', wornBy: { bandit: 2 } },
  heaterShield: { name: 'Heater shield' },
  towerShield: { name: 'Tower shield' },
  pavise: { name: 'Pavise' },
  crestShield: { name: 'Sun crest shield' },
  bronzeTarge: { name: 'Bronze targe' },
  torch: { name: 'Torch', wornBy: { bandit: 1 } },
  parryingDagger: { name: 'Parrying dagger', wornBy: { bandit: 1 } },
  tome: { name: 'Leather tome' },
});
