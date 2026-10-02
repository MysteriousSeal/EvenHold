// A figure for close-ups (the main menu's heroes, the hero sheet, the
// portraits): the same figure in voxels half the size, every one doubled
// (so its shapes, colours and silhouette are the very same, merged back into
// the same big faces), and only the face and the hands painted again in the
// finer voxels, where a close look goes:
// - eyes: a highlight in the top corner of each (a smaller sparkle in hers);
// - brows, lashes, the mouth, a lid or a crease: thin strokes, not bars;
// - blush: dithered into the skin, soft;
// - the nose: a bridge and two nostrils;
// - the fringe: strands in its three tones;
// - the hands: fingers parted, knuckles lit.
// What's worn over them (a visor, gloves) stays over them: only the body's
// own voxels are painted. The figure in play keeps its world-scale voxels.

import type { BodyLook } from '../../../model/human/humanoid';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { BODIES, C, PART_GRID } from './bodyVoxels';
import type { Figure } from './humanFigure';

const BODY_COLORS = 15; // C's colors, first in a figure's palette (its body is placed first)

export function fineFigure(figure: Figure, look: BodyLook): Figure {
  const { grid, palette, parts = {} } = figure;
  const [sx, sy, sz] = grid.size;
  const fine = createGrid([sx * 2, sy * 2, sz * 2]);
  const at = (x: number, y: number, z: number) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : grid.cells[x + sx * (y + sy * z)]);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const c = at(x, y, z);
        if (!c) continue;
        for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setColor(fine, x * 2 + i, y * 2 + j, z * 2 + k, c);
      }
    }
  }
  // The body's own colour at a coarse voxel (0: none, or something worn).
  const body = (x: number, y: number, z: number) => {
    const c = at(x, y, z);
    return c > 0 && c <= BODY_COLORS ? c : 0;
  };
  // Paints the front half-voxel layer of a coarse front voxel, its four fine voxels (i, j: 0 left/bottom, 1 right/top).
  const paint = (x: number, y: number, z: number, color: (i: number, j: number) => number) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setColor(fine, x * 2 + i, y * 2 + j, z * 2 + 1, color(i, j));
  };

  // The face.
  const head = parts.head;
  if (head) {
    const N = PART_GRID.head[0];
    const L = N - 1;
    const z = head[2] + L;
    const code = (x: number, y: number) => (x < 0 || y < 0 || x > L || y > L ? 0 : body(head[0] + x, head[1] + y, z));
    const isHair = (c: number) => c === C.hair || c === C.hairLight || c === C.hairDark;
    const stroke = (c: number) => isHair(c) || c === C.mouth || c === C.skinDeep;
    // Strands in a tone's own range (a dark moustache stays dark, a light streak light).
    const strand = (c: number, fx: number, fy: number) => {
      const t = (fx + fy * 3) % 4;
      if (c === C.hairDark) return t === 0 ? C.hair : C.hairDark;
      if (c === C.hairLight) return t === 0 ? C.hair : C.hairLight;
      return [C.hair, C.hairLight, C.hair, C.hairDark][t];
    };
    for (let y = 0; y <= L; y++) {
      for (let x = 0; x <= L; x++) {
        const c = code(x, y);
        if (!c) continue;
        const [above, below] = [code(x, y + 1), code(x, y - 1)];
        const [gx, gy] = [head[0] + x, head[1] + y];
        if (c === C.eye) {
          const open = above !== C.eye && above !== C.glint && below === C.eye; // (the top of an open eye; not a closed one, a happy arc or a lid's line)
          paint(gx, gy, z, (i, j) => (open && i === 1 && j === 1 ? C.glint : C.eye)); // a highlight in its corner
        } else if (c === C.glint) {
          if (below === C.eye) paint(gx, gy, z, (i, j) => (i === 0 && j === 1 ? C.glint : C.eye)); // her sparkle (on top of her eye), smaller
          else paint(gx, gy, z, (i, j) => (i === 0 && j === 0 ? C.glint : C.skin)); // a tear (hanging under an eye): a single drop
        } else if (stroke(c) && !stroke(above) && !stroke(below) && x > 0 && x < L) {
          // A stroke (a brow, a lash, the mouth, a lid, a crease): thin, its upper half.
          paint(gx, gy, z, (_i, j) => (j === 1 ? c : C.skin));
        } else if (isHair(c)) {
          paint(gx, gy, z, (i, j) => strand(c, gx * 2 + i, gy * 2 + j)); // strands
        } else if (c === C.cheek) {
          paint(gx, gy, z, (i, j) => ((i + j) % 2 === 0 ? C.cheek : C.skin)); // blush, dithered
        } else if (c === C.skinShade && x > 0 && x < L && y > 0 && y < L && code(x - 1, y) === C.skin && code(x + 1, y) === C.skin) {
          paint(gx, gy, z, (_i, j) => (j === 1 ? C.skinShade : C.skinDeep)); // the nose: its bridge, its nostrils
        }
      }
    }
  }

  // The hands: fingers parted along the front, knuckles lit over them.
  const [aw, , ad] = BODIES[look.build].grid.arm;
  for (const arm of [parts.leftArm, parts.rightArm]) {
    if (!arm) continue;
    const z = arm[2] + ad - 1;
    for (let x = 0; x < aw; x++) {
      if (body(arm[0] + x, arm[1], z)) paint(arm[0] + x, arm[1], z, (i) => (i === 1 ? C.skinShade : C.skin)); // fingers
      if (body(arm[0] + x, arm[1] + 1, z)) paint(arm[0] + x, arm[1] + 1, z, (i, j) => (j === 0 && i === 0 ? C.skinLight : C.skin)); // knuckles
    }
  }
  return { grid: fine, palette, parts, scale: 0.5 };
}
