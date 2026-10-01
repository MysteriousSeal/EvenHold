// Ashlar, as the old stone is laid wherever it stands (the ruins' walls and
// their crypts' tombs: meshes/ruin/; the crypts' rock: crypt/cryptWallVoxels.ts):
// chunky blocks in courses five high, their lengths varied course to course
// (the joints never in line), the joints in mortar, sunk where they meet the
// face; each block its own tone, its top edge catching the light and its foot
// in shade. Laid out 25 voxels (a tile) at a time; in whatever palette's tones.

import { hashUnit } from '../../../util/random';

export interface Tones {
  stone: number;
  dark: number;
  light: number;
  mortar: number;
}

const COURSE = 5;
// Where the joints fall along each course (between them, a block), by course.
const JOINTS = [
  [8, 16],
  [5, 12, 19],
  [10, 17],
  [6, 13, 20],
];

// Which block of its course `along` is in, `y` up from the ashlar's foot (-1: a joint).
export function ashlarBlock(along: number, y: number, variant: number): number {
  const joints = JOINTS[(Math.floor(y / COURSE) + variant) % JOINTS.length];
  const at = ((along % 25) + 25) % 25;
  return y % COURSE === COURSE - 1 || joints.includes(at) ? -1 : joints.filter((j) => j < at).length + Math.floor(along / 25) * 4;
}

// The stone at `along`, `y` up: a joint's mortar (0 on the `face`: sunk), or the block's tone, lit along its top edge.
export function ashlarStone(tones: Tones, along: number, y: number, face: boolean, variant: number, salt: number): number {
  const block = ashlarBlock(along, y, variant);
  if (block < 0) return face ? 0 : tones.mortar;
  const [course, row] = [Math.floor(y / COURSE), y % COURSE];
  const tone = [tones.stone, tones.dark, tones.stone, tones.light][Math.floor(hashUnit(block * 7 + course, variant, salt) * 4)];
  return face && row === COURSE - 2 ? (tone === tones.dark ? tones.stone : tones.light) : face && row === 0 ? tones.dark : tone;
}
