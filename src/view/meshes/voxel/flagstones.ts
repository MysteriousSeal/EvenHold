// Flagstones laid over a square of voxel columns (a tile), as both floors of
// old stone lay them (the ruins': ruin/ruinFloorVoxels.ts; the crypts':
// crypt/cryptFloorVoxels.ts): rows of uneven depth, each split into stones of
// uneven length from an offset of its own, the joints never where the next
// row's are; joints only between stones within the square, never along its
// edges, so the paving runs on from tile to tile with no grid showing.

export interface Flagstones {
  stone(u: number, v: number): number; // which stone a column is
  joint(u: number, v: number): boolean; // whether it's a joint between stones
  byJoint(u: number, v: number): boolean; // whether it's a stone's edge (a joint beside it)
}

export interface Laying {
  size: number; // columns a side
  deep: readonly [number, number]; // a row's depth: the least, and how many more it may be
  long: readonly [number, number]; // a stone's length: the same
  lead: number; // how far a row's first stone may run in from the square before
}

export function layFlagstones(rng: () => number, { size, deep, long, lead }: Laying): Flagstones {
  const stones = new Int16Array(size * size).fill(-1);
  const joints = new Uint8Array(size * size);
  let id = 0;
  for (let v0 = 0; v0 < size; ) {
    let d = Math.min(size - v0, deep[0] + Math.floor(rng() * deep[1]));
    if (size - v0 - d < deep[0]) d = size - v0; // (no sliver of a row left over: this one takes it in)
    let u0 = -Math.floor(rng() * lead);
    while (u0 < size) {
      const l = long[0] + Math.floor(rng() * long[1]);
      for (let u = Math.max(0, u0); u < Math.min(size, u0 + l); u++) for (let v = v0; v < v0 + d; v++) stones[u * size + v] = id;
      const end = u0 + l - 1; // the joint at its end (within the square only)
      if (end >= 0 && end < size - 1) for (let v = v0; v < v0 + d; v++) joints[end * size + v] = 1;
      id++;
      u0 += l;
    }
    v0 += d;
    if (v0 < size - 1) for (let u = 0; u < size; u++) joints[u * size + v0 - 1] = 1; // along the row's far side
  }
  const inside = (u: number, v: number) => u >= 0 && v >= 0 && u < size && v < size;
  const joint = (u: number, v: number) => inside(u, v) && joints[u * size + v] === 1;
  return {
    stone: (u, v) => stones[u * size + v],
    joint,
    byJoint: (u, v) => joint(u + 1, v) || joint(u - 1, v) || joint(u, v + 1) || joint(u, v - 1),
  };
}
