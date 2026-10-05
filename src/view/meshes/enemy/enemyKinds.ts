// How each kind of foe is shown, all in one place (model/constants.ts:
// ENEMY_STATS is how each one fights): what it's called (over its head, in the
// target panel, unless it has a name of its own); how big it's drawn, over the
// rest (a crypt's lord, a draugr, the brood mother bigger; a hatchling small);
// its quest aura's size, voxels across (four-legged ones are longer); and how
// high a hit's number floats over it (about two thirds of the way up). Its rig
// and its portrait are its own (enemyViews.ts, hud/targetHud.ts).

import type { EnemyKind } from '../../../model/types';

export interface KindLook {
  name: string;
  size: number;
  aura: number;
  textHeight: number;
}

export const KIND_LOOKS: Record<EnemyKind, KindLook> = {
  wolf: { name: 'Wolf', size: 1, aura: 19, textHeight: 0.35 },
  bandit: { name: 'Bandit', size: 1, aura: 15, textHeight: 0.4 },
  banditChief: { name: 'Bandit chief', size: 1.2, aura: 18, textHeight: 0.5 }, // (over his bandits: broad, horned; named for his camp)
  boar: { name: 'Boar', size: 1, aura: 19, textHeight: 0.3 },
  bear: { name: 'Brown bear', size: 1, aura: 23, textHeight: 0.45 },
  lynx: { name: 'Lynx', size: 1, aura: 17, textHeight: 0.3 },
  ghost: { name: 'Ghost', size: 1, aura: 15, textHeight: 0.45 },
  skeleton: { name: 'Skeleton', size: 1, aura: 15, textHeight: 0.4 },
  skeletonArcher: { name: 'Skeleton archer', size: 1, aura: 15, textHeight: 0.4 },
  draugr: { name: 'Draugr', size: 1.15, aura: 17, textHeight: 0.45 }, // (over a man)
  cryptLord: { name: 'Crypt lord', size: 1.5, aura: 22, textHeight: 0.6 }, // (over his guards)
  caveSpider: { name: 'Cave spider', size: 1, aura: 19, textHeight: 0.2 },
  caveBat: { name: 'Cave bat', size: 1, aura: 15, textHeight: 0.3 },
  caveWorm: { name: 'Cave worm', size: 1, aura: 17, textHeight: 0.35 },
  hatchling: { name: 'Hatchling', size: 0.5, aura: 15, textHeight: 0.15 },
  broodMother: { name: 'The brood mother', size: 1.3, aura: 24, textHeight: 0.55 }, // (her grid half again a spider's already)
};
