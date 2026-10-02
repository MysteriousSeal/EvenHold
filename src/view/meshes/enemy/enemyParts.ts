// Pieces every enemy on screen shares: a small voxel health bar that floats
// over its head (its name above, its level just left of the name, coloured
// by how dangerous it is for the hero, as the target panel has it), and the
// burst of voxel cubes it breaks into when it dies.

import * as THREE from 'three';
import { ENEMY_CORPSE_TIME } from '../../../model/constants';
import { CAMERA_YAW } from '../../constants';
import type { Enemy, EnemyKind } from '../../../model/types';
import { difficulty, type Difficulty } from '../../../model/enemies/enemyLevels';
import { INK, nameLabel } from '../common/overhead';
import { voxelIcon } from '../../ui/voxelIcon';
import { bossSkull } from './skeletonVoxels';

const PIECES = 30;
const GRAVITY = 3.5;
const BURST_AT = 0.7; // seconds after death when an enemy breaks apart

// Shared by every enemy's bar and burst.
// Drawn over everything, as the name and level over it are (never hidden behind a tree or a wall).
const overAll = (color: number) => new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false });
export const ENEMY_BAR = overAll(0xd8342c);
export const PASSIVE_BAR = overAll(0xe8c030); // a passive foe's: it only fights back
export const ENEMY_BAR_EMPTY = overAll(0x3a2522);
export const ENEMY_BURST = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
const BLOCK = new THREE.BoxGeometry(0.07, 0.035, 0.02);
const CUBE = new THREE.BoxGeometry(1, 1, 1);

// One block per hit point, red while it lasts; past MAX_BLOCKS hit points,
// each block stands for a share of them (lit while any of it is left).
// Turned to face the camera whichever way its owner faces; shown for as
// long as the owner lives.
const MAX_BLOCKS = 10;
const NAME_HEIGHT = 0.22; // world units tall, the name over the bar
const NAME_Y = 0.14; // the name's height over the bar
const LEVEL_GAP = 0.05; // between the level and the name
// The level's colour by how dangerous the foe is (as the target panel's name, hud.css).
const DANGER_INK: Record<Difficulty, string> = { trivial: '#b4b0a8', even: INK, tough: '#f2d15a', hard: '#f0913a', deadly: '#e8483a' };
let heroLevel = 1; // the hero's, for the levels' colours (EnemyViews sets it each frame)
export const setBarHeroLevel = (level: number) => void (heroLevel = level);

// A boss's mark over its head: the white skull (skeletonVoxels.ts), drawn once, over everything as the names are.
let bossMaterial: THREE.SpriteMaterial | null = null;
function bossMark(): THREE.SpriteMaterial {
  if (!bossMaterial) {
    const texture = new THREE.CanvasTexture(voxelIcon('boss-skull-white', bossSkull, 64));
    texture.colorSpace = THREE.SRGBColorSpace;
    bossMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, fog: false });
  }
  return bossMaterial;
}

// What each kind's called (over its head, in the target panel), unless it has a name of its own (a crypt's lord).
const ENEMY_NAMES: Record<EnemyKind, string> = { wolf: 'Wolf', bandit: 'Bandit', boar: 'Boar', skeleton: 'Skeleton', skeletonArcher: 'Skeleton archer', draugr: 'Draugr', cryptLord: 'Crypt lord', ghost: 'Ghost' };
export const enemyName = (enemy: Pick<Enemy, 'kind' | 'name'>): string => enemy.name ?? ENEMY_NAMES[enemy.kind];

// What every foe's rig does (enemyViews.ts): its root in the scene, drawn at a size (its bar and name kept at
// theirs), moved and posed each frame from the model, let go.
export interface EnemyRig {
  readonly root: THREE.Object3D;
  drawnAt(scale: number): void;
  update(enemy: Enemy, dt: number, heroX: number, heroZ: number): void;
  dispose(): void;
}

export class HealthBar {
  readonly group = new THREE.Group();
  private blocks: THREE.Mesh[] = [];
  private level: THREE.Sprite | null = null;
  private shown = ''; // the level and colour it shows (made afresh when either changes)
  private nameWidth = 0; // the name's, to set the level beside it

  // `name`, if given, floats just above the bar; `passive`, the bar's yellow; `boss`, a white skull right of the name.
  constructor(height: number, name?: string, private readonly passive = false, boss = false) {
    this.group.position.y = height;
    if (name) {
      const label = nameLabel(name);
      label.position.y = NAME_Y;
      this.nameWidth = label.scale.x;
      this.group.add(label);
    }
    if (boss) {
      const mark = new THREE.Sprite(bossMark());
      mark.scale.set(NAME_HEIGHT * 1.2, NAME_HEIGHT * 1.2, 1);
      mark.position.set(this.nameWidth / 2 + LEVEL_GAP + NAME_HEIGHT * 0.6, NAME_Y, 0);
      mark.renderOrder = 10;
      this.group.add(mark);
    }
  }

  // `fighting`: a passive foe's set on the hero now (its bar red, as the target panel's).
  update(hp: number, maxHp: number, alive: boolean, ownerHeading: number, level?: number, fighting = false): void {
    const count = Math.min(maxHp, MAX_BLOCKS);
    if (count !== this.blocks.length) this.build(count);
    if (level !== undefined) this.showLevel(level);
    this.group.visible = alive;
    this.group.rotation.y = CAMERA_YAW - ownerHeading;
    const lit = Math.ceil((Math.max(0, hp) / maxHp) * count);
    this.blocks.forEach((block, i) => (block.material = i < lit ? (this.passive && !fighting ? PASSIVE_BAR : ENEMY_BAR) : ENEMY_BAR_EMPTY));
  }

  // The level, just left of the name (as tall), in its danger colour.
  private showLevel(level: number): void {
    const ink = DANGER_INK[difficulty(level, heroLevel)];
    const key = `${level}|${ink}`;
    if (key === this.shown) return;
    this.shown = key;
    this.level?.removeFromParent();
    this.level = nameLabel(String(level), NAME_HEIGHT, ink);
    this.level.position.set(-this.nameWidth / 2 - LEVEL_GAP - this.level.scale.x / 2, NAME_Y, 0);
    this.group.add(this.level);
  }

  private build(count: number): void {
    for (const block of this.blocks) block.removeFromParent();
    this.blocks = Array.from({ length: count }, (_, i) => {
      const block = new THREE.Mesh(BLOCK, ENEMY_BAR);
      block.renderOrder = 10; // (after everything else, as the name)
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
