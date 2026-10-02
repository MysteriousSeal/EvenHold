// The small life's voxel models (ambientLife.ts), the voxel-art way:
// silhouette first, at a finer voxel than the world's (they're small). A
// butterfly's two wings either side of its dark body (white: tinted three
// ways per instance); a round bird, a brown back, a buff breast, a dark beak
// and tail.

import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

// A butterfly, wings spread flat (flapped by squeezing them in), its body dark between them.
export function butterflyGrid() {
  const g = createGrid([9, 2, 6]);
  for (const side of [0, 5]) {
    fillBox(g, side, 0, 0, side + 3, 0, 2, 1); // the fore wing
    fillBox(g, side + (side ? 0 : 1), 0, 3, side + (side ? 2 : 3), 0, 5, 1); // the hind wing
    setColor(g, side + (side ? 3 : 0), 0, 1, 2); // a dark tip
  }
  fillBox(g, 4, 0, 0, 4, 1, 5, 2); // its body
  return g;
}

// A round little bird: a brown back, a buff breast (a red breast tinted on some), a dark beak and tail.
export function birdGrid() {
  const g = createGrid([4, 5, 7]);
  fillBox(g, 0, 1, 1, 3, 3, 5, 1); // body
  fillBox(g, 0, 1, 4, 3, 2, 5, 3); // breast
  fillBox(g, 1, 3, 4, 2, 4, 6, 1); // head
  setColor(g, 1, 4, 6, 4); // eye
  setColor(g, 2, 4, 6, 4);
  fillBox(g, 1, 3, 7 - 1, 2, 3, 7 - 1, 4); // beak
  fillBox(g, 1, 2, 0, 2, 3, 0, 4); // tail
  fillBox(g, 1, 0, 2, 1, 0, 2, 4); // legs
  fillBox(g, 2, 0, 2, 2, 0, 2, 4);
  return g;
}

export const PALETTE = [0xffffff, 0x2a2420, 0xe6d2b0, 0x1a1614]; // (white: tinted per instance; dark; buff; darkest)
export const BIRD_PALETTE = [0x8a6a4a, 0x2a2420, 0xe6d2b0, 0x1a1614];
