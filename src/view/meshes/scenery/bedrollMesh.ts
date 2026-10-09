// The hero's bedroll, unrolled on the ground under them (GameModel.lieDown: a tool used off the action bar, lying
// down anywhere outdoors): a blanket the length of a tile, its edges turned, a pillow's bulge at the head; where they
// lie, turned the way they face; rolled up and gone as they get up.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const VOXEL = 0.04;
const GRID: [number, number, number] = [11, 3, 26]; // across, up, along (a tile is 25 voxels)
const PALETTE = [0x4e6a42, 0x3a5232, 0xe6dcc0, 0x7a4a2a]; // wool, its shadow, linen, leather

function buildBedroll() {
  const g = createGrid(GRID);
  fillBox(g, 0, 0, 0, 10, 0, 25, (x, _y, z) => (x === 0 || x === 10 || z === 0 || z === 25 ? 2 : 1)); // the blanket, its edges turned darker
  fillBox(g, 1, 1, 1, 9, 1, 24, (x, _y, z) => ((x + z) % 7 === 0 ? 2 : 1)); // laid double, a weave in it
  fillBox(g, 2, 1, 20, 8, 2, 24, 3); // the pillow at the head: linen, a little higher
  fillBox(g, 1, 1, 0, 9, 1, 1, 4); // the straps, laid out at the foot
  return g;
}

export class BedrollView {
  private mesh: THREE.Mesh | null = null;

  constructor(private readonly scene: THREE.Object3D) {}

  // Each frame: under the hero while they lie on it outdoors; else gone.
  update(model: GameModel): void {
    const seat = model.outdoors.seated?.seat;
    if (!seat || seat.piece.kind !== 'bedroll') return this.clear();
    if (!this.mesh) {
      const geometry = greedyMesh(buildBedroll(), PALETTE, VOXEL, new THREE.Vector3((-GRID[0] * VOXEL) / 2, 0, (-GRID[2] * VOXEL) / 2));
      this.mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.scene.add(this.mesh);
    }
    this.mesh.position.set(seat.x, model.getGroundY(seat.x, seat.z) + 0.01, seat.z);
    this.mesh.rotation.y = seat.facing;
  }

  clear(): void {
    if (!this.mesh) return;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh = null;
  }
}
