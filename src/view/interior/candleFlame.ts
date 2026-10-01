// A candle's flame, in voxels as small as the candle's (2 across), drawn
// frame by frame: a few shapes swapped over time, the tip leaning and
// leaping, unlit so it glows. An orange foot, a bright middle, an orange tip.

import * as THREE from 'three';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { EMBER, FIRE } from './furniturePalette';

// Each frame bottom layer first, a layer's four cells as [u0v0, u1v0, u0v1, u1v1]: F fire, E ember, . empty.
const FRAMES = [
  ['FFFF', 'EEEE', 'E...'],
  ['FFFF', 'EEEE', '...E', '...F'],
  ['FFFF', 'EEE.', '.E..'],
  ['FFFF', 'EEEE', '..EE', '..F.'],
];
const FPS = 4; // frames a second: a calm flame

export class CandleFlames {
  private readonly frames: THREE.BufferGeometry[];
  private readonly material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private readonly flames: THREE.Mesh[] = [];

  constructor(palette: number[], voxel: number) {
    const origin = new THREE.Vector3(-voxel, 0, -voxel); // two across, centred
    this.frames = FRAMES.map((layers) => {
      const grid = createGrid([2, layers.length, 2]);
      layers.forEach((cells, y) => {
        for (let i = 0; i < 4; i++) {
          const c = cells[i];
          if (c !== '.') setColor(grid, i % 2, y, Math.floor(i / 2), c === 'F' ? FIRE : EMBER);
        }
      });
      return greedyMesh(grid, palette, voxel, origin);
    });
  }

  // A flame standing at (x, y, z), its foot's middle.
  add(scene: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh {
    const flame = new THREE.Mesh(this.frames[0], this.material);
    flame.position.set(x, y, z);
    scene.add(flame);
    this.flames.push(flame);
    return flame;
  }

  update(time: number): void {
    this.flames.forEach((flame, i) => {
      const step = Math.floor(time * FPS + i * 2.7); // each on its own beat
      flame.geometry = this.frames[(step * 7 + i) % this.frames.length]; // not in a plain cycle
    });
  }

  dispose(): void {
    for (const g of this.frames) g.dispose();
    this.material.dispose();
  }
}
