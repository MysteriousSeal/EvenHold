// The small life's voxel models (ambientLife.ts), the voxel-art way:
// silhouette first, at a finer voxel than the world's (they're small). A
// butterfly's two wings either side of its dark body (white: tinted three
// ways per instance); a round bird, a brown back, a buff breast, a dark beak
// and tail. A rabbit, a frog, a dragonfly, a leaping fish and the ring of
// foam it leaves.

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

// A rabbit sat up, facing +Z: a round haunch, its head forward, two long ears up, a white scut behind.
export function rabbitGrid() {
  const g = createGrid([4, 8, 9]);
  fillBox(g, 0, 0, 1, 3, 3, 4, 1); // haunch
  fillBox(g, 0, 1, 4, 3, 3, 6, 1); // chest
  fillBox(g, 1, 0, 5, 2, 0, 6, 3); // forepaws, pale
  fillBox(g, 0, 3, 6, 3, 5, 8, 1); // head
  setColor(g, 0, 4, 7, 4); // eyes
  setColor(g, 3, 4, 7, 4);
  setColor(g, 1, 3, 8, 5); // nose
  setColor(g, 2, 3, 8, 5);
  fillBox(g, 0, 6, 6, 0, 7, 6, 2); // ears, darker-tipped
  fillBox(g, 3, 6, 6, 3, 7, 6, 2);
  setColor(g, 0, 7, 6, 4);
  setColor(g, 3, 7, 6, 4);
  fillBox(g, 1, 2, 0, 2, 3, 0, 3); // scut
  return g;
}
export const RABBIT_PALETTE = [0x9a7a5a, 0x7a5e44, 0xf1eee4, 0x2a2420, 0xc89a90]; // (brown, darker, white, dark, a pink nose)

// A frog squat on the bank, facing +Z: wide and low, its eyes bulging on top, its hind legs folded at its sides.
export function frogGrid() {
  const g = createGrid([5, 3, 5]);
  fillBox(g, 1, 0, 0, 3, 1, 4, 1); // body
  fillBox(g, 0, 0, 0, 0, 0, 2, 3); // hind legs
  fillBox(g, 4, 0, 0, 4, 0, 2, 3);
  fillBox(g, 1, 0, 4, 3, 0, 4, 2); // pale throat
  setColor(g, 1, 1, 1, 3); // dark spots on its back
  setColor(g, 3, 1, 2, 3);
  setColor(g, 1, 2, 3, 4); // eyes
  setColor(g, 3, 2, 3, 4);
  return g;
}
export const FROG_PALETTE = [0x9a9440, 0xe8e0b0, 0x3a4a2a, 0x1a1614]; // (olive-yellow, dark-spotted: green would be lost on the marsh)

// A dragonfly, facing +Z: a long thin body, a dark head, two pairs of pale wings spread flat (flickered by squeezing).
export function dragonflyGrid() {
  const g = createGrid([7, 1, 7]);
  fillBox(g, 3, 0, 0, 3, 0, 5, 1); // body (tinted per instance)
  setColor(g, 3, 0, 6, 2); // head
  fillBox(g, 0, 0, 4, 2, 0, 4, 3); // fore wings
  fillBox(g, 4, 0, 4, 6, 0, 4, 3);
  fillBox(g, 1, 0, 3, 2, 0, 3, 3); // hind wings
  fillBox(g, 4, 0, 3, 5, 0, 3, 3);
  return g;
}
export const DRAGONFLY_PALETTE = [0xffffff, 0x1a1614, 0xd8f0f0];

// A fish leaping, facing +Z: silver, dark along its back, its tail split.
export function fishGrid() {
  const g = createGrid([2, 3, 8]);
  fillBox(g, 0, 0, 2, 1, 1, 6, 1); // body
  fillBox(g, 0, 2, 2, 1, 2, 5, 2); // back
  setColor(g, 0, 1, 6, 3); // eyes
  setColor(g, 1, 1, 6, 3);
  fillBox(g, 0, 1, 1, 1, 1, 1, 2); // the wrist of its tail
  fillBox(g, 0, 0, 0, 1, 0, 0, 2); // its tail, split
  fillBox(g, 0, 2, 0, 1, 2, 0, 2);
  return g;
}
export const FISH_PALETTE = [0xc8d4dc, 0x6a7a84, 0x1a1614];

// A ring of foam on the water, where a fish or a frog went in (spread and sunk away as it fades).
export function splashGrid() {
  const g = createGrid([7, 1, 7]);
  for (let x = 0; x < 7; x++) {
    for (let z = 0; z < 7; z++) {
      const r = Math.hypot(x - 3, z - 3);
      if (r > 2.2 && r < 3.5) setColor(g, x, 0, z, 1);
    }
  }
  return g;
}

// A crow, facing +Z: the round bird's shape drawn longer and all near-black, a heavy grey beak.
export function crowGrid() {
  const g = createGrid([4, 5, 8]);
  fillBox(g, 0, 1, 1, 3, 3, 5, 1); // body
  fillBox(g, 1, 3, 5, 2, 4, 6, 1); // head
  setColor(g, 1, 4, 6, 3); // eyes
  setColor(g, 2, 4, 6, 3);
  fillBox(g, 1, 3, 7, 2, 3, 7, 2); // beak
  fillBox(g, 1, 2, 0, 2, 2, 0, 1); // tail
  fillBox(g, 1, 0, 3, 1, 0, 3, 3); // legs
  fillBox(g, 2, 0, 3, 2, 0, 3, 3);
  return g;
}
export const CROW_PALETTE = [0x2a2a30, 0x5a5a60, 0x121216];

// A heron stood in the shallows, facing +Z: long thin legs, a grey body, a white neck in an S, a dark crest, a long
// yellow bill (about half as tall as the hero).
export function heronGrid() {
  const g = createGrid([4, 20, 11]);
  fillBox(g, 1, 0, 3, 1, 8, 3, 4); // legs
  fillBox(g, 2, 0, 3, 2, 8, 3, 4);
  fillBox(g, 0, 8, 1, 3, 11, 6, 1); // body
  fillBox(g, 1, 9, 0, 2, 10, 0, 4); // tail
  fillBox(g, 1, 12, 6, 2, 14, 6, 2); // neck, in an S
  fillBox(g, 1, 14, 5, 2, 16, 5, 2);
  fillBox(g, 1, 17, 6, 2, 18, 7, 2); // head
  fillBox(g, 1, 19, 5, 2, 19, 6, 4); // crest
  setColor(g, 1, 18, 7, 4); // eyes
  setColor(g, 2, 18, 7, 4);
  fillBox(g, 1, 17, 8, 2, 17, 10, 3); // bill
  return g;
}
export const HERON_PALETTE = [0xb8bcc4, 0xe8e8ec, 0xd8b040, 0x3a3a44];
