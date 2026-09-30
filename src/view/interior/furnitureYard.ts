// The furniture yard, as its own scene: flat grass (the world's own grass
// shading) and one mesh per piece. Not a room — no walls, no indoor zoom.
// A bench is the outdoor one; a hall door gets its swinging leaf.

import * as THREE from 'three';
import type { Furniture, FurnitureKind } from '../../model/interiors/furniture';
import { YARD_SIZE } from '../../model/interiors/furnitureYard';
import { paintFurniture } from './furnitureVoxels';
import { ROOM_PALETTE, ROOM_VOXEL } from './roomVoxels';
import { DOOR_LEAF, paintDoorLeaf } from './upstairsVoxels';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { addVoxelGround } from '../meshes/terrain/voxelGround';
import { BENCH_GRID, BENCH_PALETTE, BENCH_VOXEL_SIZE, buildBench } from '../meshes/plaza/benchVoxels';
import { addLights } from '../render/lighting';
import { FOG_COLOR, FOG_FAR, FOG_NEAR, TERRAIN_COLORS } from '../constants';

const TILE = 25;
const PAD = 12; // voxels past the piece, so a draw that spills out of its tiles still shows
const ABOVE = 56;
const BELOW_STAIR = 16;
const SWING = (100 * Math.PI) / 180;

// Hung on (or standing against) a wall, so drawn with a bit of wall behind them.
const MOUNTED = new Set<FurnitureKind>(['shelf', 'framedPicture', 'weaponWall', 'toolBoard', 'bottleShelf', 'antlers', 'wallShield', 'noticeBoard', 'wallLantern']);
const mounted = (kind: FurnitureKind) => MOUNTED.has(kind);

function pieceGeometry(item: Furniture): THREE.BufferGeometry {
  if (item.kind === 'bench') {
    const origin = new THREE.Vector3((-BENCH_GRID[0] * BENCH_VOXEL_SIZE) / 2, 0, (-BENCH_GRID[2] * BENCH_VOXEL_SIZE) / 2);
    const geo = greedyMesh(buildBench(), BENCH_PALETTE, BENCH_VOXEL_SIZE, origin);
    geo.translate(item.x, 0, item.z);
    return geo;
  }
  const below = item.kind === 'stairwell' ? BELOW_STAIR : 0;
  const w = item.w * TILE;
  const d = item.d * TILE;
  const grid = createGrid([PAD + w + PAD, below + ABOVE, PAD + d + PAD]);
  if (mounted(item.kind) && item.wall === 'back') {
    const top = below + (item.tall ? 34 : 18);
    fillBox(grid, PAD, below, PAD - 5, PAD + w - 1, top, PAD - 1, (x, y) => ((x - PAD) % TILE <= 1 || y === top ? 10 : 8));
  }
  paintFurniture(grid, [{ ...item, x: 0, z: 0 }], PAD, PAD, below);
  const origin = new THREE.Vector3(item.x - 0.5 - PAD * ROOM_VOXEL, -ROOM_VOXEL * (1 + below), item.z - 0.5 - PAD * ROOM_VOXEL);
  return greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, origin);
}

function doorLeaf(): THREE.BufferGeometry {
  const { width, height, thick } = DOOR_LEAF;
  const grid = createGrid([width, height, thick]);
  paintDoorLeaf((u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, color));
  return greedyMesh(grid, ROOM_PALETTE, ROOM_VOXEL, new THREE.Vector3(0, 0, (-thick / 2) * ROOM_VOXEL));
}

function hangDoor(scene: THREE.Scene, item: Furniture, leafShape: THREE.BufferGeometry, material: THREE.Material): void {
  const len = item.w * TILE;
  const along = item.x - 0.5 + (Math.floor((len - TILE) / 2) + DOOR_LEAF.hinge) * ROOM_VOXEL;
  const across = item.z - 0.5 + (DOOR_LEAF.thick / 2) * ROOM_VOXEL;
  const hinge = new THREE.Group();
  hinge.position.set(along, 0, across);
  hinge.rotation.y = item.open ? -SWING : 0;
  const leaf = new THREE.Mesh(leafShape, material);
  hinge.add(leaf);
  scene.add(hinge);
}

export function buildFurnitureYard(furniture: readonly Furniture[]): { scene: THREE.Scene; dispose(): void } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  addLights(scene);

  const geometries: THREE.BufferGeometry[] = [];
  const grass = new THREE.MeshStandardMaterial({ color: TERRAIN_COLORS[0], roughness: 1 });
  addVoxelGround(grass);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(YARD_SIZE, YARD_SIZE).rotateX(-Math.PI / 2).translate(YARD_SIZE / 2 - 0.5, 0, YARD_SIZE / 2 - 0.5), grass);
  scene.add(floor);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const leafShape = doorLeaf();
  geometries.push(leafShape);
  for (const item of furniture) {
    const geometry = pieceGeometry(item);
    geometries.push(geometry);
    if (geometry.getAttribute('position')?.count) scene.add(new THREE.Mesh(geometry, material));
    if (item.kind === 'hallDoor') hangDoor(scene, item, leafShape, material);
  }

  return {
    scene,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      floor.geometry.dispose();
      grass.dispose();
      material.dispose();
    },
  };
}
