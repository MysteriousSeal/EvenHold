// Voxel houses. Each (layout, roof color) model is built once and meshed
// twice from the same grid: everything but the glass with a plain material,
// and the window glass and lanterns with a glowing one (the shared grid
// means no faces are hidden between the two). Both are instanced per map
// chunk, and houses stand on the village cobbles, not the grass under them.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { House } from '../../../model/types';
import { hashCell } from '../../../util/random';
import { HOUSE_WINDOW_GLOW } from '../../constants';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';
import { GLOWING, HOUSE_PALETTE, ROOF_SETS } from './housePalette';
import { HOUSE_GRID, HOUSE_LAYOUTS, HOUSE_VOXEL_SIZE, buildHouseVoxels } from './houseVoxels';

const ORIGIN = new THREE.Vector3((-HOUSE_GRID[0] * HOUSE_VOXEL_SIZE) / 2, 0, (-HOUSE_GRID[2] * HOUSE_VOXEL_SIZE) / 2);

// A house's look comes from a hash of its grid position rather than being
// stored in the model: it's purely visual, and drawing it from the world
// rng would shift every later placement for every existing seed.
function looks(house: House): { layout: number; roof: number } {
  const h = hashCell(house.x, house.z);
  return { layout: h % HOUSE_LAYOUTS.length, roof: (h >>> 8) % ROOF_SETS.length };
}

export function buildHouseGeometry(layout: number, roof: number, glowing: boolean): THREE.BufferGeometry {
  return meshGrid(buildHouseVoxels(HOUSE_LAYOUTS[layout], roof), glowing);
}

function meshGrid(grid: VoxelGrid, glowing: boolean): THREE.BufferGeometry {
  return greedyMesh(grid, HOUSE_PALETTE, HOUSE_VOXEL_SIZE, ORIGIN, (color) => GLOWING.has(color) === glowing);
}

export function buildHouses(scene: THREE.Scene, model: GameModel): void {
  const grids = new Map<string, VoxelGrid>(); // each model's voxels, shared by its two meshes
  const key = (house: House) => {
    const { layout, roof } = looks(house);
    return `${layout}:${roof}`;
  };
  const gridFor = (house: House) => {
    const k = key(house);
    let grid = grids.get(k);
    if (!grid) {
      const { layout, roof } = looks(house);
      grid = buildHouseVoxels(HOUSE_LAYOUTS[layout], roof);
      grids.set(k, grid);
    }
    return grid;
  };
  // Doors face local -Z; house rotations are always multiples of 90 degrees.
  const place = (house: House): VoxelPlacement => ({
    x: house.x,
    y: model.getGroundY(house.x, house.z),
    z: house.z,
    quarterTurns: ((Math.round(house.rotationY / (Math.PI / 2)) % 4) + 4) % 4,
  });

  addVoxelInstances(
    scene,
    model.houses,
    key,
    (house) => meshGrid(gridFor(house), false),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
  addVoxelInstances(
    scene,
    model.houses,
    key,
    (house) => meshGrid(gridFor(house), true),
    place,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: HOUSE_WINDOW_GLOW,
      emissiveIntensity: 0.9,
      roughness: 0.5,
    }),
  );
}
