// A dungeon's scene and what moves in it, by its kind (model/dungeons/): a
// crypt's (crypt/cryptView.ts, cryptLife.ts), a cave's (cave/caveView.ts,
// caveLife.ts); null for any other way in (a building's room).

import type { GameModel } from '../../model/GameModel';
import type { Entrance } from '../../model/interiors/interiors';
import { cryptInside } from '../../model/crypts/crypts';
import { caveInside } from '../../model/caves/caves';
import { buildCryptScene } from '../crypt/cryptView';
import { CryptLife } from '../crypt/cryptLife';
import { buildCaveScene } from '../cave/caveView';
import { CaveLife } from '../cave/caveLife';

// What moves in a dungeon's scene: drawn each frame from the model; how hard its floor's shaking (the camera's to shake by).
export interface DungeonLife {
  update(model: GameModel, dt: number): void;
  readonly rumble: number;
  dispose(): void;
}

export type DungeonScene = ReturnType<typeof buildCryptScene> & { life: DungeonLife };

export function buildDungeonScene(seed: number, entrance: Entrance): DungeonScene | null {
  if (entrance.type === 'crypt') {
    const inside = cryptInside(seed, entrance);
    const built = buildCryptScene(inside);
    return { ...built, life: new CryptLife(built.scene, inside) };
  }
  if (entrance.type === 'cave') {
    const inside = caveInside(seed, entrance);
    const built = buildCaveScene(inside);
    return { ...built, life: new CaveLife(built.scene, inside) };
  }
  return null;
}
