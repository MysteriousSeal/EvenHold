// Humanoids (the hero, bandits, villagers) have a naked body of one of two
// builds, male or female (hers slimmer), and differ in its look: skin tone,
// hair color and style, a beard (his only). What
// they wear goes on over it (equipment.ts). The look is stored as indices;
// the view owns the actual colors (view/meshes/human/bodyVoxels.ts).

import { hashUnit } from '../../util/random';
import type { Equipment } from './equipment';

export const SKIN_TONE_COUNT = 8; // (the last four added after: pale, dark, olive, bronze; saves keep their numbers)
export const HAIR_COLOR_COUNT = 8; // (the last three added after: platinum, auburn, white; saves keep their numbers)
export const DYE_COUNT = 8; // what their underwear's dyed (bodyVoxels.ts DYES; the last two added after: saffron, orchil)
export const HAIR_STYLES = ['short', 'long', 'cropped', 'bald', 'braid', 'bun', 'ponytail', 'twinBraids', 'crownBraid', 'waves', 'pigtails', 'bob', 'topknot', 'shaggy', 'warriorTail'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Build = 'male' | 'female';
// The styles each build is drawn with (anyone can wear any, e.g. by a cheat).
export const STYLES_OF: Record<Build, readonly HairStyle[]> = {
  male: ['short', 'long', 'cropped', 'bald', 'shaggy', 'warriorTail'],
  female: ['long', 'braid', 'bun', 'ponytail', 'short', 'twinBraids', 'crownBraid', 'waves', 'pigtails', 'bob', 'topknot'],
};

export interface BodyLook {
  build: Build;
  skin: number; // 0 .. SKIN_TONE_COUNT - 1
  hair: number; // 0 .. HAIR_COLOR_COUNT - 1
  dye: number; // their braies (and her breast band): 0 .. DYE_COUNT - 1
  hairStyle: HairStyle;
  beard: boolean;
}

export interface Humanoid {
  look: BodyLook;
  equipment: Equipment;
}

export const HERO_LOOK: Readonly<BodyLook> = { build: 'male', skin: 0, hair: 0, dye: 1, hairStyle: 'short', beard: false };

// A look picked at random (a new hero each game): a man or a woman, anyone.
export function randomLook(): BodyLook {
  const roll = () => Math.floor(Math.random() * 1_000_000);
  return lookAt(roll(), roll(), roll(), 0.5);
}

// A look picked from a place (e.g. where someone spawned): the same spot
// always gives the same person. `seed`, if given, makes it the world's own:
// the same spot in another world gives someone else. `female`: the chance
// they're a woman (0, never; 1, always).
export function lookAt(x: number, z: number, seed = 0, female = 0): BodyLook {
  const pick = (count: number, salt: number) => Math.floor(hashUnit(x, z, seed * 131 + salt) * count);
  const build: Build = hashUnit(x, z, seed * 131 + 45) < female ? 'female' : 'male';
  const styles = STYLES_OF[build];
  return {
    build,
    skin: pick(SKIN_TONE_COUNT, 41),
    hair: pick(HAIR_COLOR_COUNT, 42),
    dye: pick(DYE_COUNT, 46),
    hairStyle: styles[pick(styles.length, 43)],
    beard: build === 'male' && hashUnit(x, z, seed * 131 + 44) < 0.5,
  };
}
