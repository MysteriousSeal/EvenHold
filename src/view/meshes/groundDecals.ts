// Village squares and trails, drawn as thin dirt overlays on
// top of the grass rather than as recolored tiles — a whole 1x1 tile is as
// wide as a house, which made paths read as big slabs. All merged into a
// single mesh.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GameModel } from '../../model/GameModel';
import type { Village } from '../../model/types';
import { TILE_HEIGHT, VILLAGE_OUTER_RADIUS } from '../../model/constants';
import { toCellX, toCellZ } from '../../model/grid';
import { PATH_COLOR } from '../constants';

const PATH_WIDTH = 0.34;
const SQUARE_HALF_SIZE = VILLAGE_OUTER_RADIUS + 0.5; // covers the house ring, so houses stand on it
const THICKNESS = 0.012;
const LIFT = 0.004; // above the tile top, so the overlay doesn't z-fight with it


// Flat strip from (ax, az) to (bx, bz). `extendEnds` pushes each end out by
// half the width, so two strips meeting at a corner overlap into a sharp
// joint; pieces split at a tier change don't extend, so they never overhang
// (and float above) the lower tile.
function strip(ax: number, az: number, bx: number, bz: number, y: number, extendStart = true, extendEnd = true): THREE.BufferGeometry {
  const length = Math.hypot(bx - ax, bz - az);
  const ext = PATH_WIDTH / 2;
  const startPad = extendStart ? ext : 0;
  const endPad = extendEnd ? ext : 0;
  const g = new THREE.BoxGeometry(PATH_WIDTH, THICKNESS, length + startPad + endPad);
  g.translate(0, 0, (endPad - startPad) / 2);
  g.rotateY(Math.atan2(bx - ax, bz - az));
  g.translate((ax + bx) / 2, y + LIFT + THICKNESS / 2, (az + bz) / 2);
  return g.toNonIndexed();
}

function square(village: Village): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(SQUARE_HALF_SIZE * 2, THICKNESS, SQUARE_HALF_SIZE * 2);
  g.translate(village.x, village.groundTier * TILE_HEIGHT + LIFT + THICKNESS / 2, village.z);
  return g.toNonIndexed();
}

// Keeps only the corners of a grid route: drops every point that continues
// straight on from the previous one, so each straight grid-aligned run
// becomes a single strip with sharp right-angle joints.
function corners(route: Array<[number, number]>): Array<[number, number]> {
  if (route.length < 3) return route;
  const kept: Array<[number, number]> = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const [px, pz] = route[i - 1];
    const [x, z] = route[i];
    const [nx, nz] = route[i + 1];
    const straight = x - px === nx - x && z - pz === nz - z;
    if (!straight) kept.push(route[i]);
  }
  kept.push(route[route.length - 1]);
  return kept;
}

// One straight run, cut wherever it crosses onto a tile of a different
// tier; each piece is drawn at its own tile's height so the road hugs the
// terrain instead of floating across a step.
function runOnTerrain(model: GameModel, ax: number, az: number, bx: number, bz: number): THREE.BufferGeometry[] {
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
        pieceTier * TILE_HEIGHT,
        pieceStart === 0,
        i === samples,
      ),
    );
    pieceStart = t;
    pieceTier = tier;
  }
  return parts;
}

function trailPaths(model: GameModel): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const route of model.trails) {
    const points = corners(route);
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      parts.push(...runOnTerrain(model, ax, az, bx, bz));
    }
  }
  return parts;
}

export function buildGroundDecals(scene: THREE.Scene, model: GameModel): void {
  const parts = [...model.villages.map(square), ...trailPaths(model)];
  if (parts.length === 0) return;
  const material = new THREE.MeshStandardMaterial({ color: PATH_COLOR, roughness: 1 });
  scene.add(new THREE.Mesh(mergeGeometries(parts)!, material));
}
