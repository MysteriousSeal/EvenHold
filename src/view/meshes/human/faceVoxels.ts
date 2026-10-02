// The face, painted on the head (bodyVoxels.ts buildHead) in the look's
// expression (model/human/humanoid.ts EXPRESSIONS), in the body's colors.

import type { Build, Expression } from '../../../model/human/humanoid';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { C, PART_GRID } from './bodyVoxels';

// The face, on the head's front (z = L), in its expression. At eleven
// voxels a face says what it feels in its strongest strokes: the brows'
// slant first, then the mouth's shape, then the eyes. Hers keep their big
// glinting eyes and lashes, his stay simple, so they read from afar.
// - calm: level brows, open eyes, a small mouth (his), a tiny one (hers);
// - cheerful: eyes closed in happy arcs, a smile turned up at its corners;
// - stern: brows slanting down to the middle, a crease between, eyes
//   narrowed under a heavy lid, the mouth a pressed line;
// - wistful: brows slanting up to the middle, the gaze lowered (hers wet,
//   a tear on one cheek), the mouth turned down;
// - sly: one brow lowered and its eye narrowed (his) or winking (hers), a
//   lopsided smirk.
// Under a beard (his), the mouth's corners show over the moustache.
export function paintFace(grid: VoxelGrid, build: Build, expression: Expression, beard: boolean, strands: (a: number, b: number) => number): void {
  const N = PART_GRID.head[0];
  const L = N - 1;
  const M = (N - 1) / 2;
  const at = (x: number, y: number, color: number) => setColor(grid, x, y, L, color);
  // A happy arc (^) over an eye at x: closed, smiling.
  const arc = (x: number, y: number) => {
    at(x - 1, y - 1, C.eye);
    at(x, y, C.eye);
    at(x + 1, y - 1, C.eye);
  };
  if (build === 'female') {
    for (const side of [-1, 1]) {
      const x = M + side * 2; // her eyes, 3 and 7
      const winking = expression === 'sly' && side > 0;
      // Brows: soft, two wide; their slant tells most.
      const [inner, outer] = expression === 'stern' ? [7, 8] : expression === 'wistful' ? [8, 7] : [8, 8];
      at(x, inner, C.hair);
      at(x + side, outer, C.hair);
      // Eyes.
      if (expression === 'cheerful') {
        arc(x, 6);
        at(x + side * 2, 6, C.hairDark); // a lash, at the arc's corner
      } else if (winking) {
        for (const dx of [-1, 0, 1]) at(x + dx, 5, C.eye); // shut: a lid's line
        at(x + side * 2, 6, C.hairDark);
      } else {
        const top = expression === 'stern' ? 5 : 6; // (narrowed: under a lid)
        fillBox(grid, x, 4, L, x, top, L, (_x, y) => (y === top ? C.glint : C.eye)); // an eye, its glint at its top
        at(x + side, top, C.eye); // wide at the top
        if (expression === 'stern') at(x + side, 6, C.skinDeep); // (the heavy lid)
        if (expression === 'wistful') at(x, 5, C.glint); // (wet)
        at(x + side * 2, expression === 'wistful' ? 6 : 7, C.hairDark); // a lash, flicking out (lower when the brow's down)
      }
      // Blush: rosier when cheerful.
      at(x + side, 3, C.cheek);
      at(x + side * 2, 3, C.cheek);
      if (expression === 'cheerful') at(x + side * 2, 4, C.cheek);
    }
    if (expression === 'wistful') at(M - 2, 3, C.glint); // a tear on her cheek
    // Her mouth, tiny.
    if (expression === 'cheerful') [[M - 1, 3], [M, 2], [M + 1, 3]].forEach(([x, y]) => at(x, y, C.mouth)); // a smile
    else if (expression === 'stern') for (const x of [M - 1, M, M + 1]) at(x, 2, C.mouth); // pressed
    else if (expression === 'wistful') [[M - 1, 1], [M, 2], [M + 1, 1]].forEach(([x, y]) => at(x, y, C.mouth)); // turned down
    else if (expression === 'sly') [[M - 1, 2], [M, 2], [M + 1, 3]].forEach(([x, y]) => at(x, y, C.mouth)); // a smirk
    else at(M, 2, C.mouth);
    return;
  }
  // His: kept simple, so it reads from afar.
  for (const x of [M - 3, M + 3]) {
    const side = x < M ? -1 : 1;
    const narrowed = expression === 'stern' || (expression === 'sly' && side > 0);
    // Brows: their slant, most of what he feels.
    const [inner, outer] = expression === 'stern' || (expression === 'sly' && side > 0) ? [7, 8] : expression === 'wistful' ? [8, 7] : [8, 8];
    at(x, inner, C.hairDark);
    at(x + side, outer, C.hairDark);
    // Eyes.
    if (expression === 'cheerful') arc(x, 6);
    else if (narrowed) {
      at(x, 5, C.eye);
      at(x, 6, C.skinDeep); // (the lid, down)
    } else if (expression === 'wistful') fillBox(grid, x, 4, L, x, 5, L, C.eye); // (the gaze lowered)
    else fillBox(grid, x, 5, L, x, 6, L, C.eye);
    at(x + side, 3, C.cheek); // a touch of blush
  }
  at(M, 4, C.skinShade); // a hint of a nose
  if (expression === 'stern') at(M, 7, C.skinDeep); // the crease between the brows
  if (beard) {
    fillBox(grid, 1, 0, L, L - 1, 2, L, (x, y) => (y === 2 && x >= M - 2 && x <= M + 2 ? C.hairDark : strands(x, y))); // a moustache over the beard
    for (const x of [0, L]) fillBox(grid, x, 0, 6, x, 5, L, (_x, y, z) => strands(z, y)); // sideburns
    if (expression === 'cheerful') for (const x of [M - 3, M + 3]) at(x, 3, C.mouth); // (the smile's corners, over the moustache)
    if (expression === 'sly') at(M + 3, 3, C.mouth);
    return;
  }
  if (expression === 'cheerful') [[M - 2, 3], [M - 1, 2], [M, 2], [M + 1, 2], [M + 2, 3]].forEach(([x, y]) => at(x, y, C.mouth)); // a smile
  else if (expression === 'stern') for (const x of [M - 1, M, M + 1]) at(x, 2, C.skinDeep); // lips pressed
  else if (expression === 'wistful') [[M - 1, 1], [M, 2], [M + 1, 1]].forEach(([x, y]) => at(x, y, C.mouth)); // turned down
  else if (expression === 'sly') [[M, 2], [M + 1, 2], [M + 2, 3]].forEach(([x, y]) => at(x, y, C.mouth)); // a smirk
  else at(M, 2, C.mouth);
}
