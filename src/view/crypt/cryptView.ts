// A crypt's scene (model/crypts/), in its own room tiles as any room: built
// from a handful of voxel pieces (cryptVoxels.ts) repeated over its plan, not
// one grid (a crypt's far too big for that): flagstones on its floor, rock
// along its passages, full height all round (what's in front of the hero, as
// seen, turning see-through while he's behind it), the stairs up at its
// door, and its tombs and lights. Cold light all round, warm pools at the
// sconces and candles (the nearest few lit, as the hero goes), flickering.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { flicker } from '../meshes/common/fire';
import { isFloor, inFullView } from '../../model/crypts/cryptLayout';
import { FACINGS } from '../../model/map/grid';
import type { CryptInside } from '../../model/crypts/crypts';
import type { CryptProp } from '../../model/crypts/cryptProps';
import { CRYPT_PALETTE, CRYPT_VOXEL, GLOW, ON_WALL, TALL, TILE, cryptProp, stairsUp, wallTile } from './cryptVoxels';
import { FLOOR_DEEP, floorTile } from './cryptFloorVoxels';
import { ARCADE } from './cryptWallVoxels';

const LIGHTS = 6; // warm lights at once: the nearest light-giving props to the hero
const RELIGHT = 0.4; // tiles the hero moves before they're placed again
const LIT = new Set(['sconce', 'candles']);
const FADED = 0.22; // how solid faded rock looks
const FADE_ALONG = 3.5; // tiles in front of the hero (toward the camera) rock may hide him from
const FADE_ACROSS = 1.8; // and to either side of that line

interface Piece {
  key: string;
  onWall: boolean;
  build: () => VoxelGrid;
  at: Array<{ x: number; y: number; z: number; turns: number }>;
}

export function buildCryptScene(inside: CryptInside): { scene: THREE.Scene; update(time: number): void; dispose(): void; showMugs(): void; seeHero(x: number, z: number): void; forge(): void } {
  const { plan, props } = inside;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0c0b); // the dark beyond the rock
  const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const made: THREE.BufferGeometry[] = [];

  // Each kind of piece meshed once, then placed wherever it goes (its body lit, its flames glowing).
  const pieces = new Map<string, Piece>();
  const place = (key: string, build: () => VoxelGrid, x: number, y: number, z: number, turns = 0) => {
    const piece = pieces.get(key) ?? { key, onWall: ON_WALL.has(key.split(':')[0] as CryptProp['kind']), build, at: [] };
    piece.at.push({ x, y, z, turns });
    pieces.set(key, piece);
  };

  const hung = new Set(props.filter((p) => ON_WALL.has(p.kind)).map((p) => `${p.x},${p.z}`)); // rock with a sconce or a niche on it
  const fading: Array<{ x: number; z: number; variant: number }> = []; // rock that can hide the hero: see-through when he's behind it
  // The floor, a flagstone tile in one of four looks per tile; the rock beside it.
  const floor = (x: number, z: number) => isFloor(plan, x, z);
  for (let x = -1; x <= plan.width; x++) {
    for (let z = -1; z <= plan.depth; z++) {
      if (floor(x, z)) {
        const variant = Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 4);
        place(`floor:${variant}`, () => floorTile(variant), x, -FLOOR_DEEP * CRYPT_VOXEL, z); // (its top at the floor's level)
        continue;
      }
      const beside = [-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => floor(x + dx, z + dz)));
      if (!beside) continue;
      if (x === plan.door || x === plan.door + 1) if (z === plan.depth) continue; // (the stairs stand there)
      // All full height; those that can stand between the camera and the floor (not inFullView) fade when the hero's behind them.
      // A blind arch now and then, on the far rock only (facing the floor, where nothing hangs): never on what's seen from outside.
      const plain = (x * 7 + z * 13) % 2;
      if (inFullView(plan, x, z)) {
        const variant = (x * 31 + z * 17) % 9 === 0 && !hung.has(`${x},${z}`) ? ARCADE : plain;
        place(`tall:${variant}`, () => wallTile(TALL, variant), x, -CRYPT_VOXEL, z);
      } else fading.push({ x, z, variant: plain });
    }
  }
  // The stairs up at the door, across the corridor's two tiles.
  place('stairs', stairsUp, plan.door + 0.5, -CRYPT_VOXEL, plan.depth);
  // The tombs and the rest, each centred on its tiles, turned as it faces (but the great tomb: cryptLife.ts, as it bursts).
  for (const p of props) if (p.kind !== 'greatSarcophagus') place(`${p.kind}:${p.variant}`, () => cryptProp(p.kind, p.variant), p.x + (p.w - 1) / 2, 0, p.z + (p.d - 1) / 2, turnsOf(p));

  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const piece of pieces.values()) {
    const grid = piece.build();
    const [sx, , sz] = grid.size;
    // Centred on its tiles (a wall piece on its rock tile, reaching out past it toward the floor).
    const origin = new THREE.Vector3((-sx / 2) * CRYPT_VOXEL, 0, (piece.onWall ? -TILE / 2 : -sz / 2) * CRYPT_VOXEL);
    for (const [material, include] of [[lit, (c: number) => !GLOW.has(c)], [glow, (c: number) => GLOW.has(c)]] as const) {
      const geometry = greedyMesh(grid, CRYPT_PALETTE, CRYPT_VOXEL, origin, include);
      if (!geometry.getAttribute('position')?.count) {
        geometry.dispose();
        continue;
      }
      made.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, piece.at.length);
      piece.at.forEach((a, i) => mesh.setMatrixAt(i, matrix.compose(new THREE.Vector3(a.x, a.y, a.z), turn.setFromAxisAngle(up, (a.turns * Math.PI) / 2), new THREE.Vector3(1, 1, 1))));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = false;
      scene.add(mesh);
    }
  }

  // The rock that can hide the hero: each drawn twice, solid and see-through, only one shown (fadeFor).
  const ghost = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, opacity: FADED, depthWrite: false });
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const shown = (w: { x: number; z: number }) => new THREE.Matrix4().makeTranslation(w.x, -CRYPT_VOXEL, w.z);
  const walls = [0, 1].map((variant) => {
    const tiles = fading.filter((w) => w.variant === variant);
    const grid = wallTile(TALL, variant);
    const geometry = greedyMesh(grid, CRYPT_PALETTE, CRYPT_VOXEL, new THREE.Vector3((-TILE / 2) * CRYPT_VOXEL, 0, (-TILE / 2) * CRYPT_VOXEL));
    made.push(geometry);
    const solid = new THREE.InstancedMesh(geometry, lit, Math.max(1, tiles.length));
    const faded = new THREE.InstancedMesh(geometry, ghost, Math.max(1, tiles.length));
    solid.count = faded.count = tiles.length;
    tiles.forEach((w, i) => {
      solid.setMatrixAt(i, shown(w));
      faded.setMatrixAt(i, hidden);
    });
    scene.add(solid, faded);
    return { tiles, solid, faded, fadedNow: new Set<number>() };
  });
  // Fades the rock just in front of the hero (toward the camera, +x +z), within reach of hiding him; the rest solid again.
  const fadeFor = (hx: number, hz: number) => {
    for (const w of walls) {
      const now = new Set<number>();
      w.tiles.forEach((t, i) => {
        const along = (t.x - hx + (t.z - hz)) / Math.SQRT2; // toward the camera
        const across = Math.abs(t.x - hx - (t.z - hz)) / Math.SQRT2;
        if (along > -0.5 && along < FADE_ALONG && across < FADE_ACROSS) now.add(i);
      });
      for (const i of new Set([...now, ...w.fadedNow])) {
        const fade = now.has(i);
        w.solid.setMatrixAt(i, fade ? hidden : shown(w.tiles[i]));
        w.faded.setMatrixAt(i, fade ? shown(w.tiles[i]) : hidden);
      }
      w.fadedNow = now;
      w.solid.instanceMatrix.needsUpdate = w.faded.instanceMatrix.needsUpdate = true;
    }
  };

  // Light: cold all round; warm pools at the nearest sconces and candles; a faint warmth about the hero.
  scene.add(new THREE.HemisphereLight(0x9aa6bc, 0x1e1914, 0.9));
  const sources = props.filter((p) => LIT.has(p.kind)).map((p) => lightAt(p));
  const pool = Array.from({ length: LIGHTS }, () => {
    const light = new THREE.PointLight(0xffa050, 0, 6, 1.4);
    scene.add(light);
    return light;
  });
  const near = new THREE.PointLight(0xffd8a8, 0.7, 4, 1.6);
  scene.add(near);
  let placedAt = { x: Infinity, z: Infinity };
  let fadedAt = ''; // the half-tile the rock was last faded for
  let shining: Array<{ x: number; y: number; z: number; strength: number }> = [];

  return {
    scene,
    update(time) {
      pool.forEach((light, i) => (light.intensity = shining[i] ? shining[i].strength * flicker(time * 0.8, i * 5) : 0));
    },
    seeHero(x, z) {
      near.position.set(x, 1.4, z);
      const tile = `${Math.round(x * 2)},${Math.round(z * 2)}`;
      if (tile !== fadedAt) {
        fadedAt = tile;
        fadeFor(x, z);
      }
      if (Math.hypot(x - placedAt.x, z - placedAt.z) < RELIGHT) return;
      placedAt = { x, z };
      shining = [...sources].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)).slice(0, LIGHTS);
      pool.forEach((light, i) => shining[i] && light.position.set(shining[i].x, shining[i].y, shining[i].z));
    },
    dispose() {
      for (const geometry of made) geometry.dispose();
      lit.dispose();
      glow.dispose();
      ghost.dispose();
    },
    showMugs() {}, // (no bar down here)
    forge() {},
  };
}

// Quarter turns a prop's drawn with: a wall piece facing the floor it looks out on; a
// sarcophagus laid across (two tiles along x) turned a quarter; the rest as built.
function turnsOf(p: CryptProp): number {
  if (p.kind === 'sarcophagus') return p.w > p.d ? 1 : 0;
  return p.facing;
}

// Where a light-giving prop's light shines from (a sconce: out from its wall, at its flame), and how strong.
function lightAt(p: CryptProp): { x: number; y: number; z: number; strength: number } {
  if (p.kind === 'sconce') {
    const [ox, oz] = FACINGS[p.facing];
    return { x: p.x + ox * 0.6, y: 28 * CRYPT_VOXEL, z: p.z + oz * 0.6, strength: 2.6 };
  }
  return { x: p.x, y: 0.5, z: p.z, strength: 1.8 };
}

