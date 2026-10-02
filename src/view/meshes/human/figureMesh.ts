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
import { colorAt } from '../voxel/voxelShapes';
import { fineFigure } from './fineFigure';
import { humanFigure, type Figure } from './humanFigure';

// Someone in what they wear, close up: their figure, finer.
export function closeUpFigure(look: BodyLook, equipment: Equipment): Figure {
  return fineFigure(humanFigure(look, equipment), look);
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
