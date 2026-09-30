// What every building shares (houses, the inn, the smithy): a voxel model
// per look, built once and meshed twice from the same grid, everything but
// the glass with a plain material, and the window glass, lanterns and forge
// coals with a glowing one (the shared grid means no faces are hidden
// between the two); both instanced per map chunk, each standing where `place` says.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { HOUSE_WINDOW_GLOW, WINDOW_GLOW_INTENSITY } from '../../constants';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';
import { GLOWING, HOUSE_PALETTE } from './housePalette';
import { HOUSE_VOXEL_SIZE } from './houseVoxels';

// A model's grid centered in X/Z, standing on the ground.
export const originOf = ([sx, , sz]: readonly [number, number, number]) => new THREE.Vector3((-sx * HOUSE_VOXEL_SIZE) / 2, 0, (-sz * HOUSE_VOXEL_SIZE) / 2);

// One of a model's two meshes: its glowing voxels (`glowing`), or all the rest.
export const meshLit = (grid: VoxelGrid, glowing: boolean): THREE.BufferGeometry =>
  greedyMesh(grid, HOUSE_PALETTE, HOUSE_VOXEL_SIZE, originOf(grid.size), (color) => GLOWING.has(color) === glowing);

// Adds `items`, each built as `build` says for its look (`key`), set where `place` says.
export function addLitBuildings<T>(scene: WorldSink, items: readonly T[], key: (item: T) => string, build: (item: T) => VoxelGrid, place: (item: T) => VoxelPlacement): void {
  const grids = new Map<string, VoxelGrid>(); // each look's voxels, shared by its two meshes
  const gridFor = (item: T) => {
    const k = key(item);
    let grid = grids.get(k);
    if (!grid) grids.set(k, (grid = build(item)));
    return grid;
  };
  addVoxelInstances(scene, items, key, (item) => meshLit(gridFor(item), false), place, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  addVoxelInstances(
    scene,
    items,
    key,
    (item) => meshLit(gridFor(item), true),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: WINDOW_GLOW_INTENSITY, roughness: 0.5 }),
  );
}
