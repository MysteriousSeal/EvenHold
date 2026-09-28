// Humanoids (the hero, bandits, and later villagers) share one naked body
// and differ in its look: skin tone, hair color and style, a beard. What
// they wear goes on over it (equipment.ts). The look is stored as indices;
// the view owns the actual colors (view/meshes/human/bodyVoxels.ts).

import { hashUnit } from '../../util/random';
import type { Equipment } from './equipment';

export const SKIN_TONE_COUNT = 4;
export const HAIR_COLOR_COUNT = 5;
export const HAIR_STYLES = ['short', 'long', 'cropped', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export interface BodyLook {
  skin: number; // 0 .. SKIN_TONE_COUNT - 1
  hair: number; // 0 .. HAIR_COLOR_COUNT - 1
  hairStyle: HairStyle;
  beard: boolean;
}

export interface Humanoid {
  look: BodyLook;
  equipment: Equipment;
}

export const HERO_LOOK: Readonly<BodyLook> = { skin: 0, hair: 0, hairStyle: 'short', beard: false };

// A look picked from a place (e.g. where someone spawned): the same spot
// always gives the same person.
export function lookAt(x: number, z: number): BodyLook {
  const pick = (count: number, salt: number) => Math.floor(hashUnit(x, z, salt) * count);
  return {
    skin: pick(SKIN_TONE_COUNT, 41),
    hair: pick(HAIR_COLOR_COUNT, 42),
    hairStyle: HAIR_STYLES[pick(HAIR_STYLES.length, 43)],
    beard: hashUnit(x, z, 44) < 0.5,
  };
}
