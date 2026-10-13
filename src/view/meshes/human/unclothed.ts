// A body drawn unclothed (a look's `unclothed`: bodyVoxels.ts paints skin where its braies and her band were, and
// leaves the cord off): the look itself, and what a whole voxel can't place on it.
import type { BodyLook, Build } from '../../../model/human/humanoid';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { scaleGrid } from '../voxel/voxelShapes';
import { C, buildTorso } from './bodyVoxels';

// A look's unclothed twin: one kept for each look, so it's the same body from frame to frame.
const twins = new Map<string, BodyLook>();
export function unclothed(look: BodyLook): BodyLook {
  if (look.unclothed) return look;
  const key = JSON.stringify(look);
  return twins.get(key) ?? twins.set(key, { ...look, unclothed: true }).get(key)!;
}

// The unclothed torso drawn twice as fine (each voxel eight), for what a whole voxel can't place: a nipple in the
// middle of each side of the chest (each of her breasts is two voxels wide and two high where it stands furthest, his chest three and two: their
// middles fall between voxels), two fine voxels square (a voxel's own size), on the chest's front face.
export const NIPPLES: Record<Build, ReadonlyArray<[x: number, y: number, z: number]>> = {
  female: [3, 9].flatMap((x) => [11, 12].flatMap((y) => [[x, y, 11], [x + 1, y, 11]] as Array<[number, number, number]>)),
  male: [4, 12].flatMap((x) => [13, 14].flatMap((y) => [[x, y, 9], [x + 1, y, 9]] as Array<[number, number, number]>)),
};
export function fineTorso(build: Build): VoxelGrid {
  const fine = scaleGrid(buildTorso(build, true), 2);
  const [w, h] = fine.size;
  for (const [x, y, z] of NIPPLES[build]) fine.cells[x + w * (y + h * z)] = C.cheek;
  return fine;
}
