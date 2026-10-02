// Voxel houses, a model for each (layout, roof color), lit and instanced as
// every building is (litBuildings.ts); they stand on the village cobbles, not the grass under them. A
// herbalist's, a hut of their own on its tile (herbalistHouse.ts): stone and daub under a shaggy thatch.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { House } from '../../../model/types';
import { hashCell } from '../../../util/random';
import type { VoxelPlacement } from '../voxel/voxelInstances';
import { ROOF_SETS } from './housePalette';
import { HOUSE_LAYOUTS, buildHouseVoxels } from './houseVoxels';
import { buildHermitHut } from './herbalistHouse';
import { isHerbalistHome } from '../../../model/herbalist/herbalistHomes';
import { addLitBuildings, meshLit } from './litBuildings';

// A house's look comes from a hash of its grid position rather than being
// stored in the model: it's purely visual, and drawing it from the world
// rng would shift every later placement for every existing seed.
function looks(house: House): { layout: number; roof: number } {
  const h = hashCell(house.x, house.z);
  return { layout: h % HOUSE_LAYOUTS.length, roof: (h >>> 8) % ROOF_SETS.length };
}

export function buildHouseGeometry(layout: number, roof: number, glowing: boolean): THREE.BufferGeometry {
  return meshLit(buildHouseVoxels(HOUSE_LAYOUTS[layout], roof), glowing);
}

export function buildHouses(scene: WorldSink, model: GameModel): void {
  // The herbalists' huts (their homes' doors are the houses', in order: interiors.ts entrancesOf), a building of their own.
  const herbalists = new Set(model.houses.filter((_house, i) => isHerbalistHome(model.entrances[i])));
  const key = (house: House) => {
    const { layout, roof } = looks(house);
    return herbalists.has(house) ? 'herbalist' : `${layout}:${roof}`; // (every herbalist's hut the same)
  };
  const build = (house: House) => {
    const { layout, roof } = looks(house);
    return herbalists.has(house) ? buildHermitHut() : buildHouseVoxels(HOUSE_LAYOUTS[layout], roof);
  };
  // Doors face local -Z; house rotations are always multiples of 90 degrees.
  const place = (house: House): VoxelPlacement => ({
    x: house.x,
    y: model.getGroundY(house.x, house.z),
    z: house.z,
    quarterTurns: ((Math.round(house.rotationY / (Math.PI / 2)) % 4) + 4) % 4,
  });
  addLitBuildings(scene, model.houses, key, build, place);
}
