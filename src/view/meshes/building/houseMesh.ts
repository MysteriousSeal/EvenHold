// Voxel houses, a model for each (layout, roof color), lit and instanced as
// every building is (litBuildings.ts); they stand on the village cobbles, not the grass under them. A
// herbalist's dressed apart (herbalistHouse.ts): a green door, a sign, herbs drying, pots.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { House } from '../../../model/types';
import { hashCell } from '../../../util/random';
import type { VoxelPlacement } from '../voxel/voxelInstances';
import { ROOF_SETS } from './housePalette';
import { HOUSE_LAYOUTS, buildHouseVoxels } from './houseVoxels';
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
  // The herbalists' houses (their homes' doors are the houses', in order: interiors.ts entrancesOf), dressed apart.
  const homes = new Set(model.npcs.filter((n) => n.role === 'herbalist').map((n) => n.home));
  const herbalists = new Set(model.houses.filter((_house, i) => homes.has(model.entrances[i])));
  const key = (house: House) => {
    const { layout, roof } = looks(house);
    return `${layout}:${roof}${herbalists.has(house) ? ':herbalist' : ''}`;
  };
  const build = (house: House) => {
    const { layout, roof } = looks(house);
    return buildHouseVoxels(HOUSE_LAYOUTS[layout], roof, herbalists.has(house));
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
