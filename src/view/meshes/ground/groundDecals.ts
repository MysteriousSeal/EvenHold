// Village squares and trails, drawn as thin overlays on top of the grass
// rather than as recolored tiles — a whole 1x1 tile is as wide as a house.
// Roads are textured dirt with a pair of darker wheel ruts; squares are
// cobbled. Textures are mapped in world space (one copy per tile), so the
// pattern lines up with the grid and overlapping pieces match seamlessly.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameModel } from '../../../model/GameModel';
import type { Village } from '../../../model/types';
import { TILE_HEIGHT, VILLAGE_OUTER_RADIUS } from '../../../model/constants';
import { toCellX, toCellZ } from '../../../model/grid';
import { PATH_COLOR, ROAD_WIDTH, RUT_COLOR } from '../../constants';
import { createCobbleTexture, createDirtTexture } from './roadTextures';

const RUT_WIDTH = 0.05;
const RUT_OFFSET = 0.12; // from the road's center line to each rut's center
const SQUARE_HALF_SIZE = VILLAGE_OUTER_RADIUS + 0.5; // covers the house ring, so houses stand on it
const THICKNESS = 0.012;
// Heights above the tile top: enough to avoid z-fighting with it, with
// ruts above the road and squares above both, so each covers the one below.
const ROAD_LIFT = 0.004;
const RUT_LIFT = 0.007;
const SQUARE_LIFT = 0.01;

type Point = [number, number];

// Flat strip from (ax, az) to (bx, bz), `width` wide, with each end pushed
// out (or pulled in, if negative) by the given pad along the strip.
function strip(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y: number,
  width: number,
  startPad: number,
  endPad: number,
): THREE.BufferGeometry {
  const length = Math.hypot(bx - ax, bz - az);
  const g = new THREE.BoxGeometry(width, THICKNESS, length + startPad + endPad);
  g.translate(0, 0, (endPad - startPad) / 2);
  g.rotateY(Math.atan2(bx - ax, bz - az));
  g.translate((ax + bx) / 2, y + THICKNESS / 2, (az + bz) / 2);
  return g.toNonIndexed();
}

// One straight run (padded at its true ends), cut wherever it crosses onto
// a tile of a different tier; each piece sits at its own tile's height so
// it hugs the terrain instead of floating across a step. Internal cut
// points get no padding, so pieces never overhang the lower tile.
function runOnTerrain(
  model: GameModel,
  [ax, az]: Point,
  [bx, bz]: Point,
  width: number,
  lift: number,
  startPad: number,
  endPad: number,
): THREE.BufferGeometry[] {
  const tierAt = (x: number, z: number) => model.heightMap[toCellX(x)][toCellZ(z)];
  const length = Math.hypot(bx - ax, bz - az);
  const samples = Math.max(1, Math.ceil(length / 0.02));
  const parts: THREE.BufferGeometry[] = [];

  let pieceStart = 0;
  let pieceTier = tierAt(ax, az);
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const tier = i === samples ? -1 : tierAt(ax + (bx - ax) * t, az + (bz - az) * t);
    if (tier === pieceTier) continue;
    parts.push(
      strip(
        ax + (bx - ax) * pieceStart,
        az + (bz - az) * pieceStart,
        ax + (bx - ax) * t,
        az + (bz - az) * t,
        pieceTier * TILE_HEIGHT + lift,
        width,
        pieceStart === 0 ? startPad : 0,
        i === samples ? endPad : 0,
      ),
    );
    pieceStart = t;
    pieceTier = tier;
  }
  return parts;
}

// Keeps only the corners of a grid route: drops every point that continues
// straight on from the previous one, so each straight grid-aligned run
// becomes a single strip with sharp right-angle joints.
function corners(route: Point[]): Point[] {
  if (route.length < 3) return route;
  const kept: Point[] = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const [px, pz] = route[i - 1];
    const [x, z] = route[i];
    const [nx, nz] = route[i + 1];
    if (x - px !== nx - x || z - pz !== nz - z) kept.push(route[i]);
  }
  kept.push(route[route.length - 1]);
  return kept;
}

function direction([ax, az]: Point, [bx, bz]: Point): Point {
  const length = Math.hypot(bx - ax, bz - az);
  return [(bx - ax) / length, (bz - az) / length];
}

// Left-hand normal of a direction.
function normal([dx, dz]: Point): Point {
  return [-dz, dx];
}

// Road strips (padded half a width at every end, so runs overlap into
// sharp square corners) plus two ruts per run. Each rut is offset
// sideways from the center line; at a corner it's extended or shortened
// to exactly where it meets the matching rut of the next run, so the
// ruts turn in a clean L instead of crossing or leaving a gap.
function trailGeometry(model: GameModel): { road: THREE.BufferGeometry[]; ruts: THREE.BufferGeometry[] } {
  const road: THREE.BufferGeometry[] = [];
  const ruts: THREE.BufferGeometry[] = [];

  for (const route of model.trails) {
    const points = corners(route);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      road.push(...runOnTerrain(model, a, b, ROAD_WIDTH, ROAD_LIFT, ROAD_WIDTH / 2, ROAD_WIDTH / 2));

      const d = direction(a, b);
      const n = normal(d);
      const prevNormal = i > 0 ? normal(direction(points[i - 1], a)) : null;
      const nextNormal = i < points.length - 2 ? normal(direction(b, points[i + 2])) : null;
      const dot = (p: Point, q: Point) => p[0] * q[0] + p[1] * q[1];

      for (const side of [-1, 1]) {
        const offset = side * RUT_OFFSET;
        // Plus half a rut width, so the two ruts overlap into a solid corner.
        const startPad = prevNormal ? -offset * dot(prevNormal, d) + RUT_WIDTH / 2 : 0;
        const endPad = nextNormal ? offset * dot(nextNormal, d) + RUT_WIDTH / 2 : 0;
        const shift = (p: Point): Point => [p[0] + n[0] * offset, p[1] + n[1] * offset];
        ruts.push(...runOnTerrain(model, shift(a), shift(b), RUT_WIDTH, RUT_LIFT, startPad, endPad));
      }
    }
  }
  return { road, ruts };
}

function square(village: Village): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(SQUARE_HALF_SIZE * 2, THICKNESS, SQUARE_HALF_SIZE * 2);
  g.translate(village.x, village.groundTier * TILE_HEIGHT + SQUARE_LIFT + THICKNESS / 2, village.z);
  return g.toNonIndexed();
}

// World-space planar UVs: one texture copy per tile, aligned with tile
// edges (tile centers sit on integer coordinates, so edges are at .5).
function withWorldUVs(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = position.getX(i) + 0.5;
    uv[i * 2 + 1] = position.getZ(i) + 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function buildGroundDecals(scene: THREE.Scene, model: GameModel): void {
  const { road, ruts } = trailGeometry(model);

  if (road.length > 0) {
    const dirt = new THREE.MeshStandardMaterial({ map: createDirtTexture(PATH_COLOR), roughness: 1 });
    scene.add(new THREE.Mesh(withWorldUVs(mergeGeometries(road)!), dirt));
    scene.add(new THREE.Mesh(mergeGeometries(ruts)!, new THREE.MeshStandardMaterial({ color: RUT_COLOR, roughness: 1 })));
  }

  if (model.villages.length > 0) {
    const cobbles = new THREE.MeshStandardMaterial({ map: createCobbleTexture(), roughness: 0.95 });
    scene.add(new THREE.Mesh(withWorldUVs(mergeGeometries(model.villages.map(square))!), cobbles));
  }
}
