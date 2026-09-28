// Draws the scattered ground cover as voxel models: grass tufts that sway
// in the wind, wildflowers and pebble clusters. Positions come from
// groundCoverScatter.ts; here they're snapped to the 0.04 voxel grid and
// turned in quarter turns only, and each item's size picks a model rather
// than scaling one, so every voxel stays the same size as the world's.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { hashCell } from '../../../util/random';
import { addWindSway } from '../common/wind';
import { TERRAIN_COLORS } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';
import { scatterGroundCover, type ScatterItem } from './groundCoverScatter';
import {
  COVER_PALETTE,
  COVER_VOXEL_SIZE,
  FLOWER_GRID,
  FLOWER_HEIGHTS,
  PEBBLE_GRID,
  PEBBLE_SHAPES,
  TUFT_GRID,
  TUFT_SHAPES,
  TUFT_SIZES,
  buildFlower,
  buildPebbles,
  buildTuft,
} from './groundCoverVoxels';

const TUFT_SHADES = [0.92, 1.06]; // slight per-clump variation of the tile's green
// The blade palette's root shade is below white so tips can be lighter;
// this lifts the tint back so roots match the tile's green exactly.
const TUFT_ROOT_LIFT = 1 / new THREE.Color(COVER_PALETTE[0]).r;
const TUFT_HEIGHT_MAX = TUFT_SIZES[TUFT_SIZES.length - 1] * COVER_VOXEL_SIZE;
const SINK = 0.01; // bases slightly below the grass, so no gap shows
const GRASS_WIND = { height: TUFT_HEIGHT_MAX, strength: 0.049, speed: 1.6 };

function geometry(grid: ReturnType<typeof buildTuft>, size: [number, number, number]): THREE.BufferGeometry {
  // Centered on its spot in X/Z, standing on the ground in Y.
  const origin = new THREE.Vector3((-size[0] * COVER_VOXEL_SIZE) / 2, -SINK, (-size[2] * COVER_VOXEL_SIZE) / 2);
  return greedyMesh(grid, COVER_PALETTE, COVER_VOXEL_SIZE, origin);
}

export const buildTuftGeometry = (size: number, shape: number) => geometry(buildTuft(size, shape), TUFT_GRID);
export const buildFlowerGeometry = (color: number, height: number) => geometry(buildFlower(color, height), FLOWER_GRID);
export const buildPebbleGeometry = (shape: number) => geometry(buildPebbles(shape), PEBBLE_GRID);

// Tuft size class from the scatter's scale: small at meadow edges, large in lush centers.
export function tuftSize(scale: number): number {
  return scale < 0.8 ? 0 : scale < 1.1 ? 1 : 2;
}

const snap = (v: number) => Math.round(v / COVER_VOXEL_SIZE) * COVER_VOXEL_SIZE;
// A per-item hash (from its snapped position) picks the model shape.
const itemHash = (item: ScatterItem) => hashCell(Math.round(item.x * 25), Math.round(item.z * 25), 13);

function place(item: ScatterItem, tint?: THREE.Color): VoxelPlacement {
  return {
    x: snap(item.x),
    y: item.y,
    z: snap(item.z),
    quarterTurns: Math.floor((item.rotation / (Math.PI * 2)) * 4) & 3,
    tint,
  };
}

// Returns a per-frame callback that advances the wind animation.
export function buildGroundCover(scene: THREE.Scene, model: GameModel): (elapsedSeconds: number) => void {
  const { tufts, flowers, pebbles } = scatterGroundCover(model);
  const plain = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

  const grassMaterial = plain();
  const windTime = addWindSway(grassMaterial, GRASS_WIND);
  addVoxelInstances(
    scene,
    tufts,
    (t) => `tuft:${tuftSize(t.scale)}:${itemHash(t) % TUFT_SHAPES}`,
    (t) => buildTuftGeometry(tuftSize(t.scale), itemHash(t) % TUFT_SHAPES),
    (t) =>
      place(
        t,
        new THREE.Color(TERRAIN_COLORS[t.tier % TERRAIN_COLORS.length]).multiplyScalar(TUFT_SHADES[t.variant] * TUFT_ROOT_LIFT),
      ),
    grassMaterial,
  );
  addVoxelInstances(
    scene,
    flowers,
    (f) => `flower:${f.variant}:${itemHash(f) % FLOWER_HEIGHTS}`,
    (f) => buildFlowerGeometry(f.variant, itemHash(f) % FLOWER_HEIGHTS),
    (f) => place(f),
    plain(),
  );
  addVoxelInstances(
    scene,
    pebbles,
    (p) => `pebble:${itemHash(p) % PEBBLE_SHAPES}`,
    (p) => buildPebbleGeometry(itemHash(p) % PEBBLE_SHAPES),
    (p) => place(p),
    plain(),
  );

  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
