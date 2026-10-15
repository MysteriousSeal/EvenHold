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
import { chunkKeysIn, chunkTilesIn } from '../../world/chunks';
import { createCoverScatter, type GroundCover, type ScatterItem, type WildItem } from './groundCoverScatter';
import { groundTint } from '../terrain/biomeGround';
import type { WildKind } from './biomeCover';
import {
  FERN_GRID, FERN_SHAPES, HEATHER_GRID, HEATHER_SHAPES, MUSHROOM_GRID, MUSHROOM_SHAPES, REED_GRID, REED_SHAPES, STONE_GRID, STONE_SHAPES, WILD_PALETTE,
  buildFern, buildHeather, buildMushrooms, buildReeds, buildStone,
} from './wildVoxels';
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
const FROND_WIND = { height: FERN_GRID[1] * COVER_VOXEL_SIZE, strength: 0.03, speed: 1.3 }; // ferns and heather: a little
const REED_WIND = { height: REED_GRID[1] * COVER_VOXEL_SIZE, strength: 0.07, speed: 1.7, flutter: 0.003 }; // reeds: tall and whippy

// The country's own plants (wildVoxels.ts): each kind's grid, its shapes, its maker, and whether it sways (and how).
const WILD: Record<WildKind, { grid: [number, number, number]; shapes: number; build: (shape: number) => ReturnType<typeof buildFern>; sway: 'frond' | 'reed' | null }> = {
  fern: { grid: FERN_GRID, shapes: FERN_SHAPES, build: buildFern, sway: 'frond' },
  heather: { grid: HEATHER_GRID, shapes: HEATHER_SHAPES, build: buildHeather, sway: 'frond' },
  reed: { grid: REED_GRID, shapes: REED_SHAPES, build: buildReeds, sway: 'reed' },
  mushroom: { grid: MUSHROOM_GRID, shapes: MUSHROOM_SHAPES, build: buildMushrooms, sway: null },
  stone: { grid: STONE_GRID, shapes: STONE_SHAPES, build: buildStone, sway: null },
};
const wildShape = (w: WildItem) => w.variant % WILD[w.kind].shapes;

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
      const { x0, z0, x1, z1 } = chunkTilesIn(key, model.area) ?? { x0: 0, z0: 0, x1: 0, z1: 0 }; // (its own part of the map only: else none)
      last = { key, cover: scatter(x0, z0, x1, z1) };
    }
    return last.cover;
  };
  const keys = () => chunkKeysIn(model.area); // (its own part of the map: a streamed world's region)
  const plain = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

  const grassMaterial = plain();
  const windTime = addWindSway(grassMaterial, GRASS_WIND);
  const grassTint = (item: ScatterItem) =>
    new THREE.Color(TERRAIN_COLORS[item.tier % TERRAIN_COLORS.length]).multiplyScalar(TUFT_SHADES[item.variant] * TUFT_ROOT_LIFT).multiply(groundTint(item.country ?? 'meadow', item.tier));
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

  // The country's own plants: those that sway (ferns and heather a little, reeds more), and those that don't.
  const frondMaterial = plain();
  const reedMaterial = plain();
  const frondTime = addWindSway(frondMaterial, FROND_WIND);
  const reedTime = addWindSway(reedMaterial, REED_WIND);
  const stillMaterial = plain();
  const sways = { frond: frondMaterial, reed: reedMaterial };
  for (const [way, material] of [...Object.entries(sways), ['still', stillMaterial] as const]) {
    scene.layer(voxelLayer(
      keys,
      (key) => coverIn(key).wild.filter((w) => (WILD[w.kind].sway ?? 'still') === way),
      (w) => `wild:${w.kind}:${wildShape(w)}`,
      (w) => {
        const [sx, , sz] = WILD[w.kind].grid;
        return greedyMesh(WILD[w.kind].build(wildShape(w)), WILD_PALETTE, COVER_VOXEL_SIZE, new THREE.Vector3((-sx * COVER_VOXEL_SIZE) / 2, -SINK, (-sz * COVER_VOXEL_SIZE) / 2));
      },
      (w) => place(w),
      material,
    ));
  }

  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
    bloomTime.value = elapsedSeconds;
    frondTime.value = elapsedSeconds;
    reedTime.value = elapsedSeconds;
  };
}
