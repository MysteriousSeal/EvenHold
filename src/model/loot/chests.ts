// The chest the hero's at, whichever it is (one E opens): a crypt lord's chest or a brood mother's hoard down in
// their dungeon (dungeons/dungeonTypes.ts), else a bandit camp's out in the world (camps/campLife.ts: locked while
// its chief stands).

import type { GameModel } from '../GameModel';
import { chestOf } from '../camps/campLife';

export interface ChestInReach {
  x: number;
  y: number; // its lid's height, where its prompt's shown
  z: number;
  what: 'chest' | 'hoard' | 'locked'; // (a hoard: silk-wrapped, torn open; locked: its keeper still standing)
  open(): void;
}

export function chestInReach(model: GameModel): ChestInReach | null {
  const { hero, dungeon } = model;
  if (dungeon) {
    const chest = dungeon.chestInReach(hero) && dungeon.chest;
    return chest ? { x: chest.x, y: 0.8, z: chest.z, what: model.cave ? 'hoard' : 'chest', open: () => dungeon.openChest() } : null;
  }
  const camp = model.inside ? null : model.campLife.chestInReach(hero);
  if (!camp) return null;
  const { x, z } = chestOf(camp);
  return { x, y: model.getGroundY(x, z) + 0.55, z, what: model.campLife.locked(camp) ? 'locked' : 'chest', open: () => model.campLife.openChest(camp) };
}
