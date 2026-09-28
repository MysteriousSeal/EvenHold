// Bandit camps (see campVoxels.ts): every camp piece and palisade segment,
// meshed plain plus glowing (flames and gold), streamed with the chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { campPalisade, campPieces } from '../../../model/enemies';
import { HOUSE_WINDOW_GLOW } from '../../constants';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { CAMP_GLOWING, CAMP_GRID, CAMP_PALETTE, CAMP_VOXEL_SIZE, buildCampfire, buildCrates, buildLoot, buildPalisade, buildRack, buildTent } from './campVoxels';

type Model = 'fire' | 'tent' | 'rack' | 'crates' | 'loot' | 'palisade';
const BUILD: Record<Model, () => VoxelGrid> = {
  fire: buildCampfire,
  tent: buildTent,
  rack: buildRack,
  crates: buildCrates,
  loot: buildLoot,
  palisade: buildPalisade,
};
const ORIGIN = new THREE.Vector3((-CAMP_GRID[0] * CAMP_VOXEL_SIZE) / 2, 0, (-CAMP_GRID[2] * CAMP_VOXEL_SIZE) / 2);
// Quarter turns that bring a palisade's local -Z edge to each side (+x, -x, +z, -z).
const EDGE_TURNS = [3, 1, 2, 0];

export function buildCampGeometry(model: Model, glowing: boolean): THREE.BufferGeometry {
  return greedyMesh(BUILD[model](), CAMP_PALETTE, CAMP_VOXEL_SIZE, ORIGIN, (c) => CAMP_GLOWING.has(c) === glowing);
}

export function buildCamps(scene: WorldSink, model: GameModel): void {
  const ground = (x: number, z: number) => model.heightMap[x][z] * TILE_HEIGHT;
  const pieces = model.camps.flatMap((camp) => [
    ...campPieces(camp).map((p) => ({ model: p.kind as Model, x: p.x, z: p.z, quarterTurns: p.quarterTurns })),
    ...campPalisade(camp).map((e) => ({ model: 'palisade' as Model, x: e.x, z: e.z, quarterTurns: EDGE_TURNS[e.side] })),
  ]);
  const place = (p: (typeof pieces)[number]) => ({ x: p.x, y: ground(p.x, p.z), z: p.z, quarterTurns: p.quarterTurns });
  addVoxelInstances(scene, pieces, (p) => p.model, (p) => buildCampGeometry(p.model, false), place, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  addVoxelInstances(
    scene,
    pieces.filter((p) => p.model === 'fire' || p.model === 'loot'),
    (p) => p.model,
    (p) => buildCampGeometry(p.model, true),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.6, roughness: 0.5 }),
  );
}
