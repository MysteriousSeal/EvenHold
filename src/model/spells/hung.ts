// Where a painting hangs (turned.ts: someone turned into one, in a building's room): on the nearest free stretch of
// one of the room's two full walls, the far one (-Z: `back`) and the left one (-X: `left`); the other two are cut
// down to the knee for the camera (view/interior/roomVoxels.ts), and nothing hangs on them. A stretch is a floor
// tile's width of wall, named by the floor tile under it; free where nothing stands against a wall or hangs on one
// there (interiors/furniture.ts: a piece with a wall of its own; what stands free on the floor, a barrel, a chair, is
// low enough to hang over), no stairs climb past it, and no other painting has it.
import type { Furniture } from '../interiors/furniture';
import type { Room } from '../interiors/interiors';
import type { Point } from '../map/obstacles';

export type WallSide = 'back' | 'left';
export interface Hung {
  wall: WallSide;
  x: number; // the floor tile under it (back: any column, row 0; left: column 0, any row)
  z: number;
}
// The way each wall faces, into the room (as anyone's facing: 0 toward +Z, the camera; a quarter turn, toward +X).
export const HUNG_FACING: Record<WallSide, number> = { back: 0, left: Math.PI / 2 };
// Where on the floor's plan it hangs: on the wall's inner face, the middle of its tile's width.
export const hungAt = (hung: Hung): Point => (hung.wall === 'back' ? { x: hung.x, z: -0.5 } : { x: -0.5, z: hung.z });
// Whether a save's is one (whole tiles, on a wall there could be).
export const soundHung = (hung: unknown): hung is Hung => {
  const h = hung as Hung | null;
  return !!h && typeof h === 'object' && Number.isInteger(h.x) && Number.isInteger(h.z) && h.x >= 0 && h.z >= 0 && ((h.wall === 'back' && h.z === 0) || (h.wall === 'left' && h.x === 0));
};

// The stretch of wall nearest `from` (someone stood in `room`) that's free; none: null. `taken`: those hung there already.
export function wallFor(room: Room, furniture: readonly Furniture[], taken: readonly Hung[], from: Point): Hung | null {
  const covered = (x: number, z: number) => furniture.some((f) => (f.wall !== 'none' || f.kind === 'stairs') && x >= f.x && x < f.x + f.w && z >= f.z && z < f.z + f.d);
  const spots: Hung[] = [...Array.from({ length: room.width }, (_, x): Hung => ({ wall: 'back', x, z: 0 })), ...Array.from({ length: room.depth }, (_, z): Hung => ({ wall: 'left', x: 0, z }))];
  const far = (hung: Hung) => Math.hypot(hungAt(hung).x - from.x, hungAt(hung).z - from.z);
  const free = spots.filter((s) => !covered(s.x, s.z) && !taken.some((t) => t.wall === s.wall && t.x === s.x && t.z === s.z));
  return free.sort((a, b) => far(a) - far(b))[0] ?? null;
}
