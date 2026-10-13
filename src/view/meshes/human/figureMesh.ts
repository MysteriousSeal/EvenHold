// A whole figure (humanFigure.ts) as one mesh, for where it's seen close up
// (the main menu's heroes, the hero sheet): its geometry, drawn fine
// (fineFigure.ts) and shaded round (roundedNormals.ts); and the box its body
// alone fills, bald and bare (what places or frames it, so neither its hair
// nor what it wears ever moves or rescales it).

import * as THREE from 'three';
import type { BodyLook } from '../../../model/human/humanoid';
import type { Equipment } from '../../../model/human/equipment';
import { greedyMesh } from '../voxel/greedyMesh';
import { roundNormals } from '../voxel/roundedNormals';
import { colorAt, setColor } from '../voxel/voxelShapes';
import { BODIES, JOINT_NAMES, PART_GRID } from './bodyVoxels';
import { fineFigure } from './fineFigure';
import { FINE_NECK, humanFigure, type Figure } from './humanFigure';

// Someone in what they wear (or `dressed`: a job's costume, seen instead), close up: their figure, finer.
export function closeUpFigure(look: BodyLook, equipment: Equipment, dressed?: Parameters<typeof humanFigure>[4]): Figure {
  if (BODIES[look.build].headScale === 1) return fineFigure(humanFigure(look, equipment, undefined, undefined, dressed), look);
  // A head drawn smaller than it's modelled (hers): the figure without it, and it alone (its hair and what's on it,
  // nothing held), set on a voxel smaller each way: two slices of it taken out along each (where nothing's drawn:
  // just in from either side, the chin and the top of the hair, mid-way back), the rest closed up over them.
  const unheld = <T extends object>(worn: T): T => ({ ...worn, mainHand: undefined, offHand: undefined });
  const body = fineFigure(humanFigure(look, equipment, JOINT_NAMES.filter((joint) => joint !== 'head'), undefined, dressed), look);
  const head = fineFigure(humanFigure(look, unheld(equipment), ['head'], undefined, dressed && unheld(dressed)), look);
  const palette = body.palette.slice();
  const colour = head.palette.map((rgb) => (palette.includes(rgb) ? palette.indexOf(rgb) : palette.push(rgb) - 1) + 1);
  if (palette.length > 255) throw new Error('figure has too many colors');
  const [N, half] = [PART_GRID.head[0] * 2, PART_GRID.head[0]]; // (the head's width in these voxels, and half of it)
  // Closed up toward the middle (across, and front to back): where a slice of the figure's now comes from.
  const inward = (at: number, middle: number, cuts: [number, number]) => (at <= middle - half + cuts[0] ? at - 1 : at >= middle - half + cuts[1] ? at + 1 : at);
  // Closed up downward, onto the neck.
  const down = (at: number) => (at < FINE_NECK[1] + 1 ? at : at < FINE_NECK[1] + N - 3 ? at + 1 : at + 2);
  const [sx, sy, sz] = body.grid.size;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const c = colorAt(head.grid, inward(x, FINE_NECK[0], [1, N - 2]), down(y), inward(z, FINE_NECK[2], [5, N - 6]));
        if (c) setColor(body.grid, x, y, z, colour[c - 1]);
      }
    }
  }
  return { ...body, palette };
}

// A figure's geometry, `voxel` the size of a figure's voxels (a fine one's, half that), its grid's corner at the origin.
export function figureGeometry(figure: Figure, voxel: number): THREE.BufferGeometry {
  const size = voxel * (figure.scale ?? 1);
  const origin = new THREE.Vector3();
  return roundNormals(greedyMesh(figure.grid, figure.palette, size, origin), figure.grid, size, origin);
}

// The box a look's body fills (bald, bare), in the same space as figureGeometry's.
export function bodyBox(look: BodyLook, voxel: number): THREE.Box3 {
  const { grid } = humanFigure({ ...look, hairStyle: 'bald' }, {});
  const [sx, sy, sz] = grid.size;
  const box = new THREE.Box3();
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        if (!colorAt(grid, x, y, z)) continue;
        box.expandByPoint(new THREE.Vector3(x * voxel, y * voxel, z * voxel));
        box.expandByPoint(new THREE.Vector3((x + 1) * voxel, (y + 1) * voxel, (z + 1) * voxel));
      }
    }
  }
  return box;
}
