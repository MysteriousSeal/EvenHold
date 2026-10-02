// A dungeon's floor plan (a crypt's, crypts/cryptLayout.ts; a cave's,
// caves/caveLayout.ts), in room tiles as any room (interiors.ts): floor tiles
// 0..width-1 along x, 0..depth-1 along z, the rest rock; the way in (up to
// the world) in the +Z wall at `door` and `door + 1`, the hero arriving on
// the floor just inside it.

export interface FloorPlan {
  width: number;
  depth: number;
  door: number; // the column of the way up, in the +Z wall (two tiles wide: door and door + 1)
  floor: Uint8Array; // x * depth + z: 1 floor, 0 rock
}

export const isFloor = (plan: FloorPlan, x: number, z: number): boolean => x >= 0 && z >= 0 && x < plan.width && z < plan.depth && plan.floor[x * plan.depth + z] === 1;

// Whether the rock at (x, z) is always in full view: no floor behind it (toward -x or -z, the way the camera looks),
// so it never stands between the camera and anyone. The rest fades when the hero's behind it (the views').
export const inFullView = (plan: FloorPlan, x: number, z: number): boolean =>
  !isFloor(plan, x, z) && !isFloor(plan, x - 1, z) && !isFloor(plan, x, z - 1) && !isFloor(plan, x - 1, z - 1);
