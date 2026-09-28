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

// One block per hit point, red while it lasts; past MAX_BLOCKS hit points,
// each block stands for a share of them (lit while any of it is left).
// Turned to face the camera whichever way its owner faces; shown for as
// long as the owner lives.
const MAX_BLOCKS = 10;
const NAME_HEIGHT = 0.22; // world units tall, the name over the bar

// A name drawn once onto a texture, white with an ink outline like the HUD's,
// shared by everyone who bears it.
const nameMaterials = new Map<string, { material: THREE.SpriteMaterial; aspect: number }>();
function nameMaterial(name: string): { material: THREE.SpriteMaterial; aspect: number } {
  let entry = nameMaterials.get(name);
  if (!entry) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = "700 88px 'Fredoka', system-ui, sans-serif";
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(name).width) + 28;
    canvas.height = 116;
    ctx.font = font; // resizing the canvas resets it
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#2e1f14';
    ctx.strokeText(name, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#f8ecd4';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false });
    entry = { material, aspect: canvas.width / canvas.height };
    nameMaterials.set(name, entry);
  }
  return entry;
}

// A name floating in the world, facing the camera, `height` world units tall.
export function nameLabel(name: string, height = NAME_HEIGHT): THREE.Sprite {
  const { material, aspect } = nameMaterial(name);
  const label = new THREE.Sprite(material);
  label.scale.set(height * aspect, height, 1);
  return label;
}

export class HealthBar {
  readonly group = new THREE.Group();
  private blocks: THREE.Mesh[] = [];

  // `name`, if given, floats just above the bar.
  constructor(height: number, name?: string) {
    this.group.position.y = height;
    if (name) {
      const label = nameLabel(name);
      label.position.y = 0.14;
      this.group.add(label);
    }
  }

  update(hp: number, maxHp: number, alive: boolean, ownerHeading: number): void {
    const count = Math.min(maxHp, MAX_BLOCKS);
    if (count !== this.blocks.length) this.build(count);
    this.group.visible = alive;
    this.group.rotation.y = CAMERA_YAW - ownerHeading;
    const lit = Math.ceil((Math.max(0, hp) / maxHp) * count);
    this.blocks.forEach((block, i) => (block.material = i < lit ? ENEMY_BAR : ENEMY_BAR_EMPTY));
  }

  private build(count: number): void {
    for (const block of this.blocks) block.removeFromParent();
    this.blocks = Array.from({ length: count }, (_, i) => {
      const block = new THREE.Mesh(BLOCK, ENEMY_BAR);
      block.position.x = (i - (count - 1) / 2) * 0.085;
      this.group.add(block);
      return block;
    });
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
