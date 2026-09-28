// Money shown as figures, each followed by its coin (gold, silver, copper;
// styled in coins.css): for the purse and for coins looted.

import { coins } from '../../model/hero/money';
import './coins.css';

// `purse`: shown as a purse is (gold only once there's some, silver once
// there's gold or silver, copper always); otherwise just what's there.
export function coinParts(copper: number, purse = false): Array<string | HTMLElement> {
  const { gold, silver, copper: left } = coins(copper);
  const parts: Array<string | HTMLElement> = [];
  const add = (amount: number, metal: string) => {
    const coin = document.createElement('span');
    coin.className = `coin ${metal}`;
    coin.title = metal;
    parts.push(`${amount}`, coin);
  };
  if (gold > 0) add(gold, 'gold');
  if (silver > 0 || (purse && gold > 0)) add(silver, 'silver');
  if (left > 0 || purse) add(left, 'copper');
  return parts;
}
