// The inn's cupboard, to be seen: the carved tankards sold her (inn/tavernShop.ts INN_WANTS) stood in a row along the
// top shelf of each bottle shelf behind the bar, so many to a shelf, as many as she has (the rest in the back). Redrawn
// as her count changes (a sale, a barkeep's shift begun); gone with the room.
import * as THREE from 'three';
import type { GameModel } from '../../model/GameModel';
import { doorNumber } from '../../model/interiors/interiors';
import { JUNK_MODELS } from '../meshes/loot/junkVoxels';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { ROOM_VOXEL } from './roomVoxels';

export const MUGS_A_SHELF = 4; // tankards to be seen on each bottle shelf, at most
const MUG_VOXEL = 0.028; // a tankard's voxel, on the shelf (smaller than on the ground: a shelf's worth of them)
const SHELF_TOP = 21 * ROOM_VOXEL; // the upper shelf's surface (innFurnitureVoxels.ts bottleShelf: its shelves at 10 and 20, a lip at 21)
const OUT = 0.2; // tiles out from the wall the row stands (the shelf is 9 voxels deep: on its front half)

export class Cupboard {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true });
  private geometry: THREE.BufferGeometry | null = null;
  private shown: { inn: number; count: number } | null = null;

  // Each frame indoors: the inn's tankards, as many as she has now, on her shelves (`room`: the room's scene).
  update(model: GameModel, room: THREE.Object3D): void {
    const inside = model.inside;
    const inn = inside && !inside.below && inside.entrance.type === 'inn' ? doorNumber(inside.entrance) : null;
    const count = inn === null ? 0 : (model.shops.get(inn)?.stock.carvedTankard ?? 0);
    if (this.shown?.inn === inn && this.shown.count === count && this.group.parent === room) return;
    this.clear();
    if (inn === null || count === 0) return;
    this.shown = { inn, count };
    const shelves = inside!.furniture.filter((f) => f.kind === 'bottleShelf');
    let left = count;
    for (const shelf of shelves) {
      const here = Math.min(MUGS_A_SHELF, left);
      for (let i = 0; i < here; i++) {
        const mug = new THREE.Mesh(this.tankard(), this.material);
        // (Along the wall the shelf's on: a left wall's runs along z; a back wall's along x.)
        const t = (i + 0.5) / MUGS_A_SHELF; // its place along the shelf, 0..1
        if (shelf.wall === 'left') mug.position.set(shelf.x - 0.5 + OUT, SHELF_TOP, shelf.z - 0.5 + t * shelf.d);
        else mug.position.set(shelf.x - 0.5 + t * shelf.w, SHELF_TOP, shelf.z - 0.5 + OUT);
        mug.rotation.y = (i % 2) * 0.6 - 0.3; // (set down as they were, not in a line)
        this.group.add(mug);
      }
      left -= here;
      if (left <= 0) break;
    }
    room.add(this.group);
  }

  // How many are to be seen just now.
  get mugs(): number {
    return this.group.children.length;
  }

  clear(): void {
    this.group.clear();
    this.group.removeFromParent();
    this.shown = null;
  }

  private tankard(): THREE.BufferGeometry {
    if (!this.geometry) {
      const model = JUNK_MODELS.carvedTankard;
      this.geometry = greedyMesh(model.build(), model.palette, MUG_VOXEL, new THREE.Vector3());
      this.geometry.computeBoundingBox();
      const box = this.geometry.boundingBox!;
      this.geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2); // (stood on its base, centred)
    }
    return this.geometry;
  }

  dispose(): void {
    this.clear();
    this.geometry?.dispose();
    this.material.dispose();
  }
}
