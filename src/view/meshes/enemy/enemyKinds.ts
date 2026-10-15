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
  bruiser: { name: 'Bruiser', size: 1.1, aura: 16, textHeight: 0.45 }, // (a stronghold's, strongholds/: a bandit's look till it has its own)
  crossbowman: { name: 'Crossbowman', size: 1, aura: 15, textHeight: 0.4 }, // (a bandit's look, for now)
  firebrand: { name: 'Firebrand', size: 1, aura: 15, textHeight: 0.4 }, // (a bandit's look, for now)
  sawbones: { name: 'Sawbones', size: 1, aura: 15, textHeight: 0.4 }, // (a bandit's look, for now)
  runner: { name: 'Runner', size: 0.95, aura: 15, textHeight: 0.4 }, // (a bandit's look, for now)
  witchFinder: { name: 'Witch-finder', size: 1, aura: 16, textHeight: 0.45 }, // (the bishop's man, in his grey coat and tall hat)
  warHound: { name: 'War hound', size: 1.15, aura: 20, textHeight: 0.4 }, // (a wolf's look, for now)
  houndmaster: { name: 'The houndmaster', size: 1.25, aura: 18, textHeight: 0.5 }, // (a chief's look, for now)
  quartermaster: { name: 'The quartermaster', size: 1.25, aura: 18, textHeight: 0.5 }, // (a chief's look, for now)
  gaoler: { name: 'The gaoler', size: 1.3, aura: 19, textHeight: 0.55 }, // (a chief's look, for now)
  captain: { name: 'The captain', size: 1.25, aura: 18, textHeight: 0.5 }, // (a chief's look, for now)
  banditKing: { name: 'The bandit king', size: 1.4, aura: 20, textHeight: 0.6 }, // (a chief's look, for now)
  unquietBrother: { name: 'Unquiet Brother', size: 1, aura: 16, textHeight: 0.45 }, // (the reliquary's, model/reliquary/: his hood over a man)
  gildedSaint: { name: 'Gilded saint', size: 1.1, aura: 16, textHeight: 0.45 },
  gildedDeacon: { name: 'The Gilded Deacon', size: 1.55, aura: 23, textHeight: 0.62 }, // (over the lords: every relic in the vault)
};
