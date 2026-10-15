// The campfire the hero kindles to cook over (model/skills/cooking.ts kindle), while it burns: a ring of grey stones
// round two crossed logs, in voxels, the flames over them (fire.ts, as a camp's), smaller as it burns down; gone with it.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { KINDLED_BURNS } from '../../../model/skills/cooking';
import { FireEffect } from '../common/fire';
import { greedyMesh } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const V = 0.05; // its voxels, about the camps'
const N = 9; // its grid across
const BED_HEIGHT = 0.06; // the flames' bed, over the logs

// The stones and the logs: grey stones round the edge (two tones), the logs crossed, bark 3 and their cut ends 4.
export function pit(): THREE.BufferGeometry {
  const g = createGrid([N, 2, N]);
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const r = Math.hypot(x - 4, z - 4);
      if (r >= 3.2 && r < 4.5 && (x + z) % 4 !== 0) setColor(g, x, 0, z, (x * 3 + z) % 3 === 0 ? 2 : 1); // the stones, a gap now and then
    }
  fillBox(g, 2, 0, 4, 6, 0, 4, (x) => (x === 2 || x === 6 ? 4 : 3)); // a log along x
  fillBox(g, 4, 1, 2, 4, 1, 6, (_x, _y, z) => (z === 2 || z === 6 ? 4 : 3)); // and one across it
  return greedyMesh(g, [0x8a8a84, 0x6a6a66, 0x5a3e26, 0xd8b070], V, new THREE.Vector3((-N * V) / 2, 0, (-N * V) / 2));
}

export class KindledFire {
  private readonly group = new THREE.Group();
  private fire: FireEffect | null = null;
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private at: string | null = null;

  constructor(scene: THREE.Scene) {
    this.group.add(new THREE.Mesh(pit(), this.material));
    this.group.visible = false;
    scene.add(this.group);
  }

  update(model: GameModel, time: number): void {
    const kindled = model.inside ? null : model.cooking.kindled;
    this.group.visible = !!kindled;
    if (!kindled) return;
    const key = `${kindled.x},${kindled.z}`;
    if (key !== this.at) {
      this.at = key;
      this.group.position.set(kindled.x, model.getGroundY(kindled.x, kindled.z), kindled.z);
      if (this.fire) [this.group.remove(this.fire.group), this.fire.dispose()];
      this.fire = new FireEffect(0.2, 0.15, 0.04, Math.round(kindled.x * 13 + kindled.z));
      this.fire.group.position.y = BED_HEIGHT;
      this.group.add(this.fire.group);
    }
    this.fire!.group.scale.setScalar(0.6 + 0.4 * Math.min(1, kindled.left / (KINDLED_BURNS / 2))); // (burning down, its last half)
    this.fire!.update(time);
  }
}
