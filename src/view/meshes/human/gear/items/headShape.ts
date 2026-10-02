// The head's measures, for what's sculpted round it (head.ts, helms.ts): an
// 11-voxel cube, 0..10, its face at the front (eyes on rows 4-6, brows on
// row 8, the mouth on row 2), ears on the sides at rows 4-6.

import type { HeadCell } from '../armorShell';

export const L = 10; // the head's last voxel (its front, its top, its far side)
export const M = 5; // its middle
export const onFace = (c: HeadCell): boolean => c.front && !c.flank; // before the face itself (not its corners)
// At a corner past the head, two sides out (a raised bit there would touch nothing).
export const cornered = (c: HeadCell): boolean => c.flank && (c.front || c.back);
export const within = (v: number, r: number): boolean => Math.abs(v - M) <= r; // within r of the middle
// Over the crown, within r of its middle (a dome, a cap rising, raised over the head).
export const domed = (c: HeadCell, r = 3): boolean => within(c.x, r) && within(c.z, r);
// The row a piece comes down to: `face` over the face, `sides` round the sides, `back` behind (the sides' if not said).
export const edgeOf = (c: HeadCell, face: number, sides: number, back = sides): number => (onFace(c) ? face : c.back ? back : sides);
// A band set with a rivet every third voxel round it.
export const riveted = (c: HeadCell, rivet: number, plate: number): number => (((c.x + c.z) % 3) + 3) % 3 === 0 ? rivet : plate;
// The layer just round the head's sides (not over it): a band, a crown's ring.
export const ringed = (c: HeadCell): boolean => c.x >= -1 && c.x <= L + 1 && c.z >= -1 && c.z <= L + 1 && (c.x === -1 || c.x === L + 1 || c.z === -1 || c.z === L + 1);
