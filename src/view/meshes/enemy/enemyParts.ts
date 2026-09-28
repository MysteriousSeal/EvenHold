// Pieces every enemy on screen shares: a small voxel health bar that floats
// over its head, and the burst of voxel cubes it breaks into when
// it dies.

import * as THREE from 'three';
import { ENEMY_CORPSE_TIME } from '../../../model/constants';

const CAMERA_YAW = Math.PI / 4; // the fixed camera looks along -X-Z
const PIECES = 30;
const GRAVITY = 3.5;
const BURST_AT = 0.7; // seconds after death when an enemy breaks apart

// Shared by every enemy's bar and burst.
export const ENEMY_BAR = new THREE.MeshBasicMaterial({ color: 0xd8342c });
export const ENEMY_BAR_EMPTY = new THREE.MeshBasicMaterial({ color: 0x3a2522 });
export const ENEMY_BURST = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
const BLOCK = new THREE.BoxGeometry(0.07, 0.035, 0.02);
const CUBE = new THREE.BoxGeometry(1, 1, 1);

// Five blocks, red for the share of health left (a block lit while any of
// its fifth remains). Turned to face the camera whichever way its owner
// faces; shown for as long as the owner lives.
const BAR_BLOCKS = 5;

export class HealthBar {
  readonly group = new THREE.Group();
  private readonly blocks: THREE.Mesh[] = [];

  constructor(height: number) {
    const max = BAR_BLOCKS;
    for (let i = 0; i < max; i++) {
      const block = new THREE.Mesh(BLOCK, ENEMY_BAR);
      block.position.x = (i - (max - 1) / 2) * 0.085;
      this.group.add(block);
      this.blocks.push(block);
    }
    this.group.position.y = height;
  }

  update(hp: number, maxHp: number, alive: boolean, ownerHeading: number): void {
    this.group.visible = alive;
    this.group.rotation.y = CAMERA_YAW - ownerHeading;
    const lit = Math.ceil((Math.max(0, hp) / maxHp) * BAR_BLOCKS);
    this.blocks.forEach((block, i) => (block.material = i < lit ? ENEMY_BAR : ENEMY_BAR_EMPTY));
  }
}

// A spray of cubes in the owner's colors: thrown out and up, falling,
// bouncing off the ground and shrinking to nothing over `life` (0 -> 1).
export class VoxelBurst {
  private mesh: THREE.InstancedMesh | null = null;
  private readonly pieces: Array<{ p: THREE.Vector3; v: THREE.Vector3 }> = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly colors: number[],
    private readonly height: number,
  ) {}

  // Plays the burst for an enemy dead for `deadFor` seconds: nothing until
  // BURST_AT, then the spray over the rest of its corpse time. True once it
  // has burst, when the body should be hidden.
  play(deadFor: number, dt: number): boolean {
    if (deadFor < BURST_AT) return false;
    if (!this.mesh) this.start();
    this.update((deadFor - BURST_AT) / (ENEMY_CORPSE_TIME - BURST_AT), dt);
    return true;
  }

  private start(): void {
    this.mesh = new THREE.InstancedMesh(CUBE, ENEMY_BURST, PIECES);
    const color = new THREE.Color();
    for (let i = 0; i < PIECES; i++) {
      const a = (i / PIECES) * Math.PI * 2;
      this.pieces.push({
        p: new THREE.Vector3(Math.cos(a) * 0.08, this.height * (0.2 + (i % 5) * 0.18), Math.sin(a) * 0.12),
        v: new THREE.Vector3(Math.cos(a) * 0.9, 1.2 + (i % 3) * 0.4, Math.sin(a) * 0.9),
      });
      this.mesh.setColorAt(i, color.setHex(this.colors[i % this.colors.length]));
    }
    this.parent.add(this.mesh);
  }

  private update(life: number, dt: number): void {
    if (!this.mesh) return;
    const size = Math.max(0.001, 0.05 * (1 - Math.min(1, life)));
    this.pieces.forEach((piece, i) => {
      piece.v.y -= GRAVITY * dt;
      piece.p.addScaledVector(piece.v, dt);
      if (piece.p.y < 0) {
        piece.p.y = 0;
        piece.v.multiplyScalar(0.5);
      }
      this.mesh!.setMatrixAt(i, this.matrix.compose(piece.p, this.turn, this.scale.setScalar(size)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh?.removeFromParent();
    this.mesh?.dispose();
  }
}
