// Each country's own small life (ambientLife.ts), the voxel-art way as ambientVoxels.ts: silhouette first, a few
// colours, facing +Z. The heath's hare (a rabbit's lankier cousin, its long ears black-tipped) and red grouse (plump,
// dark, a red comb over its eye); the hills' goat (pale, horned, bearded); the woods' boar (low, dark, bristled, a pale
// tusk each side of its snout) and owl (on the wing, its face pale).

import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

// A hare sat up, facing +Z: longer in the leg and the ear than the rabbit, its ears' tips black.
export function hareGrid() {
  const g = createGrid([4, 11, 10]);
  fillBox(g, 0, 1, 1, 3, 4, 5, 1); // haunch, up on its long hind legs
  fillBox(g, 0, 0, 1, 3, 0, 3, 2); // hind feet
  fillBox(g, 0, 4, 1, 3, 4, 5, 2); // its back, darker
  fillBox(g, 0, 2, 5, 3, 4, 7, 1); // chest
  fillBox(g, 1, 0, 6, 2, 1, 6, 3); // forelegs, pale
  fillBox(g, 0, 4, 7, 3, 6, 9, 1); // head
  setColor(g, 0, 5, 8, 4); // eyes
  setColor(g, 3, 5, 8, 4);
  fillBox(g, 0, 7, 7, 0, 10, 7, 1); // ears, four tall, black-tipped
  fillBox(g, 3, 7, 7, 3, 10, 7, 1);
  setColor(g, 0, 10, 7, 4);
  setColor(g, 3, 10, 7, 4);
  fillBox(g, 1, 3, 0, 2, 4, 0, 3); // scut
  return g;
}
export const HARE_PALETTE = [0xa88458, 0x74583c, 0xe8e0cc, 0x1a1614]; // (tawny, darker, pale, black)

// A red grouse on the heather, facing +Z: round and dark, a red comb over its eye, pale feathered feet.
export function grouseGrid() {
  const g = createGrid([5, 6, 8]);
  fillBox(g, 0, 1, 1, 4, 4, 6, 1); // body, plump
  fillBox(g, 0, 4, 1, 4, 4, 5, 2); // its back, darker (barred)
  setColor(g, 1, 4, 3, 1);
  setColor(g, 3, 4, 2, 1);
  fillBox(g, 1, 3, 6, 3, 5, 7, 1); // head
  setColor(g, 1, 5, 6, 3); // the red combs
  setColor(g, 3, 5, 6, 3);
  setColor(g, 1, 4, 7, 5); // eyes
  setColor(g, 3, 4, 7, 5);
  setColor(g, 2, 3, 7, 5); // beak
  fillBox(g, 1, 2, 0, 3, 3, 0, 2); // tail
  setColor(g, 1, 0, 3, 4); // feet, feathered white
  setColor(g, 3, 0, 3, 4);
  return g;
}
export const GROUSE_PALETTE = [0x7a3e26, 0x4a2618, 0xd8301e, 0xe8e0d0, 0x1a1614]; // (red-brown, darker, comb red, feet, dark)

// A goat, facing +Z: four legs, a deep body, its head up, horns swept back, a beard and a little tail up.
export function goatGrid() {
  const g = createGrid([5, 12, 12]);
  for (const [x, z] of [[0, 1], [4, 1], [0, 7], [4, 7]]) fillBox(g, x, 0, z, x, 3, z, 2); // legs
  fillBox(g, 0, 4, 1, 4, 7, 8, 1); // body
  fillBox(g, 1, 7, 8, 3, 8, 9, 1); // neck
  fillBox(g, 1, 8, 9, 3, 10, 11, 1); // head
  setColor(g, 1, 10, 10, 4); // eyes
  setColor(g, 3, 10, 10, 4);
  setColor(g, 2, 7, 11, 3); // beard
  setColor(g, 2, 8, 11, 3);
  for (const x of [1, 3]) {
    setColor(g, x, 11, 9, 3); // horns, up and swept back
    setColor(g, x, 11, 8, 3);
    setColor(g, x, 10, 7, 3);
  }
  setColor(g, 2, 8, 0, 1); // tail, up
  return g;
}
export const GOAT_PALETTE = [0xe8e2d4, 0xb4a894, 0x3a3028, 0x1a1614]; // (cream: tinted per instance; legs; horns and beard; eyes)

// A boar rooting, facing +Z: low and heavy, a bristled ridge down its back, its head down, a pale tusk each side.
export function boarGrid() {
  const g = createGrid([5, 8, 12]);
  for (const [x, z] of [[0, 1], [4, 1], [0, 6], [4, 6]]) fillBox(g, x, 0, z, x, 1, z, 2); // short legs
  fillBox(g, 0, 2, 1, 4, 6, 8, 1); // body
  fillBox(g, 2, 7, 2, 2, 7, 8, 2); // the bristled ridge
  fillBox(g, 1, 2, 9, 3, 5, 10, 1); // head, low
  fillBox(g, 1, 2, 11, 3, 3, 11, 3); // snout
  setColor(g, 0, 3, 10, 4); // tusks
  setColor(g, 4, 3, 10, 4);
  setColor(g, 1, 6, 9, 2); // ears
  setColor(g, 3, 6, 9, 2);
  setColor(g, 1, 5, 10, 5); // eyes
  setColor(g, 3, 5, 10, 5);
  setColor(g, 2, 5, 0, 2); // tail
  return g;
}
export const BOAR_PALETTE = [0x4e3a2a, 0x2a1e16, 0x8a6e60, 0xece4cc, 0x0e0a08]; // (dark brown, bristles, snout, tusks, eyes)

// An owl on the wing, facing +Z: broad round wings barred dark, its round face pale.
export function owlGrid() {
  const g = createGrid([11, 3, 5]);
  fillBox(g, 4, 0, 0, 6, 2, 3, 1); // body
  fillBox(g, 4, 0, 4, 6, 2, 4, 3); // the face, pale
  setColor(g, 4, 1, 4, 4); // eyes
  setColor(g, 6, 1, 4, 4);
  for (const [x0, x1] of [[0, 3], [7, 10]]) {
    fillBox(g, x0, 1, 1, x1, 1, 3, 1); // wings
    fillBox(g, x0 + 1, 1, 2, x1 - 1, 1, 2, 2); // barred
  }
  fillBox(g, 5, 1, 0, 5, 2, 0, 2); // tail
  return g;
}
export const OWL_PALETTE = [0xa8804e, 0x5a4028, 0xeadcc0, 0x1a1614]; // (tawny, barred dark, face, eyes)
