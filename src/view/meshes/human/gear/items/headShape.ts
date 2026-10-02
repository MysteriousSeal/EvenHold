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
// The layer just round the head's sides (not over it): a band, a crown's ring.
export const ringed = (c: HeadCell): boolean => c.x >= -1 && c.x <= L + 1 && c.z >= -1 && c.z <= L + 1 && (c.x === -1 || c.x === L + 1 || c.z === -1 || c.z === L + 1);
