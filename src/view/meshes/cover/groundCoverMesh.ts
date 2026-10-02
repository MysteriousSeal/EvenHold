// Draws the scattered ground cover as voxel models: grass tufts and sprigs
// that sway in the wind, wildflowers and pebble clusters. Positions come from
// groundCoverScatter.ts (the meadow patches' wildflowers: bloomVoxels.ts); here they're snapped to the 0.04 voxel grid and
// turned in quarter turns only, and each item's size picks a model rather
// than scaling one, so every voxel stays the same size as the world's.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { hashCell, snapTo } from '../../../util/random';
import { addWindSway } from '../common/wind';
import { TERRAIN_COLORS } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { voxelLayer, type VoxelPlacement } from '../voxel/voxelInstances';
import { allChunkKeys, chunkTiles } from '../../world/chunks';
import { createCoverScatter, type GroundCover, type ScatterItem } from './groundCoverScatter';
import {
  COVER_PALETTE,
  COVER_VOXEL_SIZE,
  FLOWER_GRID,
  FLOWER_HEIGHTS,
  PEBBLE_GRID,
  PEBBLE_SHAPES,
  SPRIG_GRID,
  SPRIG_SHAPES,
  TUFT_GRID,
  TUFT_SHAPES,
  TUFT_SIZES,
  buildFlower,
  buildPebbles,
  buildSprig,
  buildTuft,
} from './groundCoverVoxels';
import { BLOOM_GRID, BLOOM_KINDS, BLOOM_PALETTE, BLOOM_SHAPES, buildBloom } from './bloomVoxels';

const TUFT_SHADES = [0.92, 1.06]; // slight per-clump variation of the tile's green
// The blade palette's root shade is below white so tips can be lighter;
// this lifts the tint back so roots match the tile's green exactly.
const TUFT_ROOT_LIFT = 1 / new THREE.Color(COVER_PALETTE[0]).r;
const TUFT_HEIGHT_MAX = TUFT_SIZES[TUFT_SIZES.length - 1] * COVER_VOXEL_SIZE;
const SINK = 0.01; // bases slightly below the grass, so no gap shows
const GRASS_WIND = { height: TUFT_HEIGHT_MAX, strength: 0.049, speed: 1.6 };
const BLOOM_WIND = { height: BLOOM_GRID[1] * COVER_VOXEL_SIZE, strength: 0.04, speed: 1.4 };

function geometry(grid: ReturnType<typeof buildTuft>, size: [number, number, number]): THREE.BufferGeometry {
  // Centered on its spot in X/Z, standing on the ground in Y.
  const origin = new THREE.Vector3((-size[0] * COVER_VOXEL_SIZE) / 2, -SINK, (-size[2] * COVER_VOXEL_SIZE) / 2);
  return greedyMesh(grid, COVER_PALETTE, COVER_VOXEL_SIZE, origin);
}

export const buildTuftGeometry = (size: number, shape: number) => geometry(buildTuft(size, shape), TUFT_GRID);
export const buildFlowerGeometry = (color: number, height: number) => geometry(buildFlower(color, height), FLOWER_GRID);
export const buildPebbleGeometry = (shape: number) => geometry(buildPebbles(shape), PEBBLE_GRID);
export const buildSprigGeometry = (shape: number) => geometry(buildSprig(shape), SPRIG_GRID);

// Tuft size class from the scatter's scale: small at meadow edges, large in lush centers.
export function tuftSize(scale: number): number {
  return scale < 0.8 ? 0 : scale < 1.1 ? 1 : 2;
}

const snap = (v: number) => snapTo(v, COVER_VOXEL_SIZE);
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
export function buildGroundCover(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  // Scattered per chunk when the chunk is built; the layers ask for
  // the same chunk in turn, so the last one is kept.
  const scatter = createCoverScatter(model);
  let last: { key: string; cover: GroundCover } | null = null;
  const coverIn = (key: string): GroundCover => {
    if (last?.key !== key) {
      const { x0, z0, x1, z1 } = chunkTiles(key, model.size.width, model.size.depth);
      last = { key, cover: scatter(x0, z0, x1, z1) };
    }
    return last.cover;
  };
  const keys = () => allChunkKeys(model.size.width, model.size.depth);
  const plain = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

  const grassMaterial = plain();
  const windTime = addWindSway(grassMaterial, GRASS_WIND);
  const grassTint = (item: ScatterItem) =>
    new THREE.Color(TERRAIN_COLORS[item.tier % TERRAIN_COLORS.length]).multiplyScalar(TUFT_SHADES[item.variant] * TUFT_ROOT_LIFT);
  scene.layer(voxelLayer(
    keys,
    (key) => coverIn(key).sprigs,
    (s) => `sprig:${itemHash(s) % SPRIG_SHAPES}`,
    (s) => buildSprigGeometry(itemHash(s) % SPRIG_SHAPES),
    (s) => place(s, grassTint(s)),
    grassMaterial,
  ));
  scene.layer(voxelLayer(
    keys,
    (key) => coverIn(key).tufts,
    (t) => `tuft:${tuftSize(t.scale)}:${itemHash(t) % TUFT_SHAPES}`,
    (t) => buildTuftGeometry(tuftSize(t.scale), itemHash(t) % TUFT_SHAPES),
    (t) => place(t, grassTint(t)),
    grassMaterial,
  ));
  scene.layer(voxelLayer(
    keys,
    (key) => coverIn(key).flowers,
    (f) => `flower:${f.variant}:${itemHash(f) % FLOWER_HEIGHTS}`,
    (f) => buildFlowerGeometry(f.variant, itemHash(f) % FLOWER_HEIGHTS),
    (f) => place(f),
    plain(),
  ));
  // The meadow patches' wildflowers, swaying as the grass does (a little less: their heads are heavier).
  const bloomMaterial = plain();
  const bloomTime = addWindSway(bloomMaterial, BLOOM_WIND);
  scene.layer(voxelLayer(
    keys,
    (key) => coverIn(key).blooms,
    (b) => `bloom:${b.variant}:${itemHash(b) % BLOOM_SHAPES}`,
    (b) => greedyMesh(buildBloom(BLOOM_KINDS[b.variant], itemHash(b) % BLOOM_SHAPES), BLOOM_PALETTE, COVER_VOXEL_SIZE, new THREE.Vector3((-BLOOM_GRID[0] * COVER_VOXEL_SIZE) / 2, -SINK, (-BLOOM_GRID[2] * COVER_VOXEL_SIZE) / 2)),
    (b) => place(b),
    bloomMaterial,
  ));
  scene.layer(voxelLayer(
    keys,
    (key) => coverIn(key).pebbles,
    (p) => `pebble:${itemHash(p) % PEBBLE_SHAPES}`,
    (p) => buildPebbleGeometry(itemHash(p) % PEBBLE_SHAPES),
    (p) => place(p),
    plain(),
  ));

  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
    bloomTime.value = elapsedSeconds;
  };
}
