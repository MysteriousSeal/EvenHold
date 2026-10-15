// What every dungeon's scene is built with (a crypt's: crypt/cryptView.ts; a
// cave's: cave/caveView.ts), in its own room tiles:
// - its pieces (a floor tile, a tomb, a stalagmite), each kind meshed once and
//   set down wherever it goes, turned as it faces (its lit voxels, and what
//   glows of it drawn unlit);
// - the rock that can hide the hero (between the camera and the floor), each
//   tile drawn twice, solid and see-through, the one shown as the hero's
//   behind it or not;
// - only the faces the camera can ever see (it looks down from +x +z, never turning: a face toward -x, -z or down is
//   never drawn, and is left out of what's drawn: the renderer counts and transforms every triangle it's given);
// - its lights: the nearest few of its lights to the hero lit as they go,
//   flickering, and a faint light about the hero.

import * as THREE from 'three';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { CAMERA_OFFSET } from '../constants';

// `geometry` with only its faces the camera can see (turned `turns` quarter turns about the vertical, as it's set
// down): those whose normal leans toward it. A new geometry, or `geometry` itself if every face is seen.
export function seenFaces(geometry: THREE.BufferGeometry, turns = 0): THREE.BufferGeometry {
  const normal = geometry.getAttribute('normal');
  if (!normal) return geometry;
  const toCamera = CAMERA_OFFSET.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (-turns * Math.PI) / 2); // (into the piece's own turn)
  const count = geometry.index ? geometry.index.count : normal.count;
  const corner = (i: number) => (geometry.index ? geometry.index.getX(i) : i);
  const kept: number[] = []; // the corners of the triangles kept
  for (let t = 0; t < count; t += 3) {
    const v = corner(t);
    if (normal.getX(v) * toCamera.x + normal.getY(v) * toCamera.y + normal.getZ(v) * toCamera.z > 1e-6) kept.push(corner(t), corner(t + 1), corner(t + 2));
  }
  if (kept.length === count) return geometry;
  const seen = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const size = attribute.itemSize;
    const values = new Float32Array(kept.length * size);
    kept.forEach((v, i) => {
      for (let k = 0; k < size; k++) values[i * size + k] = attribute.array[v * size + k];
    });
    seen.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  return seen;
}

const FEW = 20_000; // triangles, all a piece's set down: so few they're drawn whole, every turn of it at once
const few = (geometry: THREE.BufferGeometry, count: number) => ((geometry.index?.count ?? geometry.getAttribute('position').count) / 3) * count < FEW;

// Meshes a piece's grid from `origin` (its lit voxels, or what glows: `glow`); an empty geometry if there's none.
export type Mesher = (grid: VoxelGrid, origin: THREE.Vector3, glow: boolean) => THREE.BufferGeometry;

export interface Piece {
  build: () => VoxelGrid;
  origin: (grid: VoxelGrid) => THREE.Vector3; // where its grid's corner sits, from where it's set down
  at: Array<{ x: number; y: number; z: number; turns: number }>;
}

// The pieces, keyed by kind (and look), as they're set down; then made into the scene, each kind once.
export class Pieces {
  private readonly pieces = new Map<string, Piece>();

  place(key: string, build: () => VoxelGrid, origin: Piece['origin'], x: number, y: number, z: number, turns = 0): void {
    const piece = this.pieces.get(key) ?? { build, origin, at: [] };
    piece.at.push({ x, y, z, turns });
    this.pieces.set(key, piece);
  }

  // Each kind meshed once (lit, and glowing), instanced wherever it was set down; the geometries made (to free).
  build(scene: THREE.Scene, mesher: Mesher, lit: THREE.Material, glow: THREE.Material): THREE.BufferGeometry[] {
    const made: THREE.BufferGeometry[] = [];
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    for (const piece of this.pieces.values()) {
      const grid = piece.build();
      const origin = piece.origin(grid);
      for (const [material, glows] of [[lit, false], [glow, true]] as const) {
        const geometry = mesher(grid, origin, glows);
        if (!geometry.getAttribute('position')?.count) {
          geometry.dispose();
          continue;
        }
        made.push(geometry);
        // Those set down turned the same way together: their faces the camera sees, instanced wherever they were set down
        // (a piece of few triangles in all, all of it as one: a draw call more costs more than they do).
        const quarter = (a: Piece['at'][number]) => (few(geometry, piece.at.length) ? 0 : ((a.turns % 4) + 4) % 4);
        for (const turns of new Set(piece.at.map(quarter))) {
          const at = piece.at.filter((a) => quarter(a) === turns);
          const seen = few(geometry, piece.at.length) ? geometry : seenFaces(geometry, turns);
          if (seen !== geometry) made.push(seen);
          const mesh = new THREE.InstancedMesh(seen, material, at.length);
          at.forEach((a, i) => mesh.setMatrixAt(i, matrix.compose(new THREE.Vector3(a.x, a.y, a.z), turn.setFromAxisAngle(up, (a.turns * Math.PI) / 2), one)));
          mesh.instanceMatrix.needsUpdate = true;
          scene.add(mesh);
        }
      }
    }
    return made;
  }
}

const FADED = 0.22; // how solid faded rock looks
const FADE_ALONG = 3.5; // tiles in front of the hero (toward the camera) rock may hide him from
const FADE_ACROSS = 1.8; // and to either side of that line

// The rock that can hide the hero: `tiles` (each of a look, its geometry `geometries[variant]`, set down at `y`),
// drawn solid or see-through. fadeFor fades those just in front of the hero (toward the camera, +x +z). Each tile drawn
// the once: those solid laid out first in the solid mesh, those faded in the see-through one, each only as many as
// it has (never a hidden copy: the renderer draws every instance it's given, shrunk to nothing or not).
export function fadingRock(
  scene: THREE.Scene,
  tiles: ReadonlyArray<{ x: number; z: number; variant: number }>,
  geometries: readonly THREE.BufferGeometry[],
  lit: THREE.Material,
  y: number,
): { fadeFor(hx: number, hz: number): void; dispose(): void } {
  const ghost = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, opacity: FADED, depthWrite: false });
  const at = new THREE.Matrix4();
  const made: THREE.BufferGeometry[] = []; // (the geometries cut to what's seen)
  const walls = geometries.map((whole, variant) => {
    const geometry = seenFaces(whole); // (freed with it)
    if (geometry !== whole) made.push(geometry);
    const mine = tiles.filter((w) => w.variant === variant);
    const solid = new THREE.InstancedMesh(geometry, lit, Math.max(1, mine.length));
    const faded = new THREE.InstancedMesh(geometry, ghost, Math.max(1, mine.length));
    scene.add(solid, faded);
    return { tiles: mine, solid, faded };
  });
  // Each look's tiles laid out: those faded in the see-through mesh, the rest in the solid one.
  const lay = (fade: (t: { x: number; z: number }) => boolean) => {
    for (const w of walls) {
      let [solid, faded] = [0, 0];
      for (const t of w.tiles) {
        at.makeTranslation(t.x, y, t.z);
        if (fade(t)) w.faded.setMatrixAt(faded++, at);
        else w.solid.setMatrixAt(solid++, at);
      }
      [w.solid.count, w.faded.count] = [solid, faded];
      w.solid.instanceMatrix.needsUpdate = w.faded.instanceMatrix.needsUpdate = true;
      for (const mesh of [w.solid, w.faded]) mesh.computeBoundingSphere(); // (culled by where its tiles are now)
    }
  };
  lay(() => false);
  let fadedAt = ''; // the half-tile the rock was last faded for
  return {
    fadeFor(hx, hz) {
      const tile = `${Math.round(hx * 2)},${Math.round(hz * 2)}`;
      if (tile === fadedAt) return;
      fadedAt = tile;
      lay((t) => {
        const along = (t.x - hx + (t.z - hz)) / Math.SQRT2; // toward the camera
        const across = Math.abs(t.x - hx - (t.z - hz)) / Math.SQRT2;
        return along > -0.5 && along < FADE_ALONG && across < FADE_ACROSS;
      });
    },
    dispose() {
      ghost.dispose();
      for (const geometry of made) geometry.dispose();
    },
  };
}

export interface LightSource {
  x: number;
  y: number;
  z: number;
  strength: number;
  color?: number; // (else the pool's own)
}

// The nearest `count` of `sources` to the hero lit (placed again once they've gone RELIGHT on), flickering by `flicker`.
export function nearestLights(
  scene: THREE.Scene,
  sources: readonly LightSource[],
  count: number,
  color: number,
  reach: number,
  flicker: (time: number, i: number) => number,
): { seeHero(x: number, z: number): void; update(time: number): void } {
  const RELIGHT = 0.4;
  const pool = Array.from({ length: count }, () => {
    const light = new THREE.PointLight(color, 0, reach, 1.4);
    scene.add(light);
    return light;
  });
  let placedAt = { x: Infinity, z: Infinity };
  let shining: LightSource[] = [];
  return {
    seeHero(x, z) {
      if (Math.hypot(x - placedAt.x, z - placedAt.z) < RELIGHT) return;
      placedAt = { x, z };
      shining = [...sources].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, count);
      pool.forEach((light, i) => {
        if (!shining[i]) return;
        light.position.set(shining[i].x, shining[i].y, shining[i].z);
        light.color.setHex(shining[i].color ?? color);
      });
    },
    update(time) {
      pool.forEach((light, i) => (light.intensity = shining[i] ? shining[i].strength * flicker(time, i) : 0));
    },
  };
}

// What every dungeon's scene does as the hero moves and once it's left (a crypt's, cryptView.ts; a cave's,
// caveView.ts): a soft light about the hero, the rock before them turned see-through, the nearest lights lit; then
// all it made let go (its geometries, its materials, its rock).
export function undergroundScene(
  near: THREE.PointLight,
  rock: { fadeFor(hx: number, hz: number): void; dispose(): void },
  lights: { seeHero(x: number, z: number): void },
  made: readonly THREE.BufferGeometry[],
  materials: readonly THREE.Material[],
): { seeHero(x: number, z: number): void; dispose(): void } {
  return {
    seeHero(x, z) {
      near.position.set(x, 1.4, z);
      rock.fadeFor(x, z);
      lights.seeHero(x, z);
    },
    dispose() {
      for (const geometry of made) geometry.dispose();
      for (const material of materials) material.dispose();
      rock.dispose();
    },
  };
}
