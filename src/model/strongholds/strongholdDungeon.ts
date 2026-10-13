// A bandit stronghold as a kind of dungeon (dungeons/dungeonTypes.ts): who it
// is (its name, level, its key by its gate), its inside (strongholds.ts), its
// packs, its wings' bosses and its king run (strongholdFoes.ts).

import type { DungeonKind } from '../dungeons/dungeonTypes';
import { strongholdAt, strongholdBlocks, strongholdInside, strongholdKey } from './strongholds';
import { StrongholdRun, strongholdFoeCount } from './strongholdFoes';

export const STRONGHOLD_DUNGEON: DungeonKind = {
  place: (entrance) => {
    const stronghold = strongholdAt(entrance);
    return stronghold && { kind: 'stronghold', name: stronghold.name, level: stronghold.level, key: strongholdKey(stronghold) };
  },
  room: (seed, entrance) => strongholdInside(seed, entrance).room,
  blocks: (seed, entrance) => {
    const inside = strongholdInside(seed, entrance);
    return (x, z, r) => strongholdBlocks(inside, x, z, r);
  },
  foeCount: (seed, entrance) => strongholdFoeCount(seed, strongholdInside(seed, entrance)),
  run: (seed, entrance, slain, hero, hooks) => new StrongholdRun(seed, strongholdInside(seed, entrance), slain, hero, hooks),
};
