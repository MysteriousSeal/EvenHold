// Voxel lakes. The water body stays one flat column per lake tile (no extra
// geometry), and its shader draws the surface as 0.04 voxels: every
// fragment snaps to the voxel cell it's in and colors the whole cell from
//
// - its distance to the shore (warm turquoise shallows to deep teal),
// - drifting ripple crests (animated value noise),
// - a foam rim that breathes in and out along the bank,
// - rare sparkles, emissive enough to catch the bloom.
//
// The shore distance comes from a per-tile texture sampled with linear
// filtering: land tiles hold 0 and water tiles their tile distance to land,
// so the interpolated value crosses 0.5 exactly at a straight shoreline.
// Lily pads and reeds are voxel models, placed by position hash like the
// rest of the visual-only decor so the world rng stream is untouched.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { allChunkKeys, chunkTiles } from '../common/chunks';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT, WATER_LEVEL } from '../../../model/constants';
import { NEIGHBORS_4, inBounds, sizeOf, type MapSize } from '../../../model/grid';
import { hashCell } from '../../../util/random';
import { WATER_COLORS } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import {
  LILY_GRID,
  LILY_VARIANTS,
  REED_GRID,
  REED_VARIANTS,
  WATER_DECOR_PALETTE,
  WATER_DECOR_VOXEL_SIZE,
  buildLilyPad,
  buildReeds,
} from './waterVoxels';

const DISTANCE_SCALE = 16; // texture stores tile distance x16 (up to ~16 tiles)
const SURFACE_Y = WATER_LEVEL * TILE_HEIGHT;
const LILY_CHANCE = 0.16;
const REED_CHANCE = 0.4;

// Chebyshev distance, in tiles, from each lake tile to the nearest land tile
// (0 on land), by breadth-first search from all land at once.
export function shoreDistances(lakeMap: boolean[][]): Uint16Array {
  const size = sizeOf(lakeMap);
  const width = size.width;
  const distance = new Uint16Array(size.width * size.depth).fill(0xffff);
  const queue: number[] = [];
  for (let x = 0; x < size.width; x++) {
    for (let z = 0; z < size.depth; z++) {
      if (!lakeMap[x][z]) {
        distance[x + z * width] = 0;
        queue.push(x + z * width);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = cell % width;
    const z = (cell - x) / width;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds(size, nx, nz) || distance[nx + nz * width] !== 0xffff) continue;
        distance[nx + nz * width] = distance[cell] + 1;
        queue.push(nx + nz * width);
      }
    }
  }
  return distance;
}

function shoreTexture(distance: Uint16Array, size: MapSize): THREE.DataTexture {
  const data = new Uint8Array(distance.length);
  distance.forEach((d, i) => (data[i] = Math.min(255, d * DISTANCE_SCALE)));
  const texture = new THREE.DataTexture(data, size.width, size.depth, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const color = (hex: number) => ({ value: new THREE.Color(hex) });

function waterMaterial(shore: THREE.DataTexture, size: MapSize, time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: time,
      uShore: { value: shore },
      uShallow: color(WATER_COLORS.shallow),
      uMid: color(WATER_COLORS.mid),
      uDeep: color(WATER_COLORS.deep),
      uDeepest: color(WATER_COLORS.deepest),
      uCrest: color(WATER_COLORS.crest),
      uFoam: color(WATER_COLORS.foam),
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;\nvarying float vWaterTop;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWaterWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vWaterTop = step(0.5, normal.y);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWaterWorld;
        varying float vWaterTop;
        uniform float uTime;
        uniform sampler2D uShore;
        uniform vec3 uShallow, uMid, uDeep, uDeepest, uCrest, uFoam;
        float waterHash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float waterNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), f.x),
                     mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Snap to the voxel cell (tiles span [x - 0.5, x + 0.5], 25 voxels each).
        vec2 cell = floor((vWaterWorld.xz + 0.5) * 25.0);
        vec2 center = (cell + 0.5) / 25.0 - 0.5;
        float n = waterHash(cell);
        float shore = texture2D(uShore, (center + 0.5) / vec2(${size.width.toFixed(1)}, ${size.depth.toFixed(1)})).r
          * ${(255 / DISTANCE_SCALE).toFixed(4)} - 0.5;

        // Depth bands, their edges dithered per voxel.
        float s = shore + (n - 0.5) * 0.14;
        vec3 water = s < 0.35 ? uShallow : s < 1.0 ? uMid : s < 2.2 ? uDeep : uDeepest;

        // Ripple crests: two layers of noise drifting in different directions.
        float ripple = waterNoise(center * 3.2 + vec2(uTime * 0.3, uTime * 0.17)) * 0.6
                     + waterNoise(center * 7.5 - vec2(uTime * 0.21, -uTime * 0.35)) * 0.4;
        if (ripple > 0.72) water = mix(water, uCrest, 0.5);
        else if (ripple < 0.2) water *= 0.93;

        // Foam rim breathing along the bank, plus loose flecks just beyond it.
        float rim = 0.07 + 0.05 * (0.5 + 0.5 * sin(uTime * 1.6 + (center.x * 1.3 + center.y) * 2.2));
        float foam = max(step(shore, rim), step(shore, rim + 0.1) * step(0.75, n));
        water = mix(water, uFoam, foam);

        // Sparkles: each voxel rolls again a couple of times a second.
        float slot = floor(uTime * 1.5 + n * 7.0);
        float sparkle = step(0.9994, waterHash(cell + slot * 13.7)) * step(0.4, shore) * vWaterTop;
        water = mix(water, vec3(1.0), sparkle);
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.8) * sparkle * 1.5;

        // Column sides (seen at map edges) are plain deep water.
        diffuseColor.rgb = mix(uDeep, water, vWaterTop);`,
      );
  };
  return material;
}

interface Decor {
  x: number;
  z: number;
  variant: number;
  quarterTurns: number;
}

// Voxel offsets keep decor on the 0.04 grid, like everything else.
const snap = (v: number) => Math.round(v / WATER_DECOR_VOXEL_SIZE) * WATER_DECOR_VOXEL_SIZE;

function placeDecor(model: GameModel, distance: Uint16Array): { lilies: Decor[]; reeds: Decor[] } {
  const lilies: Decor[] = [];
  const reeds: Decor[] = [];
  for (let x = 0; x < model.size.width; x++) {
    for (let z = 0; z < model.size.depth; z++) {
      if (!model.lakeMap[x][z]) continue;
      const d = distance[x + z * model.size.width];
      const h = hashCell(x, z, 11);
      const roll = (h % 1000) / 1000;
      const quarterTurns = (h >>> 10) & 3;

      // Reeds grow against a bank the tile shares an edge with.
      const banks = NEIGHBORS_4.filter(([dx, dz]) => inBounds(model.size, x + dx, z + dz) && !model.lakeMap[x + dx][z + dz]);
      if (banks.length > 0 && roll < REED_CHANCE) {
        const [dx, dz] = banks[(h >>> 12) % banks.length];
        reeds.push({ x: x + dx * 0.32, z: z + dz * 0.32, variant: (h >>> 14) % REED_VARIANTS, quarterTurns });
        continue;
      }
      // Lily pads float a little way out, never right against the bank.
      if (d >= 1 && d <= 4 && roll > 1 - LILY_CHANCE) {
        const reach = d === 1 ? 0.08 : 0.28;
        const ox = snap((((h >>> 16) & 255) / 255 - 0.5) * 2 * reach);
        const oz = snap((((h >>> 24) & 255) / 255 - 0.5) * 2 * reach);
        lilies.push({ x: x + ox, z: z + oz, variant: (h >>> 8) % LILY_VARIANTS, quarterTurns });
      }
    }
  }
  return { lilies, reeds };
}

function centeredOrigin(grid: [number, number, number], sink: number): THREE.Vector3 {
  return new THREE.Vector3((-grid[0] * WATER_DECOR_VOXEL_SIZE) / 2, -sink, (-grid[2] * WATER_DECOR_VOXEL_SIZE) / 2);
}

export function buildLilyGeometry(variant: number): THREE.BufferGeometry {
  // Half a voxel under the surface, so the pad floats just above it.
  return greedyMesh(buildLilyPad(variant), WATER_DECOR_PALETTE, WATER_DECOR_VOXEL_SIZE, centeredOrigin(LILY_GRID, 0.02));
}

export function buildReedGeometry(variant: number): THREE.BufferGeometry {
  return greedyMesh(buildReeds(variant), WATER_DECOR_PALETTE, WATER_DECOR_VOXEL_SIZE, centeredOrigin(REED_GRID, 0.04));
}

// Returns the per-frame animation (water time).
export function buildWater(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const distance = shoreDistances(model.lakeMap);
  const time = { value: 0 };
  const material = waterMaterial(shoreTexture(distance, model.size), model.size, time);

  // Columns span from one tier below ground up to the flat lake surface.
  const columnHeight = (WATER_LEVEL + 1) * TILE_HEIGHT;
  const matrix = new THREE.Matrix4();
  let column: THREE.BufferGeometry | null = null;
  scene.layer({
    materials: [material],
    chunkKeys: () => allChunkKeys(model.size.width, model.size.depth),
    build(key) {
      const { x0, z0, x1, z1 } = chunkTiles(key, model.size.width, model.size.depth);
      const cells: Array<[number, number]> = [];
      for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) if (model.lakeMap[x][z]) cells.push([x, z]);
      if (cells.length === 0) return [];
      column ??= new THREE.BoxGeometry(1, columnHeight, 1);
      const mesh = new THREE.InstancedMesh(column, material, cells.length);
      cells.forEach(([x, z], i) => mesh.setMatrixAt(i, matrix.makeTranslation(x, SURFACE_Y - columnHeight / 2, z)));
      return [mesh];
    },
  });

  const { lilies, reeds } = placeDecor(model, distance);
  const decorMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const place = (item: Decor) => ({ x: item.x, y: SURFACE_Y, z: item.z, quarterTurns: item.quarterTurns });
  addVoxelInstances(scene, lilies, (l) => `lily:${l.variant}`, (l) => buildLilyGeometry(l.variant), place, decorMaterial);
  addVoxelInstances(scene, reeds, (r) => `reed:${r.variant}`, (r) => buildReedGeometry(r.variant), place, decorMaterial);

  return (elapsedSeconds) => {
    time.value = elapsedSeconds;
  };
}
