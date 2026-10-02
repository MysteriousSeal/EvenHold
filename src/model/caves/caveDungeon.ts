// A cave as a kind of dungeon (dungeons/dungeonTypes.ts): who it is (its
// name, level, its key by its mouth), its inside (caves.ts), its beasts and
// their brood mother run (caveFoes.ts).

import type { DungeonKind } from '../dungeons/dungeonTypes';
import { caveAt, caveBlocks, caveInside, caveKey } from './caves';
import { CaveRun, beastCount } from './caveFoes';

export const CAVE_DUNGEON: DungeonKind = {
  place: (entrance) => {
    const cave = caveAt(entrance);
    return cave && { kind: 'cave', name: cave.name, level: cave.level, key: caveKey(cave) };
  },
  room: (seed, entrance) => caveInside(seed, entrance).room,
  blocks: (seed, entrance) => {
    const inside = caveInside(seed, entrance);
    return (x, z, r) => caveBlocks(inside, x, z, r);
  },
  foeCount: (seed, entrance) => beastCount(seed, caveInside(seed, entrance)),
  run: (seed, entrance, slain, hero, hooks) => new CaveRun(seed, caveInside(seed, entrance), slain, hero, hooks),
};
