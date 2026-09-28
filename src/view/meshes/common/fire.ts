// A fire in voxels: little cubes of flame rising from a bed, shrinking as
// they cool from yellow to orange to red, and a few embers drifting up
// above them. Every cube follows its own looping path from the time alone,
// so a fire needs no state and costs one draw call. Unlit and untouched by
// tone mapping, so it glows. Hearths, the forge and campfires all use it.

import * as THREE from 'three';
import { hashUnit } from '../../../util/random';

const FLAMES = 22;
const EMBERS = 7;
const CUBE = new THREE.BoxGeometry(1, 1, 1);
const HOT = new THREE.Color(0xfff0a0);
const WARM = new THREE.Color(0xff9a2a);
const COOL = new THREE.Color(0xc8321e);
const EMBER = new THREE.Color(0xffb040);

export class FireEffect {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly at = new THREE.Vector3();
  private readonly size = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();

  // `width`: the bed's span; `height`: how high the flames reach; `voxel`: a flame cube's size at its biggest.
  constructor(
    private readonly width = 0.3,
    private readonly height = 0.32,
    private readonly voxel = 0.05,
    private readonly seed = 0,
  ) {
    const material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
    this.mesh = new THREE.InstancedMesh(CUBE, material, FLAMES + EMBERS);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    this.update(0);
  }

  update(time: number): void {
    for (let i = 0; i < FLAMES + EMBERS; i++) {
      const ember = i >= FLAMES;
      const speed = ember ? 0.35 : 1.1 + hashUnit(i, this.seed, 3) * 0.6;
      const t = time * speed + hashUnit(i, this.seed, 4);
      const cycle = Math.floor(t);
      const life = t - cycle; // 0 at the bed, 1 when gone
      // Where along the bed it starts this time round, and a little sway.
      const spread = ember ? this.width * 0.8 : this.width * (1 - life * 0.6);
      const x = (hashUnit(i, cycle, 5) - 0.5) * spread + Math.sin(t * 6 + i) * 0.01;
      const z = (hashUnit(i, cycle, 6) - 0.5) * spread * 0.6;
      const y = life * (ember ? this.height * 2.2 : this.height);
      const s = ember ? this.voxel * 0.35 * (1 - life) : this.voxel * (1 - life * 0.85);
      this.at.set(x, y + s / 2, z);
      this.size.setScalar(Math.max(0.0001, s));
      this.mesh.setMatrixAt(i, this.matrix.compose(this.at, this.turn, this.size));
      if (ember) this.color.copy(EMBER);
      else if (life < 0.4) this.color.copy(HOT).lerp(WARM, life / 0.4);
      else this.color.copy(WARM).lerp(COOL, (life - 0.4) / 0.6);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}

// How bright a fire's light is now: a warm flicker around 1.
export function flicker(time: number, seed = 0): number {
  return 0.85 + Math.sin(time * 9.1 + seed) * 0.07 + Math.sin(time * 23.7 + seed * 3) * 0.05 + Math.sin(time * 4.3) * 0.03;
}
