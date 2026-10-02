// A crypt as a kind of dungeon (dungeons/dungeonTypes.ts): who it is (its
// name, level, its key by its ruin's corner), its inside (crypts.ts), its
// guards and lord run (cryptFoes.ts).

import type { DungeonKind } from '../dungeons/dungeonTypes';
import { cryptAt, cryptBlocks, cryptInside } from './crypts';
import { CryptFoes, cryptKey, guardCount } from './cryptFoes';

export const CRYPT_DUNGEON: DungeonKind = {
  place: (entrance) => {
    const crypt = cryptAt(entrance);
    return crypt && { kind: 'crypt', name: crypt.name, level: crypt.level, key: cryptKey(crypt) };
  },
  room: (seed, entrance) => cryptInside(seed, entrance).room,
  blocks: (seed, entrance) => {
    const inside = cryptInside(seed, entrance);
    return (x, z, r) => cryptBlocks(inside, x, z, r);
  },
  foeCount: (seed, entrance) => guardCount(seed, cryptInside(seed, entrance)),
  run: (seed, entrance, slain, hero, hooks) => new CryptFoes(seed, cryptInside(seed, entrance), slain, hero, hooks),
};
