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

import type { Tiles } from '../../../model/map/tiles';
import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import { chunkKeysIn, chunkTilesIn } from '../../world/chunks';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT, WATER_LEVEL } from '../../../model/constants';
import { NEIGHBORS_4, inBounds, type Area } from '../../../model/map/grid';
import { hashCell, snapTo } from '../../../util/random';
import { WATER_COLORS } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { voxelLayer } from '../voxel/voxelInstances';
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

// Chebyshev distance, in tiles, from each lake tile of `area` (the whole map, by default) to the nearest land tile
// (0 on land), by breadth-first search from all land at once; land as far as SHORE_REACH round the area counted (past
// that, the shore's texture is past telling: DISTANCE_SCALE). Indexed (x - x0) + (z - z0) * width.
const SHORE_REACH = 16;
export function shoreDistances(tiles: Tiles, area: { x0: number; z0: number; width: number; depth: number } = { x0: 0, z0: 0, ...tiles.size }): Uint16Array {
  const [x0, z0] = [Math.max(0, area.x0 - SHORE_REACH), Math.max(0, area.z0 - SHORE_REACH)]; // (searched over the area and a margin)
  const [x1, z1] = [Math.min(tiles.size.width, area.x0 + area.width + SHORE_REACH), Math.min(tiles.size.depth, area.z0 + area.depth + SHORE_REACH)];
  const width = x1 - x0;
  const depth = z1 - z0;
  // Each tile's water read once (the tiles asked for each, not for each of their neighbours: a region's hundreds of
  // thousands of them), then all from that.
  const water = new Uint8Array(width * depth);
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) if (tiles.lake(x, z)) water[x - x0 + (z - z0) * width] = 1;
  const near = new Uint16Array(width * depth);
  // Water's far from land till found nearer; the search starts from the land at its shores only (what's inland never
  // reaches it but through them), each step out into the water.
  const queue = new Int32Array(near.length);
  let tail = 0;
  for (let v = 0; v < depth; v++) {
    for (let u = 0; u < width; u++) {
      const i = u + v * width;
      if (water[i]) {
        near[i] = 0xffff;
        continue;
      }
      if (!tiles.has(u + x0, v + z0)) continue;
      let shore = false;
      for (let du = -1; du <= 1 && !shore; du++) for (let dv = -1; dv <= 1 && !shore; dv++) shore = u + du >= 0 && v + dv >= 0 && u + du < width && v + dv < depth && water[u + du + (v + dv) * width] === 1;
      if (shore) queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    const cell = queue[head];
    const u = cell % width;
    const v = (cell - u) / width;
    for (let du = -1; du <= 1; du++) {
      for (let dv = -1; dv <= 1; dv++) {
        const [nu, nv] = [u + du, v + dv];
        if (nu < 0 || nv < 0 || nu >= width || nv >= z1 - z0 || near[nu + nv * width] !== 0xffff) continue;
        near[nu + nv * width] = near[cell] + 1;
        queue[tail++] = nu + nv * width;
      }
    }
  }
  const distance = new Uint16Array(area.width * area.depth);
  for (let x = 0; x < area.width; x++) for (let z = 0; z < area.depth; z++) distance[x + z * area.width] = near[area.x0 + x - x0 + (area.z0 + z - z0) * width];
  return distance;
}

const color = (hex: number) => ({ value: new THREE.Color(hex) });

// (Its shore by `area`'s texture: where it is and how big, a uniform, so every region's water is the one program.)
function waterMaterial(shore: THREE.DataTexture, area: Area, time: { value: number }): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: time,
      uShore: { value: shore },
      uShoreAt: { value: new THREE.Vector4(area.x0, area.z0, area.x1 - area.x0, area.z1 - area.z0) },
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
        uniform vec4 uShoreAt; // (its texture's first tile, and how many across and along)
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
        float shore = texture2D(uShore, (center - uShoreAt.xy + 0.5) / uShoreAt.zw).r
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
const snap = (v: number) => snapTo(v, WATER_DECOR_VOXEL_SIZE);

// Lilies and reeds over `area` (a chunk), by its shore distances.
function placeDecor(model: GameModel, area: Area, distance: Uint16Array): { lilies: Decor[]; reeds: Decor[] } {
  const { x0, z0, x1, z1 } = area;
  const lilies: Decor[] = [];
  const reeds: Decor[] = [];
  const lake = (x: number, z: number) => (x >= x0 && z >= z0 && x < x1 && z < z1 ? distance[x - x0 + (z - z0) * (x1 - x0)] !== 0 : model.tiles.lake(x, z)); // (its distances: land's 0)
  for (let x = x0; x < x1; x++) {
    for (let z = z0; z < z1; z++) {
      const d = distance[x - x0 + (z - z0) * (x1 - x0)];
      if (d === 0) continue; // (land)
      const h = hashCell(x, z, 11);
      const roll = (h % 1000) / 1000;
      const quarterTurns = (h >>> 10) & 3;

      // Reeds grow against a bank the tile shares an edge with.
      const banks = NEIGHBORS_4.filter(([dx, dz]) => inBounds(model.size, x + dx, z + dz) && !lake(x + dx, z + dz));
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
// Its lakes, a chunk at a time as each is built (near the hero): its shore's distances worked out then (over the chunk
// and a margin) into the area's shore texture, its water and the lilies and reeds on it. Nothing worked out up front.
export function buildWater(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const area = model.area; // (its own part of the map: a streamed world's region)
  const [width, depth] = [area.x1 - area.x0, area.z1 - area.z0];
  const shore = new Uint8Array(width * depth);
  const texture = new THREE.DataTexture(shore, width, depth, THREE.RedFormat, THREE.UnsignedByteType);
  [texture.magFilter, texture.minFilter] = [THREE.LinearFilter, THREE.LinearFilter];
  const time = { value: 0 };
  const material = waterMaterial(texture, area, time);
  // A chunk's shore distances (each layer asks for the same chunk in turn: the last kept), written into the texture.
  let last: { key: string; tiles: Area; distance: Uint16Array } | null = null;
  const chunk = (key: string) => {
    if (last?.key !== key) {
      const tiles = chunkTilesIn(key, area); // (its own part of the map only)
      if (!tiles) return null;
      const [w, d] = [tiles.x1 - tiles.x0, tiles.z1 - tiles.z0];
      const distance = shoreDistances(model.tiles, { x0: tiles.x0, z0: tiles.z0, width: w, depth: d });
      for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) shore[tiles.x0 - area.x0 + x + (tiles.z0 - area.z0 + z) * width] = Math.min(255, distance[x + z * w] * DISTANCE_SCALE);
      texture.needsUpdate = true;
      last = { key, tiles, distance };
    }
    return last;
  };

  // Columns span from one tier below ground up to the flat lake surface.
  const columnHeight = (WATER_LEVEL + 1) * TILE_HEIGHT;
  const matrix = new THREE.Matrix4();
  let column: THREE.BufferGeometry | null = null;
  scene.layer({
    materials: [material],
    chunkKeys: () => chunkKeysIn(area),
    build(key) {
      const at = chunk(key);
      if (!at) return [];
      const { tiles, distance } = at;
      const w = tiles.x1 - tiles.x0;
      const cells: Array<[number, number]> = [];
      for (let x = tiles.x0; x < tiles.x1; x++) for (let z = tiles.z0; z < tiles.z1; z++) if (distance[x - tiles.x0 + (z - tiles.z0) * w] !== 0) cells.push([x, z]);
      if (cells.length === 0) return [];
      column ??= new THREE.BoxGeometry(1, columnHeight, 1);
      const mesh = new THREE.InstancedMesh(column, material, cells.length);
      cells.forEach(([x, z], i) => mesh.setMatrixAt(i, matrix.makeTranslation(x, SURFACE_Y - columnHeight / 2, z)));
      return [mesh];
    },
    dispose() {
      column?.dispose();
      texture.dispose();
    },
  });

  const decorIn = (key: string) => {
    const at = chunk(key);
    return at ? placeDecor(model, at.tiles, at.distance) : { lilies: [], reeds: [] };
  };
  const decorMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const place = (item: Decor) => ({ x: item.x, y: SURFACE_Y, z: item.z, quarterTurns: item.quarterTurns });
  const keys = () => chunkKeysIn(area);
  scene.layer(voxelLayer(keys, (key) => decorIn(key).lilies, (l) => `lily:${l.variant}`, (l) => buildLilyGeometry(l.variant), place, decorMaterial));
  scene.layer(voxelLayer(keys, (key) => decorIn(key).reeds, (r) => `reed:${r.variant}`, (r) => buildReedGeometry(r.variant), place, decorMaterial));

  return (elapsedSeconds) => {
    time.value = elapsedSeconds;
  };
}
