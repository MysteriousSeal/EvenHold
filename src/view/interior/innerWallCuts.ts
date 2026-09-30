// Full-height inner walls (the walls option) that stand between the hero and
// the camera, near them, turn see-through above their rail so the room
// behind shows: each wall tile's part above the rail is meshed apart from the
// room, faded and made whole again as the hero moves (at once).

import * as THREE from 'three';
import type { Furniture } from '../../model/interiors/furniture';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { paintFurniture } from './furnitureVoxels';

const TILE = 25;
const CUT = 12; // voxels: the rail's top, what's left standing
const HEIGHT = 40; // a wall tile's grid, tall enough for the wall
const NEAR = 3; // tiles from the hero toward the camera: walls within it see-through
const GHOST = 0.25; // how opaque a wall in the way is
const SLACK = 0.8; // tiles either side of the line of sight, a window round the hero

const isTall = (f: Furniture) => (f.kind === 'hallWall' || f.kind === 'hallDoor') && !!f.tall;

// Clears the tall inner walls' upper parts from the room's grid (meshed apart, WallCuts);
// the grid's floor tile (0, 0) starts at voxel (x0, z0), its floor at row `floor`.
export function clearUpper(grid: VoxelGrid, furniture: readonly Furniture[], x0: number, z0: number, floor: number): void {
  for (const f of furniture) {
    if (!isTall(f)) continue;
    const [sx, sz] = [x0 + f.x * TILE, z0 + f.z * TILE];
    const [ex, ez] = f.wall === 'left' ? [sx + 4, sz + f.d * TILE - 1] : [sx + f.w * TILE - 1, sz + 4];
    fillBox(grid, sx, floor + CUT, sz, ex, grid.size[1] - 1, ez, 0);
  }
}

// Whether a wall piece stands between the hero (hx, hz) and the camera (off toward (cx, cz)), near them.
function inTheWay(f: Furniture, hx: number, hz: number, cx: number, cz: number): boolean {
  const left = f.wall === 'left';
  const [toward, along] = left ? [cx, cz] : [cz, cx];
  const gap = (left ? f.x : f.z) - 0.4 - (left ? hx : hz); // to the wall's middle, toward the camera
  if (toward <= 0 || gap <= 0 || gap > NEAR) return false;
  const cross = (left ? hz : hx) + (gap / toward) * along; // where the line of sight meets the wall
  const [a0, a1] = left ? [f.z - 0.5, f.z - 0.5 + f.d] : [f.x - 0.5, f.x - 0.5 + f.w];
  return cross > a0 - SLACK && cross < a1 + SLACK;
}

export class WallCuts {
  private readonly parts: Array<{ f: Furniture; top: THREE.Mesh }> = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly solid: THREE.Material;
  private readonly ghost: THREE.Material;

  constructor(scene: THREE.Object3D, furniture: readonly Furniture[], palette: number[], voxel: number, material: THREE.Material) {
    this.solid = material;
    this.ghost = material.clone();
    Object.assign(this.ghost, { transparent: true, opacity: GHOST, depthWrite: false }); // the furniture behind it shows through
    for (const f of furniture) {
      if (!isTall(f)) continue;
      // The tile's wall above the rail (a picture on it hangs on its face, in the room's own mesh).
      const grid = createGrid([f.w * TILE, HEIGHT, f.d * TILE]);
      paintFurniture(grid, [{ ...f, x: 0, z: 0 }], 0, 0);
      fillBox(grid, 0, 0, 0, grid.size[0] - 1, CUT - 1, grid.size[2] - 1, 0); // below the rail: the room's own mesh
      const geometry = greedyMesh(grid, palette, voxel, new THREE.Vector3(f.x - 0.5, -voxel, f.z - 0.5));
      this.geometries.push(geometry);
      const top = new THREE.Mesh(geometry, material);
      top.castShadow = top.receiveShadow = true;
      scene.add(top);
      this.parts.push({ f, top });
    }
  }

  // Each frame: the walls in the way (hero at (hx, hz), the camera off toward (cx, cz)) see-through, the others whole.
  update(hx: number, hz: number, cx: number, cz: number): void {
    for (const p of this.parts) {
      const through = inTheWay(p.f, hx, hz, cx, cz);
      p.top.material = through ? this.ghost : this.solid;
      p.top.castShadow = !through;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.ghost.dispose();
  }
}
