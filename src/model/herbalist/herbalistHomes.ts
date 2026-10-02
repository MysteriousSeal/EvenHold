// Which houses are herbalists' (npcs.ts marks them as it spawns the
// herbalists): furnished as their shop and workroom (herbalistLayout.ts).

import type { Entrance } from '../interiors/interiors';

const homes = new WeakSet<Entrance>();
export const markHerbalistHome = (entrance: Entrance): void => void homes.add(entrance);
export const isHerbalistHome = (entrance: Entrance): boolean => homes.has(entrance);
