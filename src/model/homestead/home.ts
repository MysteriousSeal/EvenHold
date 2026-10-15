// The hero's cottage, as GameModel plays it: its furniture as built (going in, and again as it's bought or something's
// built in it, the room drawn afresh: view/interior/indoorScenes.ts), and what E does there: the reeve's notice read
// (bought), a spot chalked on the floor (built), the trophy wall looked at.

import type { GameModel } from '../GameModel';
import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import { buildUpgrade, buyCottage, ownsHere, pieceInReach, type UpgradeId } from './cottage';
import { furnishCottage } from './cottageLayout';
import { wallLine } from './trophies';

// The hero's own cottage's furniture, if `entrance` is it (null: any other building's, as laid out).
export function homeFurniture(m: Pick<GameModel, 'hero' | 'seed'>, entrance: Entrance): Furniture[] | null {
  if (!ownsHere(m.hero, entrance)) return null;
  return furnishCottage(layoutOf(m.seed, entrance).room, m.hero.cottage!, m.hero.trophies);
}

// The room they're in laid out again (a new list: the scene's built afresh from it), if it's their cottage.
export function refreshHome(m: GameModel): void {
  const inside = m.inside;
  const furniture = inside && !inside.below ? homeFurniture(m, inside.entrance) : null;
  if (inside && furniture) inside.furniture = furniture;
}

// What E does in a cottage, if anything: the notice of one for sale, a spot to build on, the trophy wall.
export type HomeAction = { kind: 'buy'; notice: Furniture } | { kind: 'build'; spot: Furniture; upgrade: UpgradeId } | { kind: 'trophies'; wall: Furniture };
export function homeAction(m: GameModel): HomeAction | null {
  if (m.seated || m.work.shift) return null;
  const notice = pieceInReach(m.inside, m.hero, 'saleNotice');
  if (notice) return { kind: 'buy', notice };
  if (!ownsHere(m.hero, m.inside?.entrance)) return null;
  const spot = pieceInReach(m.inside, m.hero, 'cottageSpot');
  if (spot?.upgrade) return { kind: 'build', spot, upgrade: spot.upgrade };
  const wall = pieceInReach(m.inside, m.hero, 'trophyWall');
  return wall ? { kind: 'trophies', wall } : null;
}

// Does it: bought, built, or the wall's trophies told. Whether anything came of it.
export function useHome(m: GameModel, action: HomeAction): boolean {
  const refresh = () => refreshHome(m);
  if (action.kind === 'buy') return buyCottage(m, refresh);
  if (action.kind === 'build') return buildUpgrade(m, action.upgrade, refresh);
  m.report({ kind: 'banner', title: 'Your trophies', line: wallLine(m.hero.trophies) });
  return true;
}
