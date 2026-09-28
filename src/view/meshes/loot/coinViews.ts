// Coins lying on the ground near the hero: a small stepped stack of gold
// squares, its top catching the light, bobbing a little and glinting, so
// it's seen and scooped up on the way past. Made as coins come into range,
// dropped when they're picked up or left behind.

import * as THREE from 'three';
import type { GroundCoins } from '../../../model/money';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { greedyMesh } from '../voxel/greedyMesh';

const VIEW_RADIUS = 30;
const VOXEL = 0.02;
const BOB = 0.015;
const PALETTE = [0xb08020, 0xe0b040, 0xfbe08a]; // dark gold, gold, lit gold

// Three coins stacked a little askew (square, like everything in the world).
function pileGeometry(): THREE.BufferGeometry {
  const grid = createGrid([6, 3, 6]);
  const coin = (x: number, y: number, z: number) => fillBox(grid, x, y, z, x + 3, y, z + 3, (cx, _y, cz) => (cx === x || cz === z ? 1 : 2));
  coin(0, 0, 0);
  coin(2, 0, 2);
  coin(1, 1, 1);
  fillBox(grid, 2, 2, 2, 3, 2, 3, 3); // the glint on top
  return greedyMesh(grid, PALETTE, VOXEL, new THREE.Vector3(-3 * VOXEL, 0, -3 * VOXEL));
}

export class CoinViews {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3, emissive: 0x3a2808 });
  private readonly geometry = pileGeometry();
  private readonly shown = new Map<number, THREE.Mesh>();
  private time = 0;

  constructor(private readonly scene: THREE.Scene) {}

  update(coins: readonly GroundCoins[], heroX: number, heroZ: number, dt: number): void {
    this.time += dt;
    const seen = new Set<number>();
    for (const pile of coins) {
      if (Math.abs(pile.x - heroX) > VIEW_RADIUS || Math.abs(pile.z - heroZ) > VIEW_RADIUS) continue;
      seen.add(pile.id);
      let mesh = this.shown.get(pile.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geometry, this.material);
        this.shown.set(pile.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(pile.x, pile.y + 0.02 + Math.sin(this.time * 2.4 + pile.id) * BOB, pile.z);
    }
    for (const [id, mesh] of this.shown) {
      if (seen.has(id)) continue;
      mesh.removeFromParent();
      this.shown.delete(id);
    }
  }
}
